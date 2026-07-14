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
  Menu,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { CodingPane } from "@/components/coding/coding-pane";
import {
  createCodingTask,
  archiveCodingTask,
  closeCodingTask,
  defaultCodingTransport,
  getArchivedCodingTasks,
  getCodingDevices,
  getCodingTasks,
  restoreCodingTask,
  updateCodingTaskTitle,
  updateCodingTaskWorkspace,
  type CodingDevice,
  type CodingEvent,
  type CodingTask,
  type CodingTransport,
  type CodingWorkspace as CodingWorkspaceOption,
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

type SessionGroup = { id: string; name: string; tasks: CodingTask[] };

function groupSessions(tasks: CodingTask[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>();
  for (const task of tasks) {
    const group = groups.get(task.workspace_id) ?? {
      id: task.workspace_id,
      name: task.workspace_name,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(task.workspace_id, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((left, right) => right.updated_at.localeCompare(left.updated_at)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function ChatHistory({
  groups,
  loading,
  restoring,
  deletingTaskId,
  onOpen,
  onRestore,
  onDelete,
}: {
  groups: SessionGroup[];
  loading: boolean;
  restoring: boolean;
  deletingTaskId: string | null;
  onOpen: (taskId: string) => void;
  onRestore: (taskId: string) => void;
  onDelete: (task: CodingTask) => void;
}) {
  return (
    <div className="coding-history-popover">
      <header><span>chat history</span><i>{groups.reduce((count, group) => count + group.tasks.length, 0)}</i></header>
      <div className="coding-history-list">
        {loading && <p>loading history…</p>}
        {!loading && groups.length === 0 && <p>No saved chats yet.</p>}
        {groups.map((group) => (
          <section key={group.id}>
            <h3>{group.name}</h3>
            {group.tasks.map((task) => {
              const archived = Boolean(task.archived_at);
              return (
                <div className="coding-history-row" key={task.id}>
                  <button
                    type="button"
                    className="coding-history-open"
                    disabled={archived && restoring}
                    onClick={() => archived ? onRestore(task.id) : onOpen(task.id)}
                  >
                    <span className={`coding-status is-${task.status}`} />
                    <strong>{task.title}</strong>
                    <small>{archived ? "archived" : statusLabel(task.status)}</small>
                  </button>
                  {archived && (
                    <div className="coding-history-actions">
                      <button type="button" title={`Restore ${task.title}`} aria-label={`Restore ${task.title}`} disabled={restoring} onClick={() => onRestore(task.id)}><RotateCcw className="size-3" /></button>
                      <button type="button" title={`Delete ${task.title} permanently`} aria-label={`Delete ${task.title} permanently`} disabled={deletingTaskId === task.id} onClick={() => onDelete(task)}><Trash2 className="size-3" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
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
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renamingTaskId, setRenamingTaskId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sound, setSound] = useState(true);
  const [desktopAlerts, setDesktopAlerts] = useState(false);
  const previousStatuses = useRef<Map<string, string>>(new Map());
  const initializedStatuses = useRef(false);
  const gridRef = useRef<HTMLElement>(null);

  const devicesQuery = useQuery({
    queryKey: ["coding", transport, "devices"],
    queryFn: () => getCodingDevices(transport),
    enabled: isClient,
    refetchInterval: 5_000,
    retry: 1,
  });
  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);

  const tasksQuery = useQuery({
    queryKey: ["coding", transport, "tasks"],
    queryFn: () => getCodingTasks(transport),
    enabled: isClient,
    refetchInterval: 4_000,
    retry: 1,
  });
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const archivedQuery = useQuery({
    queryKey: ["coding", transport, "archived-tasks"],
    queryFn: () => getArchivedCodingTasks(transport),
    enabled: isClient && historyOpen,
    staleTime: 10_000,
  });
  const sessionGroups = useMemo(
    () => groupSessions([...tasks, ...(archivedQuery.data ?? [])]),
    [archivedQuery.data, tasks],
  );
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

  const newTaskMutation = useMutation({
    mutationFn: ({
      device,
      workspace,
      model,
    }: {
      device: CodingDevice;
      workspace: CodingWorkspaceOption;
      model: string;
    }) => createCodingTask(transport, {
      device_id: device.id,
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      prompt: "",
      model,
      isolated: false,
    }),
    onSuccess: (task) => {
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) => [task, ...current]);
      setPanes((current) => {
        if (!current.length) return [task.id];
        const index = current.indexOf(focusedTask ?? "");
        if (index < 0) return [task.id];
        const next = [...current];
        next[index] = task.id;
        return next;
      });
      setFocused(task.id);
    },
  });

  const createNewTask = useCallback(() => {
    const currentTask = focusedTask ? taskMap.get(focusedTask) : undefined;
    const device = devices.find((candidate) => candidate.id === currentTask?.device_id && candidate.connected)
      ?? devices.find((candidate) => candidate.connected && (candidate.capabilities.workspaces?.length ?? 0) > 0);
    if (!device) return;
    const workspaces = device.capabilities.workspaces ?? [];
    const savedWorkspaceId = localStorage.getItem(`coding-workspace-${transport}`);
    const workspace = workspaces.find((candidate) => candidate.id === currentTask?.workspace_id)
      ?? workspaces.find((candidate) => candidate.id === savedWorkspaceId)
      ?? workspaces[0];
    if (!workspace) return;
    const model = currentTask?.model
      ?? localStorage.getItem(`coding-model-${transport}`)
      ?? CHAT_MODELS[0].slug;
    localStorage.setItem(`coding-workspace-${transport}`, workspace.id);
    localStorage.setItem(`coding-model-${transport}`, model);
    newTaskMutation.mutate({ device, workspace, model });
  }, [devices, focusedTask, newTaskMutation, taskMap, transport]);

  const closeMutation = useMutation({
    mutationFn: (taskId: string) => archiveCodingTask(transport, taskId),
    onSuccess: (_result, taskId) => {
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) => current.filter((task) => task.id !== taskId));
      setPanes((current) => current.filter((id) => id !== taskId));
      if (focusedTask === taskId) setFocused(null);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: string; title: string }) =>
      updateCodingTaskTitle(transport, taskId, title),
    onMutate: async ({ taskId, title }) => {
      await queryClient.cancelQueries({ queryKey: ["coding", transport, "tasks"] });
      const previous = queryClient.getQueryData<CodingTask[]>(["coding", transport, "tasks"]);
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) =>
        current.map((task) => task.id === taskId ? { ...task, title } : task),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["coding", transport, "tasks"], context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) =>
        current.map((task) => task.id === updated.id ? updated : task),
      );
    },
  });

  const workspaceMutation = useMutation({
    mutationFn: ({ taskId, workspace }: { taskId: string; workspace: CodingWorkspaceOption }) =>
      updateCodingTaskWorkspace(transport, taskId, workspace),
    onMutate: async ({ taskId, workspace }) => {
      await queryClient.cancelQueries({ queryKey: ["coding", transport, "tasks"] });
      const previous = queryClient.getQueryData<CodingTask[]>(["coding", transport, "tasks"]);
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) =>
        current.map((task) => task.id === taskId ? {
          ...task,
          workspace_id: workspace.id,
          workspace_name: workspace.name,
        } : task),
      );
      localStorage.setItem(`coding-workspace-${transport}`, workspace.id);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["coding", transport, "tasks"], context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) =>
        current.map((task) => task.id === updated.id ? updated : task),
      );
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (taskId: string) => restoreCodingTask(transport, taskId),
    onSuccess: (task) => {
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "archived-tasks"], (current = []) =>
        current.filter((candidate) => candidate.id !== task.id),
      );
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "tasks"], (current = []) => [
        task,
        ...current.filter((candidate) => candidate.id !== task.id),
      ]);
      openTask(task.id);
      setHistoryOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => closeCodingTask(transport, taskId),
    onSuccess: (_result, taskId) => {
      queryClient.setQueryData<CodingTask[]>(["coding", transport, "archived-tasks"], (current = []) =>
        current.filter((candidate) => candidate.id !== taskId),
      );
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

  function beginRename(task: CodingTask) {
    setRenamingTaskId(task.id);
    setRenameValue(task.title);
  }

  function finishRename(task: CodingTask) {
    const title = renameValue.replace(/\s+/g, " ").trim();
    setRenamingTaskId(null);
    if (!title || title === task.title) return;
    renameMutation.mutate({ taskId: task.id, title });
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
        createNewTask();
      }
      if ((event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) {
        const taskId = visiblePanes[Number(event.key) - 1];
        if (taskId) { event.preventDefault(); setFocused(taskId); }
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [createNewTask, visiblePanes]);

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
              draggable={renamingTaskId !== task.id}
              aria-selected={focusedTask === task.id}
              className={`coding-tab ${focusedTask === task.id ? "is-active" : ""}`}
              onClick={() => openTask(task.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openTask(task.id);
                }
              }}
              onDragStart={(event) => {
                if (renamingTaskId === task.id) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.setData("text/task-id", task.id);
                setDraggingTask(task.id);
              }}
              onDragEnd={() => setDraggingTask(null)}
            >
              <span className={`coding-status is-${task.status}`} />
              {renamingTaskId === task.id ? (
                <input
                  autoFocus
                  className="coding-tab-title-input"
                  value={renameValue}
                  maxLength={120}
                  aria-label={`Rename ${task.title}`}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={() => finishRename(task)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setRenamingTaskId(null);
                      setRenameValue(task.title);
                    }
                  }}
                />
              ) : (
                <span
                  className="coding-tab-title"
                  title="Click to rename"
                  onClick={(event) => {
                    event.stopPropagation();
                    beginRename(task);
                  }}
                >
                  {task.title}
                </span>
              )}
              {renamingTaskId !== task.id && <span className="coding-tab-status">{statusLabel(task.status)}</span>}
              <span className="coding-tab-actions">
                <button type="button" title="Open in split" aria-label={`Open ${task.title} in split`} onClick={(event) => { event.stopPropagation(); openTask(task.id, true); }}><PanelRightOpen className="size-3" /></button>
                <button type="button" title="Open in new window" aria-label={`Open ${task.title} in new window`} onClick={(event) => { event.stopPropagation(); window.open(`/coding?task=${task.id}`, "_blank", "noopener,noreferrer"); }}><ExternalLink className="size-3" /></button>
                <button type="button" title="Archive chat" aria-label={`Archive ${task.title}`} onClick={(event) => { event.stopPropagation(); closeMutation.mutate(task.id); }}><X className="size-3" /></button>
              </span>
            </div>
          ))}
          <button type="button" className="coding-new-tab" disabled={newTaskMutation.isPending} onClick={createNewTask} title="New chat (⌘N)"><Plus className="size-3.5" /></button>
        </div>
        <div className="coding-global-actions">
          <div className="coding-transport" title="Agent connection">
            <button type="button" className={transport === "local" ? "is-active" : ""} onClick={() => { initializedStatuses.current = false; setTransportChoice("local"); setFocused(null); }}><Laptop className="size-3.5" /><span>local</span></button>
            <button type="button" className={transport === "remote" ? "is-active" : ""} onClick={() => { initializedStatuses.current = false; setTransportChoice("remote"); setFocused(null); }}><Cloud className="size-3.5" /><span>remote</span></button>
          </div>
          <div className="coding-settings-wrap">
            <button type="button" onClick={() => { setHistoryOpen(false); setSettingsOpen((open) => !open); }} title="Notifications"><Settings2 className="size-4" /></button>
            {settingsOpen && (
              <div className="coding-settings-popover">
                <button type="button" onClick={() => { const next = !sound; setSound(next); localStorage.setItem("coding-sound", next ? "on" : "off"); if (next) playDing("completed"); }}>{sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}<span>sound</span><i>{sound ? "on" : "off"}</i></button>
                <button type="button" onClick={() => void enableDesktopAlerts()}>{desktopAlerts ? <Bell className="size-4" /> : <BellOff className="size-4" />}<span>desktop alerts</span><i>{desktopAlerts ? "on" : "off"}</i></button>
              </div>
            )}
          </div>
          <div className="coding-history-wrap">
            <button type="button" onClick={() => { setSettingsOpen(false); setHistoryOpen((open) => !open); }} title="Chat history" aria-label="Chat history"><Menu className="size-4" /></button>
            {historyOpen && (
              <ChatHistory
                groups={sessionGroups}
                loading={archivedQuery.isLoading}
                restoring={restoreMutation.isPending}
                deletingTaskId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
                onOpen={(taskId) => { openTask(taskId); setHistoryOpen(false); }}
                onRestore={(taskId) => restoreMutation.mutate(taskId)}
                onDelete={(task) => {
                  if (window.confirm(`Permanently delete “${task.title}”? This cannot be undone.`)) {
                    deleteMutation.mutate(task.id);
                  }
                }}
              />
            )}
          </div>
          <button type="button" className="coding-primary-action" disabled={newTaskMutation.isPending} onClick={createNewTask}><Plus className="size-4" /><span>{newTaskMutation.isPending ? "opening" : "new"}</span></button>
        </div>
      </header>

      {newTaskMutation.isError && <div className="coding-create-error">Could not open a new chat: {newTaskMutation.error.message}</div>}

      {tasksQuery.isError && visiblePanes.length === 0 ? (
        <main className="coding-offline">
          <div className="coding-offline-mark"><span>$</span><i>_</i></div>
          <h1>{transport === "local" ? "Start your local agent" : "Connect your Mac"}</h1>
          <p>{transport === "local" ? "The interface is ready. Run the local companion, register this repository, and start your first task." : "Pair the local companion once, then this workspace can control it from anywhere."}</p>
          <code>{transport === "local" ? "cd agent && npm run dev -- workspace add .. && npm run dev -- start" : "Create a new task to pair a device"}</code>
          <button type="button" onClick={() => void Promise.all([devicesQuery.refetch(), tasksQuery.refetch()])}>retry connection</button>
        </main>
      ) : visiblePanes.length === 0 ? (
        <main className="coding-offline"><div className="coding-offline-mark"><span>+</span><i>_</i></div><h1>Open a chat</h1><p>A blank tab uses your current project and model. Nothing runs until you send the first message.</p><button type="button" onClick={createNewTask}>new chat</button></main>
      ) : (
        <main ref={gridRef} className={`coding-grid count-${Math.min(4, visiblePanes.length)}`} style={gridStyle}>
          {visiblePanes.map((taskId) => {
            const task = taskMap.get(taskId);
            const workspaces = devices.find((device) => device.id === task?.device_id)?.capabilities.workspaces ?? [];
            return task ? <CodingPane key={task.id} task={task} workspaces={workspaces} transport={transport} focused={focusedTask === task.id} onFocus={() => setFocused(task.id)} onClose={() => { setPanes((current) => current.filter((id) => id !== task.id)); if (focusedTask === task.id) setFocused(null); }} onEvent={onEvent} onWorkspaceChange={(workspace) => workspaceMutation.mutate({ taskId: task.id, workspace })} onDragStart={() => setDraggingTask(task.id)} onDragEnd={() => setDraggingTask(null)} /> : null;
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
    </div>
  );
}
