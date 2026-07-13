"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderTree,
  Globe,
  History,
  PanelLeft,
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
import { BrainDrawer } from "@/components/brain/brain-drawer";
import { ModelPicker } from "@/components/brain/model-picker";

type Turn = {
  role: "user" | "assistant";
  content: string;
  tools?: { name: string; args: unknown; label?: string }[];
};

type Exchange = { id: number; turns: { turn: Turn; index: number }[] };

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

function toExchanges(messages: Turn[]): Exchange[] {
  const exchanges: Exchange[] = [];
  messages.forEach((turn, index) => {
    if (turn.role === "user" || exchanges.length === 0) {
      exchanges.push({ id: index, turns: [{ turn, index }] });
      return;
    }
    exchanges[exchanges.length - 1].turns.push({ turn, index });
  });
  return exchanges;
}

function displayChatTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "new chat";
  const clipped = normalized.slice(0, 42).trimEnd();
  return clipped.length < normalized.length ? `${clipped}…` : clipped;
}

const UserLabel = () => <span className="term-user">colehenry</span>;
const BrainLabel = () => <span className="term-brain">brain</span>;

export function BrainChat() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeTitle, setActiveTitle] = useState("new chat");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(CHAT_MODELS[0].slug);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [hasUnreadOutput, setHasUnreadOutput] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bootstrapped = useRef(false);
  const nearBottomRef = useRef(true);

  const convsQ = useQuery({
    queryKey: ["brain", "conversations"],
    queryFn: getConversations,
  });
  const conversations = convsQ.data ?? [];
  const selectedModel = CHAT_MODELS.find((candidate) => candidate.slug === model) ?? CHAT_MODELS[0];
  const exchanges = useMemo(() => toExchanges(messages), [messages]);
  const earlierExchanges = exchanges.length > 3 ? exchanges.slice(0, -3) : [];
  const visibleExchanges = earlierExchanges.length === 0 ? exchanges : exchanges.slice(-3);

  function resizeInput() {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 144)}px`;
  }

  useEffect(() => {
    resizeInput();
  }, [input]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  function scrollToEnd(behavior: ScrollBehavior = "auto") {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior });
      nearBottomRef.current = true;
      setCanScrollUp(node.scrollTop > 8);
      setHasUnreadOutput(false);
    });
  }

  function followOutput() {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      if (nearBottomRef.current) {
        node.scrollTo({ top: node.scrollHeight });
      } else {
        setHasUnreadOutput(true);
      }
    });
  }

  function handleTranscriptScroll() {
    const node = scrollRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
    nearBottomRef.current = nearBottom;
    setCanScrollUp(node.scrollTop > 8);
    if (nearBottom) setHasUnreadOutput(false);
  }

  function scrollPage(direction: "up" | "down") {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollBy({
      top: node.clientHeight * 0.78 * (direction === "up" ? -1 : 1),
      behavior: "smooth",
    });
  }

  useEffect(() => {
    if (bootstrapped.current || !convsQ.data) return;
    bootstrapped.current = true;
    if (convsQ.data.length > 0) void openConversation(convsQ.data[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convsQ.data]);

  async function openConversation(id: number) {
    setActiveId(id);
    setDrawerOpen(false);
    setEarlierOpen(false);
    const detail = await getConversation(id);
    setActiveTitle(detail.title);
    setMessages(
      detail.messages.map((message) => ({
        role: message.role,
        content: message.content,
        tools: message.tool_calls ?? [],
      })),
    );
    scrollToEnd();
  }

  function newChat() {
    setActiveId(null);
    setActiveTitle("new chat");
    setMessages([]);
    setEarlierOpen(false);
    setDrawerOpen(false);
    setHasUnreadOutput(false);
  }

  async function removeConversation(id: number) {
    await deleteConversation(id);
    queryClient.invalidateQueries({ queryKey: ["brain", "conversations"] });
    if (id === activeId) newChat();
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const isNewConversation = activeId == null;

    setInput("");
    setBusy(true);
    setEarlierOpen(false);

    let id = activeId;
    if (id == null) {
      const conversation = await createConversation();
      id = conversation.id;
      setActiveId(id);
      setActiveTitle("naming chat…");
    }

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
      { role: "assistant", content: "", tools: [] },
    ]);
    scrollToEnd();

    try {
      for await (const event of streamConversationMessage(id, text, model)) {
        if (event.type === "token") {
          setMessages((previous) => {
            const next = [...previous];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + event.text };
            return next;
          });
          followOutput();
        } else if (event.type === "tool") {
          setMessages((previous) => {
            const next = [...previous];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              tools: [...(last.tools ?? []), { name: event.name, args: event.args, label: event.label }],
            };
            return next;
          });
          followOutput();
        } else if (event.type === "reset") {
          setMessages((previous) => {
            const next = [...previous];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: "" };
            return next;
          });
        } else if (event.type === "error") {
          setMessages((previous) => {
            const next = [...previous];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content || `⚠ ${event.message}` };
            return next;
          });
        }
      }
    } catch {
      setMessages((previous) => {
        const next = [...previous];
        const last = next[next.length - 1];
        next[next.length - 1] = {
          ...last,
          content: last.content || "⚠ Connection failed before Brain could respond. Please try again.",
        };
        return next;
      });
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: ["brain", "conversations"] });
      if (isNewConversation) {
        try {
          const detail = await getConversation(id);
          setActiveTitle(detail.title);
        } catch {
          // A title is cosmetic; the list refresh above will retry it naturally.
        }
      }
    }
  }

  function renderTurn({ turn, index }: { turn: Turn; index: number }) {
    if (turn.role === "user") {
      return (
        <div key={index} className="brain-turn">
          <UserLabel />
          <span className="min-w-0 whitespace-pre-wrap text-[var(--term-fg)]">{turn.content}</span>
        </div>
      );
    }

    const isActiveReply = busy && index === messages.length - 1;
    const displayContent = turn.content || (isActiveReply ? "" : "⚠ Reply ended before Brain produced an answer. Please try again.");

    return (
      <div key={index} className="brain-turn">
        <BrainLabel />
        <div className="min-w-0 flex-1 space-y-1.5">
          {turn.content === "" && (turn.tools ?? []).length === 0 && isActiveReply && (
            <div className="term-tool animate-pulse text-xs">working…</div>
          )}
          {(turn.tools ?? []).map((tool, toolIndex) => (
            <div key={toolIndex} className="term-tool flex items-center gap-1.5 text-xs leading-none">
              {tool.name === "web_search" ? <Globe className="size-3.5 shrink-0" /> : tool.name === "search" ? <Search className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
              <span>{toolLabel(tool)}</span>
            </div>
          ))}
          <div className="brain-term-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
            {isActiveReply && <span className="term-cursor align-middle" />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="brain-term brain-workspace">
      <BrainDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Conversation history" side="right">
        <div className="brain-drawer-panel flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--term-line)] px-4 py-3">
            <span className="term-prompt text-xs">~/chats</span>
            <button type="button" onClick={newChat} className="brain-control brain-control-small">
              <Plus className="size-3.5" /> new
            </button>
          </div>
          <div className="brain-term-scroll flex-1 overflow-y-auto p-2">
            {conversations.length === 0 && <p className="px-2 py-3 text-xs text-[var(--term-dim)]">No conversations yet.</p>}
            {conversations.map((conversation) => (
              <div key={conversation.id} className={`group flex items-center gap-1 rounded-md px-2 py-2 text-sm ${conversation.id === activeId ? "bg-[rgba(169,139,255,0.12)] text-[var(--term-fg)]" : "text-[var(--term-dim)] hover:text-[var(--term-fg)]"}`}>
                <button type="button" onClick={() => void openConversation(conversation.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="truncate">{displayChatTitle(conversation.title)}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-[var(--term-dim)]">{relTime(conversation.updated_at)}</span>
                </button>
                <button type="button" onClick={() => void removeConversation(conversation.id)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--term-dim)] hover:text-[var(--term-accent)] sm:size-auto sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label={`Delete ${conversation.title}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Link href="/brain/notes" className="flex items-center gap-2 border-t border-[var(--term-line)] px-4 py-3 text-sm text-[var(--term-dim)] hover:text-[var(--term-accent)]">
            <FolderTree className="size-4" /> browse notes
          </Link>
        </div>
      </BrainDrawer>

      <section className="flex min-h-0 flex-1 flex-col">
        <header className="brain-workspace-header">
          <div className="brain-workspace-header-inner">
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--term-dim)]">{displayChatTitle(activeTitle)}</span>
            <div className="hidden sm:block"><ModelPicker model={model} onChange={setModel} /></div>
            <button type="button" onClick={newChat} className="brain-icon-control" aria-label="New chat">
              <Plus className="size-4" />
            </button>
            <button type="button" onClick={() => setDrawerOpen((open) => !open)} className="brain-icon-control" aria-label={drawerOpen ? "Close conversation history" : "Open conversation history"}>
              <PanelLeft className="size-4" />
            </button>
          </div>
        </header>

        <div ref={scrollRef} onScroll={handleTranscriptScroll} className="brain-term-scroll relative min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center py-10">
              <div className="brain-welcome w-full">
                <div className="mb-5 flex items-center gap-2 text-xs text-[var(--term-dim)]"><span className="brain-status-dot" /> brain // online</div>
                <div className="flex items-baseline gap-2.5 text-lg"><BrainLabel /><span>ready when you are.</span></div>
                <div className="brain-boot-status mt-6">
                  <span>vault connected</span>
                  <span>{conversations.length} saved {conversations.length === 1 ? "session" : "sessions"}</span>
                  <span>{selectedModel.label}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 pb-4">
              {earlierExchanges.length > 0 && !earlierOpen && (
                <button type="button" onClick={() => setEarlierOpen(true)} className="brain-earlier-toggle">
                  <History className="size-3.5" /> earlier session · {earlierExchanges.length} exchanges <ChevronDown className="size-3.5" />
                </button>
              )}
              {earlierOpen && earlierExchanges.length > 0 && (
                <div className="space-y-6">
                  <button type="button" onClick={() => setEarlierOpen(false)} className="brain-earlier-toggle">
                    <ChevronUp className="size-3.5" /> collapse earlier session
                  </button>
                  {earlierExchanges.map((exchange) => <div key={exchange.id} className="space-y-5">{exchange.turns.map(renderTurn)}</div>)}
                </div>
              )}
              {visibleExchanges.map((exchange) => <div key={exchange.id} className="space-y-5">{exchange.turns.map(renderTurn)}</div>)}
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <div className="brain-scroll-rail" aria-label="Transcript navigation">
            <button type="button" onClick={() => scrollPage("up")} disabled={!canScrollUp} className="brain-scroll-button" aria-label="Scroll transcript up"><ChevronUp className="size-4" /></button>
            <button type="button" onClick={() => hasUnreadOutput ? scrollToEnd("smooth") : scrollPage("down")} className={`brain-scroll-button ${hasUnreadOutput ? "brain-scroll-button-active" : ""}`} aria-label={hasUnreadOutput ? "Jump to latest" : "Scroll transcript down"}>
              {hasUnreadOutput ? <ArrowDown className="size-4" /> : <ChevronDown className="size-4" />}
              {hasUnreadOutput && <span className="sr-only">Jump to latest</span>}
            </button>
          </div>
        )}

        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="brain-composer">
          <div className="brain-composer-shell mx-auto max-w-3xl">
            <div className="brain-mobile-composer-meta sm:hidden">
              <div className="flex items-center gap-2"><UserLabel /><span className="term-prompt text-[10px]">~/input</span></div>
              <ModelPicker model={model} onChange={setModel} placement="up" />
            </div>
            <div className="flex items-start gap-2.5">
              <span className="hidden sm:inline"><UserLabel /></span>
              <textarea
                ref={inputRef}
                value={input}
                disabled={busy}
                rows={1}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder={busy ? "brain is working…" : "ask brain…"}
                aria-label="Message"
                className="brain-term-input min-h-7 max-h-36 min-w-0 flex-1 resize-none bg-transparent py-0.5 outline-none disabled:cursor-wait"
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="brain-send-button">
                <ArrowUp className="size-4" />
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
