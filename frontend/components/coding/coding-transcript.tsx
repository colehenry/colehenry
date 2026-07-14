"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleEllipsis,
  FileDiff,
  Play,
  ShieldQuestion,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { CodingEvent } from "@/lib/api/coding";

type TranscriptItem =
  | { kind: "user"; id: string; content: string }
  | { kind: "assistant"; id: string; content: string; streaming: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      label: string;
      args: unknown;
      done: boolean;
      ok: boolean;
      summary: string;
    }
  | { kind: "diff"; id: string; payload: Record<string, unknown> }
  | {
      kind: "approval";
      id: string;
      approvalId: string;
      tool: string;
      details: Record<string, unknown>;
      response?: boolean;
    }
  | { kind: "notice"; id: string; tone: "muted" | "attention" | "error" | "ok"; content: string };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildTranscript(events: CodingEvent[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const assistants = new Map<string, Extract<TranscriptItem, { kind: "assistant" }>>();
  const tools = new Map<string, Extract<TranscriptItem, { kind: "tool" }>>();
  const approvals = new Map<string, Extract<TranscriptItem, { kind: "approval" }>>();
  for (const event of events) {
    const payload = event.payload;
    if (event.type === "user_message") {
      items.push({ kind: "user", id: `user-${event.seq}`, content: text(payload.content) });
    } else if (event.type === "assistant_delta") {
      const id = text(payload.turn_id) || `assistant-${event.seq}`;
      let item = assistants.get(id);
      if (!item) {
        item = { kind: "assistant", id, content: "", streaming: true };
        assistants.set(id, item);
        items.push(item);
      }
      item.content += text(payload.text);
    } else if (event.type === "assistant_message") {
      const id = text(payload.turn_id) || `assistant-${event.seq}`;
      const existing = assistants.get(id);
      if (existing) {
        existing.content = text(payload.content) || existing.content;
        existing.streaming = false;
      } else {
        const item = { kind: "assistant" as const, id, content: text(payload.content), streaming: false };
        assistants.set(id, item);
        items.push(item);
      }
    } else if (event.type === "tool_started") {
      const id = text(payload.id) || `tool-${event.seq}`;
      const item = {
        kind: "tool" as const,
        id,
        name: text(payload.name),
        label: text(payload.label) || text(payload.name),
        args: payload.args,
        done: false,
        ok: true,
        summary: "",
      };
      tools.set(id, item);
      items.push(item);
    } else if (event.type === "tool_finished") {
      const item = tools.get(text(payload.id));
      if (item) {
        item.done = true;
        item.ok = payload.ok !== false;
        item.summary = text(payload.summary);
      }
    } else if (event.type === "diff") {
      items.push({ kind: "diff", id: `diff-${event.seq}`, payload });
    } else if (event.type === "approval_required") {
      const approvalId = text(payload.approval_id);
      const item = {
        kind: "approval" as const,
        id: `approval-${event.seq}`,
        approvalId,
        tool: text(payload.tool),
        details: (payload.details as Record<string, unknown>) ?? {},
      };
      approvals.set(approvalId, item);
      items.push(item);
    } else if (event.type === "user_action" && payload.type === "approval_response") {
      const response = payload.payload as Record<string, unknown> | undefined;
      const item = approvals.get(text(response?.approval_id));
      if (item) item.response = Boolean(response?.approved);
    } else if (event.type === "activity") {
      items.push({ kind: "notice", id: `activity-${event.seq}`, tone: "muted", content: text(payload.label) });
    } else if (event.type === "attention") {
      items.push({ kind: "notice", id: `attention-${event.seq}`, tone: "attention", content: text(payload.message) || "Agent needs attention" });
    } else if (event.type === "task_failed") {
      items.push({ kind: "notice", id: `failed-${event.seq}`, tone: "error", content: text(payload.message) || "Task failed" });
    } else if (event.type === "task_completed") {
      items.push({ kind: "notice", id: `complete-${event.seq}`, tone: "ok", content: text(payload.message) || "Agent finished" });
    } else if (event.type === "task_cancelled") {
      items.push({ kind: "notice", id: `cancelled-${event.seq}`, tone: "muted", content: "Task cancelled" });
    } else if (event.type === "task_interrupted") {
      items.push({ kind: "notice", id: `interrupted-${event.seq}`, tone: "error", content: text(payload.message) || "Agent stopped before this task finished" });
    }
  }
  return items;
}

function DiffCard({
  payload,
  onOpen,
}: {
  payload: Record<string, unknown>;
  onOpen: (payload: Record<string, unknown>) => void;
}) {
  const files = Array.isArray(payload.files) ? payload.files : [];
  const additions = Number(payload.additions ?? 0);
  const deletions = Number(payload.deletions ?? 0);
  return (
    <button type="button" className="coding-diff-card" onClick={() => onOpen(payload)}>
      <FileDiff className="size-4" />
      <span>{files.length || 1} file{files.length === 1 ? "" : "s"} changed</span>
      {(additions > 0 || deletions > 0) && (
        <span className="coding-diff-count"><b>+{additions}</b> <i>−{deletions}</i></span>
      )}
      <span className="coding-diff-review">review <ChevronRight className="size-3" /></span>
    </button>
  );
}

export function CodingTranscript({
  events,
  busy,
  onApproval,
  onOpenDiff,
}: {
  events: CodingEvent[];
  busy: boolean;
  onApproval: (approvalId: string, approved: boolean) => void;
  onOpenDiff: (payload: Record<string, unknown>) => void;
}) {
  const items = useMemo(() => buildTranscript(events), [events]);
  return (
    <div className="coding-transcript">
      {items.length === 0 && (
        <div className="coding-empty-task"><span>$</span> waiting for the first instruction<span className="coding-cursor" /></div>
      )}
      {items.map((item) => {
        if (item.kind === "user") {
          return <div key={item.id} className="coding-turn coding-turn-user"><span className="coding-speaker">you</span><p>{item.content}</p></div>;
        }
        if (item.kind === "assistant") {
          return (
            <div key={item.id} className="coding-turn coding-turn-agent">
              <span className="coding-speaker">agent</span>
              <div className="coding-prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>{item.streaming && <span className="coding-cursor" />}</div>
            </div>
          );
        }
        if (item.kind === "tool") {
          return (
            <details key={item.id} className={`coding-tool ${item.done ? (item.ok ? "is-done" : "is-error") : "is-running"}`}>
              <summary>
                {item.done ? (item.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />) : <CircleEllipsis className="size-3.5 animate-pulse" />}
                <span>{item.label}</span>
                <ChevronRight className="coding-tool-chevron size-3" />
              </summary>
              <pre>{item.summary || JSON.stringify(item.args, null, 2)}</pre>
            </details>
          );
        }
        if (item.kind === "diff") return <DiffCard key={item.id} payload={item.payload} onOpen={onOpenDiff} />;
        if (item.kind === "approval") {
          const command = text(item.details.command);
          const path = text(item.details.path);
          return (
            <div key={item.id} className="coding-approval">
              <div className="coding-approval-title"><ShieldQuestion className="size-4" /><span>{item.tool === "run_command" ? "Run command?" : "Apply file change?"}</span></div>
              <code>{command || path || JSON.stringify(item.details)}</code>
              {item.response === undefined ? (
                <div className="coding-approval-actions">
                  <button type="button" onClick={() => onApproval(item.approvalId, false)}><X className="size-3.5" /> deny</button>
                  <button type="button" className="approve" onClick={() => onApproval(item.approvalId, true)}><Play className="size-3.5" /> approve</button>
                </div>
              ) : (
                <span className="coding-approval-result">{item.response ? "approved" : "denied"}</span>
              )}
            </div>
          );
        }
        return (
          <div key={item.id} className={`coding-notice is-${item.tone}`}>
            {item.tone === "error" || item.tone === "attention" ? <AlertTriangle className="size-3.5" /> : item.tone === "ok" ? <Check className="size-3.5" /> : <span>·</span>}
            <span>{item.content}</span>
          </div>
        );
      })}
      {busy && items.at(-1)?.kind !== "assistant" && <div className="coding-working"><CircleEllipsis className="size-3.5 animate-pulse" /> working</div>}
    </div>
  );
}
