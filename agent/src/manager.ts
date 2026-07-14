import { randomUUID } from "node:crypto";

import { SESSION_DB_PATH } from "./config.js";
import { SessionStore } from "./store.js";
import { TaskRuntime } from "./task.js";
import type {
  AgentConfig,
  AgentEvent,
  EventSink,
  RuntimeState,
  StartTaskInput,
  TaskAction,
  TaskRecord,
} from "./types.js";

type Subscriber = (event: AgentEvent) => void;
type Job = { taskId: string; runtime: TaskRuntime; prompt: string; model?: string };

export class TaskManager {
  readonly tasks = new Map<string, TaskRecord>();
  readonly store: SessionStore;
  private readonly runtimes = new Map<string, TaskRuntime>();
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private readonly sinks = new Map<string, EventSink>();
  private readonly queue: Job[] = [];
  private readonly busyTasks = new Set<string>();
  private active = 0;

  constructor(private config: AgentConfig, store = new SessionStore(SESSION_DB_PATH)) {
    this.store = store;
    for (const restored of this.store.loadSessions()) this.loadRuntime(restored.record, restored.runtime);
  }

  updateConfig(config: AgentConfig) {
    this.config = config;
  }

  private loadRuntime(record: TaskRecord, restored: RuntimeState): void {
    this.tasks.set(record.id, record);
    const workspace = this.config.workspaces.find((candidate) => candidate.id === record.workspace_id);
    if (!workspace) return;
    this.runtimes.set(
      record.id,
      new TaskRuntime(record, workspace, this.config, this.emitter(record), this.store, restored),
    );
  }

  private emitter(record: TaskRecord) {
    return async (type: string, payload: Record<string, unknown> = {}, forward = true): Promise<void> => {
      const event: AgentEvent = {
        seq: record.events.length + 1,
        type,
        payload,
        created_at: new Date().toISOString(),
      };
      record.events.push(event);
      record.updated_at = event.created_at;
      if (type === "task_started") record.status = "running";
      else if (type === "approval_required" || type === "attention") record.status = "attention";
      else if (type === "task_interrupted") record.status = "interrupted";
      else if (type === "task_completed") record.status = "completed";
      else if (type === "task_failed") record.status = "failed";
      else if (type === "task_cancelled") record.status = "cancelled";
      this.store.appendEventAndUpdate(record, event);
      for (const subscriber of this.subscribers.get(record.id) ?? []) subscriber(event);
      if (forward) await this.sinks.get(record.id)?.(record.id, { type, payload });
    };
  }

  createTask(input: StartTaskInput, sink?: EventSink, forwardUser = true): TaskRecord {
    const workspace = this.config.workspaces.find((candidate) => candidate.id === input.workspace_id);
    if (!workspace) throw new Error("Workspace is not registered with this agent");
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();
    const normalized = input.prompt.replace(/\s+/g, " ").trim();
    const record: TaskRecord = {
      id,
      device_id: input.device_id ?? this.config.deviceId ?? "local",
      title: `${normalized.slice(0, 52)}${normalized.length > 52 ? "…" : ""}` || "New chat",
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      model: input.model,
      branch: null,
      status: normalized ? "queued" : "draft",
      created_at: now,
      updated_at: now,
      archived_at: null,
      events: [],
    };
    this.store.createSession(record);
    this.tasks.set(id, record);
    if (sink) this.sinks.set(id, sink);
    const emit = this.emitter(record);
    const runtime = new TaskRuntime(record, workspace, this.config, emit, this.store);
    this.runtimes.set(id, runtime);
    if (normalized) {
      void emit("user_message", { content: input.prompt }, forwardUser);
      this.queue.push({ taskId: id, runtime, prompt: input.prompt });
      this.drain();
    }
    return record;
  }

  sendMessage(taskId: string, content: string, model?: string): void {
    const runtime = this.runtimes.get(taskId);
    const record = this.tasks.get(taskId);
    if (!runtime || !record) throw new Error("Task not found or its workspace is no longer registered");
    const normalized = content.replace(/\s+/g, " ").trim();
    if (!normalized) throw new Error("Message cannot be empty");
    if (record.status === "draft") {
      record.title = `${normalized.slice(0, 52)}${normalized.length > 52 ? "…" : ""}`;
    }
    record.status = "queued";
    if (model) record.model = model;
    const event: AgentEvent = {
      seq: record.events.length + 1,
      type: "user_message",
      payload: { content },
      created_at: new Date().toISOString(),
    };
    record.events.push(event);
    record.updated_at = event.created_at;
    this.store.appendEventAndUpdate(record, event);
    for (const subscriber of this.subscribers.get(taskId) ?? []) subscriber(event);
    this.queue.push({ taskId, runtime, prompt: content, model });
    this.drain();
  }

  updateModel(taskId: string, model: string): TaskRecord {
    const record = this.tasks.get(taskId);
    if (!record) throw new Error("Task not found");
    const normalized = model.trim();
    if (!normalized) throw new Error("Model cannot be empty");
    record.model = normalized;
    record.updated_at = new Date().toISOString();
    this.store.updateSession(record);
    return record;
  }

