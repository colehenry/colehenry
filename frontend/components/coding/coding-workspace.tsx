"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Cloud,
  Columns2,
  ExternalLink,
  Laptop,
  PanelRightOpen,
  Plus,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { ModelPicker } from "@/components/brain/model-picker";
import { CodingPane } from "@/components/coding/coding-pane";
import {
  createCodingTask,
  createPairingCode,
  closeCodingTask,
  defaultCodingTransport,
  getCodingDevices,
  getCodingTasks,
  type CodingEvent,
  type CodingTask,
  type CodingTransport,
} from "@/lib/api/coding";
import { CHAT_MODELS } from "@/lib/api/brain";

type AlertKind = "completed" | "attention" | "failed";
type SplitRatio = { column: number; row: number };

function snapLabels(count: number): string[] {
  if (count === 2) return ["left", "right"];
  if (count === 3) return ["left", "top right", "bottom right"];
  return ["top left", "top right", "bottom left", "bottom right"];
}

function playDing(kind: AlertKind) {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const notes = kind === "completed" ? [659, 880] : kind === "attention" ? [740, 554] : [220, 174];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === "failed" ? "sawtooth" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + index * 0.1 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.1 + 0.24);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + index * 0.1);
    oscillator.stop(context.currentTime + index * 0.1 + 0.26);
  });
  window.setTimeout(() => void context.close(), 700);
}

function statusLabel(status: CodingTask["status"]) {
  if (status === "draft") return "ready";
  if (status === "attention") return "needs you";
  return status;
}

function subscribeClient() {
  return () => {};
}

function subscribeLayout(callback: () => void) {
  window.addEventListener("coding-layout", callback);
  return () => window.removeEventListener("coding-layout", callback);
}

function NewTaskDialog({
  transport,
  onClose,
  onCreated,
}: {
  transport: CodingTransport;
  onClose: () => void;
  onCreated: (task: CodingTask) => void;
}) {
  const devicesQuery = useQuery({
    queryKey: ["coding", transport, "devices"],
    queryFn: () => getCodingDevices(transport),
    refetchInterval: 5_000,
  });
  const devices = devicesQuery.data ?? [];
  const [deviceId, setDeviceId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [model, setModel] = useState(CHAT_MODELS[0].slug);
  const [isolated, setIsolated] = useState(true);
  const [pairing, setPairing] = useState<{ code: string; expires_at: string } | null>(null);

  const device = devices.find((candidate) => candidate.id === deviceId) ?? devices.find((candidate) => candidate.connected) ?? devices[0];
  const workspaces = device?.capabilities.workspaces ?? [];
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId) ?? workspaces[0];

  const mutation = useMutation({
    mutationFn: () => createCodingTask(transport, {
      device_id: device!.id,
      workspace_id: workspace!.id,
      workspace_name: workspace!.name,
      prompt: "",
      model,
      isolated,
    }),
    onSuccess: onCreated,
  });

  return (
    <div className="coding-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="coding-new-task" role="dialog" aria-modal="true" aria-label="New coding task" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="coding-eyebrow">new chat</span><h2>Choose a workspace</h2></div><button type="button" onClick={onClose}><X className="size-4" /></button></header>
        {devicesQuery.isError ? (
          <div className="coding-setup-state">
            <strong>{transport === "local" ? "Local agent not found" : "No paired agent is online"}</strong>
            <p>{transport === "local" ? "Start cole-agent, then try again." : "Create a pairing code, then enter it in the local agent."}</p>
            {transport === "remote" && !pairing && <button type="button" onClick={() => void createPairingCode().then(setPairing)}>create pairing code</button>}
            {pairing && <div className="coding-pair-code"><b>{pairing.code}</b><code>cole-agent pair {pairing.code}</code></div>}
          </div>
        ) : devices.length === 0 ? (
          <div className="coding-setup-state">
            <strong>No coding device paired</strong><p>Pair this browser workspace with your Mac agent.</p>
            {!pairing && <button type="button" onClick={() => void createPairingCode().then(setPairing)}>create pairing code</button>}
            {pairing && <div className="coding-pair-code"><b>{pairing.code}</b><code>cole-agent pair {pairing.code}</code></div>}
          </div>
        ) : (
          <>
            <p className="coding-new-task-hint">Open an empty chat, choose its model, then send a message whenever you are ready.</p>
            <div className="coding-new-task-options">
              <label><span>device</span><select value={device?.id ?? ""} onChange={(event) => { setDeviceId(event.target.value); setWorkspaceId(""); }}>{devices.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.connected ? "" : " · offline"}</option>)}</select></label>
              <label><span>workspace</span><select value={workspace?.id ?? ""} onChange={(event) => setWorkspaceId(event.target.value)}>{workspaces.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
            </div>
            <div className="coding-new-task-footer">
              <ModelPicker model={model} onChange={setModel} placement="up" />
              <label className="coding-isolate"><input type="checkbox" checked={isolated} onChange={(event) => setIsolated(event.target.checked)} /><span>isolated worktree</span></label>
              <button type="button" className="coding-launch" disabled={!device?.connected || !workspace || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "opening…" : "open chat"}</button>
            </div>
            {mutation.isError && <p className="coding-form-error">{mutation.error.message}</p>}
          </>
        )}
      </section>
    </div>
  );
}

