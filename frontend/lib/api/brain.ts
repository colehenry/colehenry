import { z } from "zod";

import { API_URL, apiFetch } from "@/lib/api/client";

// --- Tree ---------------------------------------------------------------- //
export type TreeNode = {
  name: string;
  path: string | null;
  title: string | null;
  children: TreeNode[];
};

const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string().nullable(),
    title: z.string().nullable(),
    children: z.array(treeNodeSchema),
  }),
);

export function getTree(): Promise<TreeNode[]> {
  return apiFetch("/brain/tree", z.array(treeNodeSchema));
}

export const reindexSchema = z.object({ notes: z.number(), links: z.number() });
export function reindex(): Promise<z.infer<typeof reindexSchema>> {
  return apiFetch("/brain/reindex", reindexSchema, { method: "POST" });
}

// --- Note ---------------------------------------------------------------- //
export const noteLinkSchema = z.object({
  dst_path: z.string(),
  dst_note_id: z.number().nullable(),
  resolved: z.boolean(),
});

export const noteSchema = z.object({
  path: z.string(),
  title: z.string(),
  body_md: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  links: z.array(noteLinkSchema),
});
export type Note = z.infer<typeof noteSchema>;

export function getNote(path: string): Promise<Note> {
  return apiFetch(
    `/brain/note?path=${encodeURIComponent(path)}`,
    noteSchema,
  );
}

// --- Search -------------------------------------------------------------- //
export const searchHitSchema = z.object({
  path: z.string(),
  title: z.string(),
  snippet: z.string(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

export function search(q: string): Promise<SearchHit[]> {
  return apiFetch(
    `/brain/search?q=${encodeURIComponent(q)}`,
    z.array(searchHitSchema),
  );
}

// --- Graph --------------------------------------------------------------- //
export const graphSchema = z.object({
  nodes: z.array(z.object({ id: z.number(), path: z.string(), title: z.string() })),
  edges: z.array(z.object({ source: z.number(), target: z.number() })),
});
export type Graph = z.infer<typeof graphSchema>;

export function getGraph(): Promise<Graph> {
  return apiFetch("/brain/graph", graphSchema);
}

// --- Conversations ------------------------------------------------------- //
export const conversationSchema = z.object({
  id: z.number(),
  title: z.string(),
  updated_at: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  tool_calls: z
    .array(z.object({ name: z.string(), args: z.unknown(), label: z.string().optional() }))
    .nullable()
    .optional(),
  created_at: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

export const conversationDetailSchema = z.object({
  id: z.number(),
  title: z.string(),
  messages: z.array(messageSchema),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

export function getConversations(): Promise<Conversation[]> {
  return apiFetch("/brain/conversations", z.array(conversationSchema));
}
export function createConversation(): Promise<Conversation> {
  return apiFetch("/brain/conversations", conversationSchema, { method: "POST" });
}
export function getConversation(id: number): Promise<ConversationDetail> {
  return apiFetch(`/brain/conversations/${id}`, conversationDetailSchema);
}
export function deleteConversation(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/brain/conversations/${id}`, z.object({ ok: z.boolean() }), {
    method: "DELETE",
  });
}

// --- Chat (SSE stream) --------------------------------------------------- //
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatEvent =
  | { type: "token"; text: string }
  | { type: "tool"; name: string; args: unknown; label?: string }
  | { type: "error"; message: string }
  | { type: "reset" }
  | { type: "done" };

/** Read an SSE `event:/data:` stream into typed ChatEvents. */
async function* readSSE(res: Response): AsyncGenerator<ChatEvent> {
  if (!res.ok || !res.body) {
    yield { type: "error", message: res.statusText || "request failed" };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
      else if (event === "tool")
        yield {
          type: "tool",
          name: String(parsed.name ?? ""),
          args: parsed.args,
          label: parsed.label ? String(parsed.label) : undefined,
        };
      else if (event === "error")
        yield { type: "error", message: String(parsed.message ?? "error") };
      else if (event === "reset") yield { type: "reset" };
      else if (event === "done") yield { type: "done" };
    }
  }
}

/** Stateless chat (no persistence) — kept for completeness. */
export async function* streamBrainChat(
  messages: ChatMessage[],
  model: string | null,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${API_URL}/brain/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model }),
    signal,
  });
  yield* readSSE(res);
}

/** Send a message to a persisted conversation; the reply streams and both turns
 *  are saved server-side. */
export async function* streamConversationMessage(
  conversationId: number,
  content: string,
  model: string | null,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch(
    `${API_URL}/brain/conversations/${conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, model }),
      signal,
    },
  );
  yield* readSSE(res);
}

// Model picker options (valid OpenRouter slugs). Provider drives the logo.
export type ModelProvider = "anthropic" | "openai" | "google" | "deepseek" | "mistral";
export type ChatModel = {
  label: string;
  slug: string;
  provider: ModelProvider;
  hint?: string;
};

export const CHAT_MODELS: ChatModel[] = [
  { label: "Claude Sonnet 4.6", slug: "anthropic/claude-sonnet-4.6", provider: "anthropic", hint: "balanced" },
  { label: "Claude Opus 4.8", slug: "anthropic/claude-opus-4.8", provider: "anthropic", hint: "flagship" },
  { label: "Claude Haiku 4.5", slug: "anthropic/claude-haiku-4.5", provider: "anthropic", hint: "fast · cheap" },
  { label: "GPT-5.2", slug: "openai/gpt-5.2", provider: "openai", hint: "flagship" },
  { label: "GPT-5 mini", slug: "openai/gpt-5-mini", provider: "openai", hint: "cheap" },
  { label: "Gemini 2.5 Pro", slug: "google/gemini-2.5-pro", provider: "google" },
  { label: "Gemini 2.5 Flash", slug: "google/gemini-2.5-flash", provider: "google", hint: "fast" },
  { label: "DeepSeek V3.2", slug: "deepseek/deepseek-v3.2", provider: "deepseek", hint: "cheap" },
  { label: "Mistral Nemo", slug: "mistralai/mistral-nemo", provider: "mistral", hint: "language · cheapest" },
];
