import { z } from "zod";

import { API_URL, apiFetch } from "@/lib/api/client";

export type CodingTransport = "local" | "remote";

const LOCAL_URL =
  process.env.NEXT_PUBLIC_CODING_AGENT_URL ?? "http://127.0.0.1:7331/v1";

const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path_hint: z.string().nullable().optional(),
});

export const codingDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  connected: z.boolean(),
  capabilities: z.object({
    workspaces: z.array(workspaceSchema).optional(),
    max_concurrency: z.number().optional(),
    version: z.string().optional(),
  }).passthrough(),
  created_at: z.string(),
  last_seen_at: z.string().nullable(),
});
export type CodingDevice = z.infer<typeof codingDeviceSchema>;
export type CodingWorkspace = z.infer<typeof workspaceSchema>;

export const codingEventSchema = z.object({
  seq: z.number(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
export type CodingEvent = z.infer<typeof codingEventSchema>;

export const codingTaskSchema = z.object({
  id: z.string(),
  device_id: z.string(),
  title: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string(),
  model: z.string(),
  branch: z.string().nullable(),
  status: z.enum(["draft", "queued", "running", "attention", "completed", "failed", "cancelled"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CodingTask = z.infer<typeof codingTaskSchema>;

export const codingTaskDetailSchema = codingTaskSchema.extend({
  events: z.array(codingEventSchema),
});
export type CodingTaskDetail = z.infer<typeof codingTaskDetailSchema>;

function localFetch<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  return fetch(`${LOCAL_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Cole-Agent": "1", ...init?.headers },
  }).then(async (response) => {
    if (!response.ok) throw new Error((await response.text()) || response.statusText);
    return schema.parse(await response.json());
  });
}

function transportFetch<T>(
  transport: CodingTransport,
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  return transport === "local"
    ? localFetch(path, schema, init)
    : apiFetch(`/coding${path}`, schema, init);
}

export function getCodingDevices(transport: CodingTransport): Promise<CodingDevice[]> {
  return transportFetch(transport, "/devices", z.array(codingDeviceSchema));
}

export function getCodingTasks(transport: CodingTransport): Promise<CodingTask[]> {
  return transportFetch(transport, "/tasks", z.array(codingTaskSchema));
}

export function getCodingTask(
  transport: CodingTransport,
  taskId: string,
): Promise<CodingTaskDetail> {
  return transportFetch(transport, `/tasks/${taskId}`, codingTaskDetailSchema);
}

export function createCodingTask(
  transport: CodingTransport,
  input: {
    device_id: string;
    workspace_id: string;
    workspace_name: string;
    prompt: string;
    model: string;
    isolated: boolean;
  },
): Promise<CodingTask> {
  return transportFetch(transport, "/tasks", codingTaskSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sendCodingMessage(
  transport: CodingTransport,
  taskId: string,
  content: string,
  model: string,
): Promise<unknown> {
  const schema = z.unknown();
  return transportFetch(transport, `/tasks/${taskId}/messages`, schema, {
    method: "POST",
    body: JSON.stringify({ content, model }),
  });
}

export function updateCodingTaskModel(
  transport: CodingTransport,
  taskId: string,
  model: string,
): Promise<CodingTask> {
  return transportFetch(transport, `/tasks/${taskId}`, codingTaskSchema, {
    method: "PATCH",
    body: JSON.stringify({ model }),
  });
}

export function sendCodingAction(
  transport: CodingTransport,
  taskId: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<unknown> {
  return transportFetch(transport, `/tasks/${taskId}/actions`, z.unknown(), {
    method: "POST",
    body: JSON.stringify({ type, payload }),
  });
}

export async function closeCodingTask(
  transport: CodingTransport,
  taskId: string,
): Promise<void> {
  const base = transport === "local" ? LOCAL_URL : `${API_URL}/coding`;
  const response = await fetch(`${base}/tasks/${taskId}`, {
    method: "DELETE",
    credentials: transport === "remote" ? "include" : "omit",
    headers: transport === "local" ? { "X-Cole-Agent": "1" } : undefined,
  });
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
}

export const pairingCodeSchema = z.object({ code: z.string(), expires_at: z.string() });
export function createPairingCode() {
  return apiFetch("/coding/pairing-codes", pairingCodeSchema, { method: "POST" });
}

export async function* streamCodingEvents(
  transport: CodingTransport,
  taskId: string,
  after: number,
  signal: AbortSignal,
): AsyncGenerator<CodingEvent> {
  const base = transport === "local" ? LOCAL_URL : `${API_URL}/coding`;
  const response = await fetch(`${base}/tasks/${taskId}/events?after=${after}`, {
    credentials: transport === "remote" ? "include" : "omit",
    headers: transport === "local" ? { "X-Cole-Agent": "1" } : undefined,
    signal,
  });
  if (!response.ok || !response.body) throw new Error(await response.text());
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf("\n\n");
      if (frame.startsWith(":")) continue;
      let id = 0;
      let type = "activity";
      let raw = "{}";
      for (const line of frame.split("\n")) {
        if (line.startsWith("id:")) id = Number(line.slice(3).trim());
        else if (line.startsWith("event:")) type = line.slice(6).trim();
        else if (line.startsWith("data:")) raw = line.slice(5).trim();
      }
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }
      yield { seq: id, type, payload, created_at: new Date().toISOString() };
    }
  }
}

export function defaultCodingTransport(): CodingTransport {
  if (process.env.NEXT_PUBLIC_CODING_TRANSPORT === "remote") return "remote";
  if (process.env.NEXT_PUBLIC_CODING_TRANSPORT === "local") return "local";
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return "remote";
  return "local";
}