export function CodingWorkspace() {
  const queryClient = useQueryClient();
  const isClient = useSyncExternalStore(subscribeClient, () => true, () => false);
  const [transportChoice, setTransportChoice] = useState<CodingTransport | null>(null);
  const transport = transportChoice ?? (isClient ? defaultCodingTransport() : "local");
  const layoutRaw = useSyncExternalStore(
    subscribeLayout,
    () => sessionStorage.getItem(`coding-panes-${transport}`) ?? "null",
    () => "null",
  );
  const splitRaw = useSyncExternalStore(
    subscribeLayout,
    () => sessionStorage.getItem(`coding-split-${transport}`) ?? "null",
    () => "null",
  );
  const panes = useMemo<string[] | null>(() => {
    try {
      const parsed = JSON.parse(layoutRaw);
      return Array.isArray(parsed) ? parsed.slice(0, 4) : null;
    } catch { return null; }
  }, [layoutRaw]);
  const splitRatio = useMemo<SplitRatio>(() => {
    try {
      const saved = JSON.parse(splitRaw) as Partial<SplitRatio> | null;
      if (saved && typeof saved.column === "number" && typeof saved.row === "number") {
        return {
          column: Math.min(75, Math.max(25, saved.column)),
          row: Math.min(75, Math.max(25, saved.row)),
        };
      }
    } catch {
      // Fall through to an even split.
    }
    return { column: 50, row: 50 };
  }, [splitRaw]);
  const [focused, setFocused] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [desktopAlerts, setDesktopAlerts] = useState(false);
  const previousStatuses = useRef<Map<string, string>>(new Map());
  const initializedStatuses = useRef(false);
  const gridRef = useRef<HTMLElement>(null);

  const tasksQuery = useQuery({
    queryKey: ["coding", transport, "tasks"],
    queryFn: () => getCodingTasks(transport),
    enabled: isClient,
    refetchInterval: 4_000,
    retry: 1,
  });
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const requestedTask = isClient ? new URLSearchParams(window.location.search).get("task") : null;
  const visiblePanes = useMemo(
    () => {
      const saved = panes?.filter((taskId) => !tasksQuery.data || taskMap.has(taskId));
      return saved ?? (requestedTask && (!tasksQuery.data || taskMap.has(requestedTask)) ? [requestedTask] : tasks[0] ? [tasks[0].id] : []);
    },
    [panes, requestedTask, taskMap, tasks, tasksQuery.data],
  );
  const focusedTask = focused ?? visiblePanes[0] ?? null;
  const prospectivePaneCount = draggingTask
    ? visiblePanes.length + (visiblePanes.includes(draggingTask) ? 0 : 1)
    : 0;
  const snapCount = prospectivePaneCount >= 2 ? Math.min(4, prospectivePaneCount) : 0;
  const gridStyle = {
    "--coding-column": `${splitRatio.column}%`,
    "--coding-row": `${splitRatio.row}%`,
    ...(visiblePanes.length >= 2
      ? { gridTemplateColumns: `${splitRatio.column}fr ${100 - splitRatio.column}fr` }
      : {}),
    ...(visiblePanes.length >= 3
      ? { gridTemplateRows: `${splitRatio.row}fr ${100 - splitRatio.row}fr` }
      : {}),
  } as CSSProperties;

  const setPanes = useCallback((update: string[] | ((current: string[]) => string[])) => {
    let current: string[] = [];
    try {
      const parsed = JSON.parse(sessionStorage.getItem(`coding-panes-${transport}`) ?? "null");
      current = Array.isArray(parsed) ? parsed : visiblePanes;
    } catch { current = visiblePanes; }
    const next = typeof update === "function" ? update(current) : update;
    sessionStorage.setItem(`coding-panes-${transport}`, JSON.stringify(next.slice(0, 4)));
    window.dispatchEvent(new Event("coding-layout"));
  }, [transport, visiblePanes]);

  const closeMutation = useMutation({
    mutationFn: (taskId: string) => closeCodingTask(transport, taskId),
    onSuccess: (_result, taskId) => {
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) => current.filter((task) => task.id !== taskId));
      setPanes((current) => current.filter((id) => id !== taskId));
      if (focusedTask === taskId) setFocused(null);
    },
  });

  const notify = useCallback((task: CodingTask, kind: AlertKind) => {
    if (sound) playDing(kind);
    if (desktopAlerts && document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification(kind === "completed" ? "Agent finished" : kind === "attention" ? "Agent needs attention" : "Agent failed", {
        body: `${task.title} · ${task.workspace_name}`,
        tag: `coding-${task.id}-${kind}`,
      });
    }
  }, [desktopAlerts, sound]);

  useEffect(() => {
    if (!tasksQuery.data) return;
    if (!initializedStatuses.current) {
      previousStatuses.current = new Map(tasks.map((task) => [task.id, task.status]));
      initializedStatuses.current = true;
      return;
    }
    for (const task of tasks) {
      const previous = previousStatuses.current.get(task.id);
      if (previous && previous !== task.status) {
        if (task.status === "completed") notify(task, "completed");
        else if (task.status === "attention") notify(task, "attention");
        else if (task.status === "failed") notify(task, "failed");
      }
      previousStatuses.current.set(task.id, task.status);
    }
    const attentionCount = tasks.filter((task) => task.status === "attention" || task.status === "failed").length;
    document.title = `${attentionCount ? `(${attentionCount}) ` : ""}Coding · colehenry.dev`;
    return () => { document.title = "Coding · colehenry.dev"; };
  }, [notify, tasks, tasksQuery.data]);

  const onEvent = useCallback((taskId: string, event: CodingEvent) => {
    void queryClient.invalidateQueries({ queryKey: ["coding", transport, "tasks"] });
    if (["task_completed", "task_failed", "approval_required", "attention"].includes(event.type)) {
      void queryClient.invalidateQueries({ queryKey: ["coding", transport, "task", taskId] });
    }
  }, [queryClient, transport]);

  function openTask(taskId: string, split = false) {
    if (visiblePanes.includes(taskId)) {
      setFocused(taskId);
      return;
    }
    if (split && visiblePanes.length < 4) setPanes((current) => [...current, taskId]);
    else if (!visiblePanes.length) setPanes([taskId]);
    else setPanes((current) => current.map((id) => id === focusedTask ? taskId : id));
    setFocused(taskId);
  }

  function dropTask(taskId: string, slot: number) {
    setPanes((current) => {
      const next = current.filter((id) => id !== taskId);
      if (next.length < 4) next.splice(Math.min(slot, next.length), 0, taskId);
      else next[Math.min(slot, 3)] = taskId;
      return next.slice(0, 4);
    });
    setFocused(taskId);
    setDraggingTask(null);
  }

  function beginResize(axis: "column" | "row", event: ReactPointerEvent<HTMLDivElement>) {
    const grid = gridRef.current;
    if (!grid) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = axis === "column" ? "col-resize" : "row-resize";
    handle.setPointerCapture(pointerId);

    const move = (moveEvent: PointerEvent) => {
      const bounds = grid.getBoundingClientRect();
      const raw = axis === "column"
        ? ((moveEvent.clientX - bounds.left) / bounds.width) * 100
        : ((moveEvent.clientY - bounds.top) / bounds.height) * 100;
      const value = Math.min(75, Math.max(25, raw));
      const next = { ...splitRatio, [axis]: value };
      sessionStorage.setItem(`coding-split-${transport}`, JSON.stringify(next));
      window.dispatchEvent(new Event("coding-layout"));
    };
    const finish = () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  async function enableDesktopAlerts() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    setDesktopAlerts(enabled);
    localStorage.setItem("coding-desktop-alerts", enabled ? "on" : "off");
  }

  useEffect(() => {
    const finishDrag = () => setDraggingTask(null);
    window.addEventListener("dragend", finishDrag);
    window.addEventListener("drop", finishDrag);
    return () => {
      window.removeEventListener("dragend", finishDrag);
      window.removeEventListener("drop", finishDrag);
    };
  }, []);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === "Escape") setDraggingTask(null);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNewTaskOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) {
        const taskId = visiblePanes[Number(event.key) - 1];
        if (taskId) { event.preventDefault(); setFocused(taskId); }
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [visiblePanes]);

  if (!isClient) return <div className="coding-shell coding-loading-screen">booting coding workspace<span className="coding-cursor" /></div>;

  return (
    <div className="coding-shell">
      <header className="coding-topbar">
        <div className="coding-brand"><span>~/code</span><i>{transport === "local" ? "local" : "remote"}</i></div>
        <div className="coding-tabs" role="tablist" aria-label="Coding tasks">
          {tasks.map((task) => (
            <div
              key={task.id}
              role="tab"
              tabIndex={0}
              draggable
              aria-selected={focusedTask === task.id}
              className={`coding-tab ${focusedTask === task.id ? "is-active" : ""}`}
              onClick={() => openTask(task.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openTask(task.id);
                }
              }}
              onDragStart={(event) => { event.dataTransfer.setData("text/task-id", task.id); setDraggingTask(task.id); }}
              onDragEnd={() => setDraggingTask(null)}
            >
              <span className={`coding-status is-${task.status}`} />
              <span className="coding-tab-title">{task.title}</span>
              <span className="coding-tab-status">{statusLabel(task.status)}</span>
              <span className="coding-tab-actions">
                <button type="button" title="Open in split" aria-label={`Open ${task.title} in split`} onClick={(event) => { event.stopPropagation(); openTask(task.id, true); }}><PanelRightOpen className="size-3" /></button>
                <button type="button" title="Open in new window" aria-label={`Open ${task.title} in new window`} onClick={(event) => { event.stopPropagation(); window.open(`/coding?task=${task.id}`, "_blank", "noopener,noreferrer"); }}><ExternalLink className="size-3" /></button>
                <button type="button" title="Close chat" aria-label={`Close ${task.title}`} onClick={(event) => { event.stopPropagation(); closeMutation.mutate(task.id); }}><X className="size-3" /></button>
              </span>
            </div>
          ))}
          <button type="button" className="coding-new-tab" onClick={() => setNewTaskOpen(true)} title="New chat (⌘N)"><Plus className="size-3.5" /></button>
        </div>
        <div className="coding-global-actions">
          <div className="coding-transport" title="Agent connection">
            <button type="button" className={transport === "local" ? "is-active" : ""} onClick={() => { initializedStatuses.current = false; setTransportChoice("local"); setFocused(null); }}><Laptop className="size-3.5" /><span>local</span></button>
            <button type="button" className={transport === "remote" ? "is-active" : ""} onClick={() => { initializedStatuses.current = false; setTransportChoice("remote"); setFocused(null); }}><Cloud className="size-3.5" /><span>remote</span></button>
          </div>
          <div className="coding-settings-wrap">
            <button type="button" onClick={() => setSettingsOpen((open) => !open)} title="Notifications"><Settings2 className="size-4" /></button>
            {settingsOpen && (
              <div className="coding-settings-popover">
                <button type="button" onClick={() => { const next = !sound; setSound(next); localStorage.setItem("coding-sound", next ? "on" : "off"); if (next) playDing("completed"); }}>{sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}<span>sound</span><i>{sound ? "on" : "off"}</i></button>
                <button type="button" onClick={() => void enableDesktopAlerts()}>{desktopAlerts ? <Bell className="size-4" /> : <BellOff className="size-4" />}<span>desktop alerts</span><i>{desktopAlerts ? "on" : "off"}</i></button>
              </div>
            )}
          </div>
          <button type="button" className="coding-primary-action" onClick={() => setNewTaskOpen(true)}><Plus className="size-4" /><span>new</span></button>
        </div>
      </header>

      {tasksQuery.isError && visiblePanes.length === 0 ? (
        <main className="coding-offline">
          <div className="coding-offline-mark"><span>$</span><i>_</i></div>
          <h1>{transport === "local" ? "Start your local agent" : "Connect your Mac"}</h1>
          <p>{transport === "local" ? "The interface is ready. Run the local companion, register this repository, and start your first task." : "Pair the local companion once, then this workspace can control it from anywhere."}</p>
          <code>{transport === "local" ? "cd agent && npm run dev -- workspace add .. && npm run dev -- start" : "Create a new task to pair a device"}</code>
          <button type="button" onClick={() => setNewTaskOpen(true)}>open setup</button>
        </main>
      ) : visiblePanes.length === 0 ? (
        <main className="coding-offline"><div className="coding-offline-mark"><span>+</span><i>_</i></div><h1>Open a chat</h1><p>Choose a workspace and model. Nothing runs until you send the first message.</p><button type="button" onClick={() => setNewTaskOpen(true)}>new chat</button></main>
      ) : (
        <main ref={gridRef} className={`coding-grid count-${Math.min(4, visiblePanes.length)}`} style={gridStyle}>
          {visiblePanes.map((taskId) => {
            const task = taskMap.get(taskId);
            return task ? <CodingPane key={task.id} task={task} transport={transport} focused={focusedTask === task.id} onFocus={() => setFocused(task.id)} onClose={() => { setPanes((current) => current.filter((id) => id !== task.id)); if (focusedTask === task.id) setFocused(null); }} onEvent={onEvent} onDragStart={() => setDraggingTask(task.id)} onDragEnd={() => setDraggingTask(null)} /> : null;
          })}
          {visiblePanes.length >= 2 && <div className="coding-resize-handle is-column" role="separator" aria-orientation="vertical" title="Drag to resize columns" onPointerDown={(event) => beginResize("column", event)} />}
          {visiblePanes.length >= 3 && <div className="coding-resize-handle is-row" role="separator" aria-orientation="horizontal" title="Drag to resize rows" onPointerDown={(event) => beginResize("row", event)} />}
          {snapCount > 0 && (
            <div className={`coding-snap-overlay layout-${snapCount}`} onDragOver={(event) => event.preventDefault()}>
              {snapLabels(snapCount).map((label, index) => <div key={label} onDrop={(event) => { event.preventDefault(); dropTask(event.dataTransfer.getData("text/task-id"), index); }}><Columns2 className="size-5" /><span>{label}</span></div>)}
            </div>
          )}
        </main>
      )}
      {newTaskOpen && <NewTaskDialog transport={transport} onClose={() => setNewTaskOpen(false)} onCreated={(task) => { queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) => [task, ...current]); setPanes((current) => current.length < 4 ? [...current, task.id] : [task.id]); setFocused(task.id); setNewTaskOpen(false); }} />}
    </div>
  );
}