  updateTitle(taskId: string, title: string): TaskRecord {
    const record = this.tasks.get(taskId);
    if (!record) throw new Error("Task not found");
    const normalized = title.replace(/\s+/g, " ").trim();
    if (!normalized) throw new Error("Title cannot be empty");
    record.title = normalized.slice(0, 120);
    record.updated_at = new Date().toISOString();
    this.store.updateSession(record);
    return record;
  }

  updateWorkspace(taskId: string, workspaceId: string): TaskRecord {
    const record = this.tasks.get(taskId);
    if (!record) throw new Error("Task not found");
    if (record.status !== "draft") throw new Error("Workspace can only be changed before the first message");
    const workspace = this.config.workspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace) throw new Error("Workspace is not registered with this agent");
    record.workspace_id = workspace.id;
    record.workspace_name = workspace.name;
    record.branch = null;
    record.updated_at = new Date().toISOString();
    const runtime: RuntimeState = {
      cwd: "",
      branch: null,
      initialized: false,
      baselineStatus: "",
      baselinePatch: "",
    };
    this.store.updateSession(record);
    this.store.updateRuntime(record.id, runtime);
    this.runtimes.set(
      record.id,
      new TaskRuntime(record, workspace, this.config, this.emitter(record), this.store, runtime),
    );
    return record;
  }

  setSink(taskId: string, sink: EventSink): void {
    if (!this.tasks.has(taskId)) throw new Error("Task not found");
    this.sinks.set(taskId, sink);
  }

  async archiveTask(taskId: string): Promise<void> {
    const runtime = this.runtimes.get(taskId);
    const record = this.tasks.get(taskId);
    if (!runtime || !record) throw new Error("Task not found");
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index].taskId === taskId) this.queue.splice(index, 1);
    }
    await runtime.handleAction({ type: "cancel" });
    record.archived_at = new Date().toISOString();
    this.store.archive(taskId);
    this.tasks.delete(taskId);
    this.runtimes.delete(taskId);
    this.subscribers.delete(taskId);
    this.sinks.delete(taskId);
  }

  restoreTask(taskId: string): TaskRecord {
    if (this.tasks.has(taskId)) return this.tasks.get(taskId)!;
    this.store.restore(taskId);
    const restored = this.store.getSession(taskId);
    if (!restored) throw new Error("Task not found");
    const workspace = this.config.workspaces.find((candidate) => candidate.id === restored.record.workspace_id);
    if (!workspace) throw new Error("The task workspace is no longer registered");
    this.loadRuntime(restored.record, restored.runtime);
    return restored.record;
  }

  async closeTask(taskId: string): Promise<void> {
    const runtime = this.runtimes.get(taskId);
    if (!runtime || !this.tasks.has(taskId)) {
      const stored = this.store.getSession(taskId)?.record;
      if (!stored?.archived_at) throw new Error("Task not found");
      this.store.delete(taskId);
      return;
    }
    if (this.busyTasks.has(taskId)) throw new Error("Stop or archive the running task before deleting it");
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index].taskId === taskId) this.queue.splice(index, 1);
    }
    this.tasks.delete(taskId);
    this.runtimes.delete(taskId);
    this.subscribers.delete(taskId);
    this.sinks.delete(taskId);
    this.store.delete(taskId);
  }

  async handleAction(taskId: string, action: TaskAction): Promise<void> {
    const runtime = this.runtimes.get(taskId);
    const record = this.tasks.get(taskId);
    if (!runtime || !record) throw new Error("Task not found");
    const event: AgentEvent = {
      seq: record.events.length + 1,
      type: "user_action",
      payload: { type: action.type, payload: action.payload ?? {} },
      created_at: new Date().toISOString(),
    };
    record.events.push(event);
    record.updated_at = event.created_at;
    this.store.appendEventAndUpdate(record, event);
    for (const subscriber of this.subscribers.get(taskId) ?? []) subscriber(event);
    await runtime.handleAction(action);
  }

  subscribe(taskId: string, subscriber: Subscriber): () => void {
    const listeners = this.subscribers.get(taskId) ?? new Set<Subscriber>();
    listeners.add(subscriber);
    this.subscribers.set(taskId, listeners);
    return () => {
      listeners.delete(subscriber);
      if (!listeners.size) this.subscribers.delete(taskId);
    };
  }

  private drain(): void {
    while (this.active < this.config.maxConcurrency && this.queue.length) {
      const index = this.queue.findIndex((job) => !this.busyTasks.has(job.taskId));
      if (index === -1) return;
      const [job] = this.queue.splice(index, 1);
      this.active += 1;
      this.busyTasks.add(job.taskId);
      void job.runtime.process(job.prompt, job.model).finally(() => {
        this.active -= 1;
        this.busyTasks.delete(job.taskId);
        this.drain();
      });
    }
  }
}
