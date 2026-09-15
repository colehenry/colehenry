/**
 * /language/tutor — the embedded French tutor. Threads are persisted server-side;
 * a message streams back as SSE (token · reset · tool · error · done). See
 * context/tutor_plan.md for the context layers and the output tag contract.
 */
import { z } from "zod";

import { API_URL, apiFetch } from "@/lib/api/client";

// What's on screen when a question is asked. Sent with every message; the
// server renders it into the turn so the tutor never needs the item pasted.
export type TutorFocus =
  | {
      surface: "exercise";
      format: string;
      prompt: string;
      prompt_es?: string;
      expected?: string;
      given?: string;
      correct?: boolean;
      target_ids?: string[];
      sprint?: number;
    }
  | { surface: "reference"; sheet: string; section?: string }
  | { surface: "text"; text_id: number; sentence: string; selection?: string }
  | { surface: "vocab"; french: string; status?: string }
  | { surface: "dashboard" | "practice" | "vocab-list" | "study" };

export type TutorLang = "es" | "en";

export const tutorThreadSchema = z.object({
  id: z.number(),
  title: z.string(),
  focus: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TutorThread = z.infer<typeof tutorThreadSchema>;

export const tutorMessageSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  focus: z.record(z.string(), z.unknown()).nullable().optional(),
  tool_calls: z.array(z.unknown()).nullable().optional(),
  created_at: z.string(),
});
export type TutorMessage = z.infer<typeof tutorMessageSchema>;

const threadDetailSchema = tutorThreadSchema.extend({ messages: z.array(tutorMessageSchema) });
export type TutorThreadDetail = z.infer<typeof threadDetailSchema>;

export function fetchTutorStatus() {
  return apiFetch("/language/tutor/status", z.object({ available: z.boolean(), models: z.array(z.string()) }));
}

export function listTutorThreads(limit = 30) {
  return apiFetch(`/language/tutor/threads?limit=${limit}`, z.array(tutorThreadSchema));
}

export function createTutorThread(focus: TutorFocus | null) {
  return apiFetch("/language/tutor/threads", tutorThreadSchema, {
    method: "POST",
    body: JSON.stringify({ focus: focus ?? {} }),
  });
}

export function fetchTutorThread(id: number) {
  return apiFetch(`/language/tutor/threads/${id}`, threadDetailSchema);
}

export async function deleteTutorThread(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/language/tutor/threads/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(res.statusText);
}

export type TutorEvent =
  | { type: "token"; text: string }
  | { type: "reset" }
  | { type: "tool"; name: string; label: string }
  | { type: "error"; message: string }
  | { type: "done"; content: string; model: string; cost: number; dropped: string[] };

/** Send one message; yields the reply as it streams. The `done` event carries
 *  the server-validated final content — swap the buffer for it. */
export async function* streamTutorMessage(
  threadId: number,
  content: string,
  focus: TutorFocus | null,
  lang: TutorLang,
  signal?: AbortSignal,
): AsyncGenerator<TutorEvent> {
  const res = await fetch(`${API_URL}/language/tutor/threads/${threadId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, focus, lang }),
    signal,
  });
  if (!res.ok || !res.body) {
    yield { type: "error", message: res.statusText || "request failed" };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotDone = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === "token") yield { type: "token", text: String(parsed.text ?? "") };
      else if (event === "reset") yield { type: "reset" };
      else if (event === "tool") yield { type: "tool", name: String(parsed.name ?? ""), label: String(parsed.label ?? parsed.name ?? "") };
      else if (event === "error") yield { type: "error", message: String(parsed.message ?? "error") };
      else if (event === "done") {
        gotDone = true;
        yield {
          type: "done",
          content: String(parsed.content ?? ""),
          model: String(parsed.model ?? ""),
          cost: Number(parsed.cost ?? 0),
          dropped: Array.isArray(parsed.dropped) ? parsed.dropped.map(String) : [],
        };
      }
    }
  }
  if (!gotDone) yield { type: "error", message: "la conexión se cerró antes de terminar" };
}

/** Short label for the focus chip ("re: problème"). */
export function focusLabel(focus: TutorFocus | Record<string, unknown> | null | undefined): string {
  if (!focus || !("surface" in focus)) return "";
  const f = focus as TutorFocus;
  switch (f.surface) {
    case "exercise":
      return (f.expected || f.prompt || f.format).slice(0, 48);
    case "reference":
      return `${f.sheet}${f.section ? ` · ${f.section.replace(/-/g, " ")}` : ""}`;
    case "text":
      return f.selection || f.sentence.slice(0, 48);
    case "vocab":
      return f.french;
    default:
      return "";
  }
}
