"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  FileText,
  FolderTree,
  Globe,
  Menu,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import {
  CHAT_MODELS,
  createConversation,
  deleteConversation,
  getConversation,
  getConversations,
  streamConversationMessage,
} from "@/lib/api/brain";
import { ModelPicker } from "@/components/brain/model-picker";

type Turn = {
  role: "user" | "assistant";
  content: string;
  tools?: { name: string; args: unknown; label?: string }[];
};

function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function toolLabel(t: { name: string; args: unknown; label?: string }): string {
  if (t.label) return t.label;
  const a = (t.args ?? {}) as { path?: string; query?: string };
  if (t.name === "search") return `searching "${a.query ?? ""}"`;
  if (t.name === "neighbors") return `mapping links from ${a.path ?? ""}`;
  return `reading ${a.path ?? ""}`;
}

const UserLabel = () => <span className="term-user">colehenry</span>;
const BrainLabel = () => <span className="term-brain">brain</span>;

export function BrainChat() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(CHAT_MODELS[0].slug);
  const [busy, setBusy] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bootstrapped = useRef(false);

  // Keep the terminal prompt focused whenever the agent isn't replying.
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const convsQ = useQuery({
    queryKey: ["brain", "conversations"],
    queryFn: getConversations,
  });

  const scrollToEnd = () =>
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
    );

  // On first load, open the most recent conversation (if any).
  useEffect(() => {
    if (bootstrapped.current || !convsQ.data) return;
    bootstrapped.current = true;
    if (convsQ.data.length > 0) void openConversation(convsQ.data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convsQ.data]);

  async function openConversation(id: number) {
    setActiveId(id);
    setRailOpen(false);
    const detail = await getConversation(id);
    setMessages(
      detail.messages.map((m) => ({
        role: m.role,
        content: m.content,
        tools: m.tool_calls ?? [],
      })),
    );
    scrollToEnd();
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setRailOpen(false);
  }

  async function removeConversation(id: number) {
    await deleteConversation(id);
    queryClient.invalidateQueries({ queryKey: ["brain", "conversations"] });
    if (id === activeId) newChat();
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    let id = activeId;
    if (id == null) {
      const conv = await createConversation();
      id = conv.id;
      setActiveId(id);
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", tools: [] },
    ]);
    scrollToEnd();

    try {
      for await (const ev of streamConversationMessage(id, text, model)) {
        if (ev.type === "token") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              content: last.content + ev.text,
            };
            return next;
          });
          scrollToEnd();
        } else if (ev.type === "tool") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              tools: [
                ...(last.tools ?? []),
                { name: ev.name, args: ev.args, label: ev.label },
              ],
            };
            return next;
          });
          scrollToEnd();
        } else if (ev.type === "reset") {
          // Drop pre-tool "let me check…" chatter; keep the tool trail.
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: "" };
            return next;
          });
        } else if (ev.type === "error") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              content: last.content || `⚠ ${ev.message}`,
            };
            return next;
          });
        }
      }
    } finally {
      setBusy(false);
      // Refresh the rail (title + ordering) now that the turn is saved.
      queryClient.invalidateQueries({ queryKey: ["brain", "conversations"] });
    }
  }

  const conversations = convsQ.data ?? [];

  const rail = (
    <div className="brain-term-rail flex h-full flex-col border-r">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="term-prompt text-xs">~/chats</span>
        <button
          type="button"
          onClick={newChat}
          className="inline-flex items-center gap-1 rounded border border-[var(--term-line)] px-2 py-1 text-xs text-[var(--term-fg)] hover:border-[var(--term-accent)]"
        >
          <Plus className="size-3" /> new
        </button>
      </div>
      <div className="brain-term-scroll flex-1 overflow-y-auto px-2">
        {conversations.length === 0 && (
          <p className="px-2 py-3 text-xs text-[var(--term-dim)]">
            No conversations yet.
          </p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded px-2 py-1.5 text-sm ${
              c.id === activeId
                ? "bg-[rgba(169,139,255,0.12)] text-[var(--term-fg)]"
                : "text-[var(--term-dim)] hover:text-[var(--term-fg)]"
            }`}
          >
            <button
              type="button"
              onClick={() => openConversation(c.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="truncate">{c.title}</span>
              <span className="ml-auto shrink-0 text-[10px] text-[var(--term-dim)]">
                {relTime(c.updated_at)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeConversation(c.id)}
              className="shrink-0 opacity-0 transition-opacity hover:text-[var(--term-accent)] group-hover:opacity-100"
              aria-label="Delete conversation"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Link
        href="/brain/notes"
        className="flex items-center gap-2 border-t border-[var(--term-line)] px-4 py-3 text-sm text-[var(--term-dim)] hover:text-[var(--term-accent)]"
      >
        <FolderTree className="size-4" /> browse notes
      </Link>
    </div>
  );

  return (
    <div className="brain-term grid h-[calc(100vh-3.5rem)] grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
      {/* Desktop rail */}
      <aside className="hidden md:block">{rail}</aside>

      {/* Mobile rail drawer */}
      {railOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setRailOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute inset-y-0 left-0 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            {rail}
          </div>
        </div>
      )}

      {/* Chat column */}
      <section className="flex min-h-0 flex-col">
        {/* Header — conversation title + model picker (all sizes) */}
        <header className="flex items-center gap-2 border-b border-[var(--term-line)] px-3 py-2">
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            aria-label="History"
            className="md:hidden"
          >
            <Menu className="size-5 text-[var(--term-fg)]" />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--term-dim)]">
            {conversations.find((c) => c.id === activeId)?.title ?? "new chat"}
          </span>
          <ModelPicker model={model} onChange={setModel} />
          <button
            type="button"
            onClick={newChat}
            className="md:hidden"
            aria-label="New chat"
          >
            <Plus className="size-5 text-[var(--term-fg)]" />
          </button>
        </header>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="brain-term-scroll flex-1 overflow-y-auto px-4 py-5"
        >
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.length === 0 && (
              <div className="flex items-baseline gap-2.5">
                <BrainLabel />
                <span className="text-[var(--term-fg)]">how can I help?</span>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex gap-2.5">
                  <UserLabel />
                  <span className="min-w-0 whitespace-pre-wrap text-[var(--term-fg)]">
                    {m.content}
                  </span>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <BrainLabel />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {m.content === "" &&
                      (m.tools ?? []).length === 0 &&
                      busy &&
                      i === messages.length - 1 && (
                        <div className="term-tool animate-pulse text-xs">
                          working…
                        </div>
                      )}
                    {(m.tools ?? []).map((t, j) => (
                      <div
                        key={j}
                        className="term-tool flex items-center gap-1.5 text-xs leading-none"
                      >
                        {t.name === "web_search" ? (
                          <Globe className="size-3.5 shrink-0" />
                        ) : t.name === "search" ? (
                          <Search className="size-3.5 shrink-0" />
                        ) : (
                          <FileText className="size-3.5 shrink-0" />
                        )}
                        <span>{toolLabel(t)}</span>
                      </div>
                    ))}
                    <div className="brain-term-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                      {busy && i === messages.length - 1 && (
                        <span className="term-cursor align-middle" />
                      )}
                    </div>
                  </div>
                </div>
              ),
            )}

            {/* Active terminal prompt — inline input at the end of the log */}
            {!busy && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-center gap-2.5"
              >
                <UserLabel />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  autoFocus
                  aria-label="Message"
                  className="brain-term-input min-w-0 flex-1 bg-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--term-accent)] text-white transition-opacity disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
