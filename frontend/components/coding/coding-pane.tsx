"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  codingStatusLabel,
  getCodingTask,
  sendCodingAction,
  sendCodingMessage,
  streamCodingEvents,
  updateCodingTaskModel,
  type CodingEvent,
  type CodingTask,
  type CodingTransport,
  type CodingWorkspace,
} from "@/lib/api/coding";

function eventStatus(events: CodingEvent[], fallback: CodingTask["status"]): CodingTask["status"] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const type = events[index].type;
    if (type === "task_started") return "running";
    if (type === "approval_required" || type === "attention") return "attention";
    if (type === "task_interrupted") return "interrupted";
    if (type === "task_completed") return "completed";
    if (type === "task_failed") return "failed";
    if (type === "task_cancelled") return "cancelled";
  }
  return fallback;
}

type DiffFile = { path?: string; status?: string };
type DiffSection = { path: string; lines: string[] };

function diffLineClass(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "del";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("diff --git")) return "file";
  return "";
}

function splitPatch(patch: string, files: DiffFile[]): DiffSection[] {
  const sections: DiffSection[] = [];
  let current: DiffSection | null = null;
  for (const line of patch.split("\n")) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (match) {
      current = { path: match[2], lines: [line] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (sections.length) return sections;
  return [{
    path: files[0]?.path ?? "working tree",
    lines: patch ? patch.split("\n") : ["No textual patch is available for this file yet."],
  }];
}

function DiffSheet({ payload, onClose }: { payload: Record<string, unknown>; onClose: () => void }) {
  const patch = typeof payload.patch === "string" ? payload.patch : "No textual patch is available for this file yet.";
  const files = useMemo(() => Array.isArray(payload.files) ? payload.files as DiffFile[] : [], [payload.files]);
  const sections = useMemo(() => splitPatch(patch, files), [files, patch]);
  const [selectedPath, setSelectedPath] = useState(sections[0]?.path ?? "working tree");
  const selected = sections.find((section) => section.path === selectedPath) ?? sections[0];
  const additions = Number(payload.additions ?? (patch.match(/^\+(?!\+\+)/gm) ?? []).length);
  const deletions = Number(payload.deletions ?? (patch.match(/^-(?!--)/gm) ?? []).length);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="coding-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="coding-diff-sheet" role="dialog" aria-modal="true" aria-label="Code changes" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><span className="coding-eyebrow">review changes</span><h2>{files.length || 1} changed file{files.length === 1 ? "" : "s"}</h2></div>
          <div className="coding-diff-summary"><b>+{additions}</b><i>−{deletions}</i></div>
          <button type="button" onClick={onClose} aria-label="Close diff"><X className="size-4" /></button>
        </header>
        <div className="coding-diff-body">
          <aside aria-label="Changed files">
            {sections.map((section) => {
              const file = files.find((candidate) => candidate.path === section.path);
              const status = file?.status?.trim().split(/\s+/)[0] || "M";
              return <button type="button" key={section.path} className={selected?.path === section.path ? "is-active" : ""} onClick={() => setSelectedPath(section.path)}><i>{status}</i><span>{section.path}</span></button>;
            })}
          </aside>
          <div className="coding-diff-code">
            <div className="coding-diff-code-header"><span>{selected?.path}</span><small>unified diff</small></div>
            <pre className="coding-patch">{selected?.lines.map((line, index) => (
              <span key={index} className={diffLineClass(line)}>{line || " "}</span>
            ))}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CodingPane({
  task,
  workspaces,
  transport,
  focused,
  onFocus,
  onClose,
  onEvent,
  onWorkspaceChange,
  onDragStart,
  onDragEnd,
}: {
  task: CodingTask;
  workspaces: CodingWorkspace[];
  transport: CodingTransport;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onEvent: (taskId: string, event: CodingEvent) => void;
  onWorkspaceChange: (workspace: CodingWorkspace) => void;
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
  const working = status === "queued" || status === "running";
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
    localStorage.setItem(`coding-model-${transport}`, nextModel);
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
        <span className={`coding-status is-${status}`} title={codingStatusLabel(status)} />
        <div className="coding-pane-title">
          <strong>{task.title}</strong>
          {task.status === "draft" && workspaces.length > 0 ? (
            <select
              className="coding-workspace-picker"
              aria-label="Workspace"
              value={task.workspace_id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const workspace = workspaces.find((candidate) => candidate.id === event.target.value);
                if (workspace) onWorkspaceChange(workspace);
              }}
            >
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          ) : <span>{task.workspace_name}</span>}
        </div>
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
          <CodingTranscript events={events} busy={working} onApproval={(id, approved) => void approval(id, approved)} onOpenDiff={setDiff} />
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
      {diff && typeof document !== "undefined" && createPortal(
        <DiffSheet payload={diff} onClose={() => setDiff(null)} />,
        document.querySelector(".coding-shell") ?? document.body,
      )}
    </section>
  );
}
