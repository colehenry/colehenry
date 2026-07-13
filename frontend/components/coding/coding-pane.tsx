"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  GitBranch,
  GripVertical,
  PanelBottom,
  Square,
  Terminal,
  X,
} from "lucide-react";

import { ModelPicker } from "@/components/brain/model-picker";
import { CodingTranscript } from "@/components/coding/coding-transcript";
import {
  getCodingTask,
  sendCodingAction,
  sendCodingMessage,
  streamCodingEvents,
  updateCodingTaskModel,
  type CodingEvent,
  type CodingTask,
  type CodingTransport,
} from "@/lib/api/coding";

function eventStatus(events: CodingEvent[], fallback: CodingTask["status"]): CodingTask["status"] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const type = events[index].type;
    if (type === "task_started") return "running";
    if (type === "approval_required" || type === "attention") return "attention";
    if (type === "task_completed") return "completed";
    if (type === "task_failed") return "failed";
    if (type === "task_cancelled") return "cancelled";
  }
  return fallback;
}

function DiffSheet({ payload, onClose }: { payload: Record<string, unknown>; onClose: () => void }) {
  const patch = typeof payload.patch === "string" ? payload.patch : "No textual patch is available for this file yet.";
  const files = Array.isArray(payload.files) ? payload.files as { path?: string; status?: string }[] : [];
  return (
    <div className="coding-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="coding-diff-sheet" role="dialog" aria-modal="true" aria-label="Code changes" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="coding-eyebrow">working tree</span><h2>{files.length || 1} changed file{files.length === 1 ? "" : "s"}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close diff"><X className="size-4" /></button>
        </header>
        {files.length > 0 && <div className="coding-diff-files">{files.map((file, index) => <span key={`${file.path}-${index}`}><i>{file.status || "M"}</i>{file.path}</span>)}</div>}
        <pre className="coding-patch">{patch.split("\n").map((line, index) => (
          <span key={index} className={line.startsWith("+") && !line.startsWith("+++") ? "add" : line.startsWith("-") && !line.startsWith("---") ? "del" : line.startsWith("@@") ? "hunk" : ""}>{line || " "}</span>
        ))}</pre>
      </section>
    </div>
  );
}

export function CodingPane({
  task,
  transport,
  focused,
  onFocus,
  onClose,
  onEvent,
  onDragStart,
  onDragEnd,
}: {
  task: CodingTask;
  transport: CodingTransport;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onEvent: (taskId: string, event: CodingEvent) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["coding", transport, "task", task.id],
    queryFn: () => getCodingTask(transport, task.id),
  });
  const [liveEvents, setLiveEvents] = useState<CodingEvent[]>([]);
  const [model, setModel] = useState(task.model);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [diff, setDiff] = useState<Record<string, unknown> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastSeq = useRef(0);

  const events = useMemo(() => {
    const merged = [...(detailQuery.data?.events ?? []), ...liveEvents];
    return [...new Map(merged.map((event) => [event.seq, event])).values()].sort((a, b) => a.seq - b.seq);
  }, [detailQuery.data?.events, liveEvents]);

  useEffect(() => {
    if (!detailQuery.data) return;
    lastSeq.current = Math.max(lastSeq.current, detailQuery.data.events.at(-1)?.seq ?? 0);
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of streamCodingEvents(transport, task.id, lastSeq.current, controller.signal)) {
          if (event.seq <= lastSeq.current) continue;
          lastSeq.current = event.seq;
          setLiveEvents((current) => [...current, event]);
          onEvent(task.id, event);
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error(error);
      }
    })();
    return () => controller.abort();
  }, [detailQuery.data, onEvent, task.id, transport]);

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 180;
    if (nearBottom) requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight }));
  }, [events]);

  const status = eventStatus(events, task.status);
  const busy = status === "queued" || status === "running" || status === "attention";
  const terminal = useMemo(
    () => events.filter((event) => event.type === "command_output").map((event) => String(event.payload.text ?? "")).join(""),
    [events],
  );

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    try {
      await sendCodingMessage(transport, task.id, content, model);
    } finally {
      setSending(false);
    }
  }

  function changeModel(nextModel: string) {
    const previous = model;
    setModel(nextModel);
    void updateCodingTaskModel(transport, task.id, nextModel).catch(() => setModel(previous));
  }

  async function approval(approvalId: string, approved: boolean) {
    await sendCodingAction(transport, task.id, "approval_response", {
      approval_id: approvalId,
      approved,
    });
  }

  return (
    <section className={`coding-pane ${focused ? "is-focused" : ""}`} onMouseDown={onFocus}>
      <header className="coding-pane-header" draggable onDragStart={(event) => { event.dataTransfer.setData("text/task-id", task.id); onDragStart(); }} onDragEnd={onDragEnd}>
        <GripVertical className="coding-pane-grip size-3.5" />
        <span className={`coding-status is-${status}`} title={status} />
        <div className="coding-pane-title"><strong>{task.title}</strong><span>{task.workspace_name}</span></div>
        <div className="coding-pane-meta">
          {task.branch && <span title={task.branch}><GitBranch className="size-3" /><b>branch</b>{task.branch}</span>}
          <ModelPicker model={model} onChange={changeModel} />
          <button type="button" onClick={() => setTerminalOpen((open) => !open)} title="Toggle terminal output" aria-label="Toggle terminal output"><PanelBottom className="size-3.5" /></button>
          {busy && <button type="button" onClick={() => void sendCodingAction(transport, task.id, "cancel")} title="Stop agent" aria-label="Stop agent"><Square className="size-3 fill-current" /></button>}
          <button type="button" onClick={onClose} title="Close pane" aria-label="Close pane"><X className="size-3.5" /></button>
        </div>
      </header>

      <div ref={transcriptRef} className="coding-pane-scroll">
        {detailQuery.isLoading ? <div className="coding-loading">connecting<span className="coding-cursor" /></div> : detailQuery.isError ? <div className="coding-load-error">Could not load task. Is the local agent running?</div> : (
          <CodingTranscript events={events} busy={busy} onApproval={(id, approved) => void approval(id, approved)} onOpenDiff={setDiff} />
        )}
      </div>

      {terminalOpen && (
        <div className="coding-terminal-drawer">
          <header><span><Terminal className="size-3.5" /> output</span><button type="button" onClick={() => setTerminalOpen(false)}><X className="size-3.5" /></button></header>
          <pre>{terminal || "$ No command output yet."}</pre>
        </div>
      )}

      <div className="coding-composer">
        <textarea
          autoFocus={focused && events.length === 0}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={status === "attention" ? "Approve above or give the agent another direction…" : "Ask the agent…"}
          aria-label="Message agent"
        />
        <button type="button" disabled={!input.trim() || sending} onClick={() => void send()} aria-label="Send message"><ArrowUp className="size-4" /></button>
        <span>↵ send · ⇧↵ newline</span>
      </div>
      {diff && <DiffSheet payload={diff} onClose={() => setDiff(null)} />}
    </section>
  );
}
