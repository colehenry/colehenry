import WebSocket from "ws";

import { publicWorkspace } from "./config.js";
import { TaskManager } from "./manager.js";
import type { AgentConfig, EventSink, StartTaskInput, TaskAction } from "./types.js";

export class RemoteRelay {
  private socket: WebSocket | null = null;
  private stopped = false;
  private reconnectAttempt = 0;
  private heartbeat: NodeJS.Timeout | null = null;
  private outbox: string[] = [];

  constructor(
    private config: AgentConfig,
    private manager: TaskManager,
  ) {}

  start(): void {
    if (!this.config.deviceToken || !this.config.deviceId) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.socket?.close();
  }

  private connect(): void {
    const wsBase = this.config.serverUrl.replace(/^http/, "ws").replace(/\/$/, "");
    const socket = new WebSocket(`${wsBase}/coding/agent/ws`, {
      headers: { Authorization: `Bearer ${this.config.deviceToken}` },
    });
    this.socket = socket;
    socket.on("open", () => {
      this.reconnectAttempt = 0;
      this.send({
        type: "hello",
        capabilities: {
          version: "0.1.0",
          workspaces: this.config.workspaces.map(publicWorkspace),
          max_concurrency: this.config.maxConcurrency,
        },
      });
      for (const queued of this.outbox.splice(0)) socket.send(queued);
      this.heartbeat = setInterval(() => this.send({ type: "heartbeat" }), 25_000);
      console.log(`Remote relay connected to ${this.config.serverUrl}`);
    });
    socket.on("message", (data) => void this.handle(JSON.parse(data.toString())));
    socket.on("error", (error) => console.error(`Remote relay: ${error.message}`));
    socket.on("close", () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (this.stopped) return;
      const wait = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt++);
      setTimeout(() => this.connect(), wait);
    });
  }

  private send(message: object): void {
    const encoded = JSON.stringify(message);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encoded);
    else this.outbox.push(encoded);
  }

  private sink: EventSink = async (taskId, event) => {
    this.send({ type: "event", task_id: taskId, event });
  };

  private async handle(message: any): Promise<void> {
    if (message.type === "start_task") {
      if (this.manager.tasks.has(message.task.id)) {
        this.manager.setSink(message.task.id, this.sink);
        return;
      }
      const input: StartTaskInput = {
        id: message.task.id,
        device_id: message.task.device_id,
        workspace_id: message.task.workspace_id,
        workspace_name: message.task.workspace_name,
        model: message.task.model,
        prompt: message.prompt,
        isolated: message.isolated,
      };
      this.manager.createTask(input, this.sink, false);
      return;
    }
    if (message.type === "task_message") {
      this.manager.setSink(message.task_id, this.sink);
      this.manager.sendMessage(message.task_id, message.content, message.model);
      return;
    }
    if (message.type === "task_action") {
      this.manager.setSink(message.task_id, this.sink);
      await this.manager.handleAction(message.task_id, message.action as TaskAction);
      return;
    }
    if (message.type === "archive_task") {
      if (this.manager.tasks.has(message.task_id)) await this.manager.archiveTask(message.task_id);
      return;
    }
    if (message.type === "restore_task") {
      this.manager.restoreTask(message.task_id);
      return;
    }
    if (message.type === "close_task") await this.manager.closeTask(message.task_id);
  }
}

export async function pairRemote(
  config: AgentConfig,
  code: string,
  serverUrl?: string,
): Promise<AgentConfig> {
  const next = { ...config, serverUrl: (serverUrl ?? config.serverUrl).replace(/\/$/, "") };
  const response = await fetch(`${next.serverUrl}/coding/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.toUpperCase(), name: next.deviceName }),
  });
  if (!response.ok) throw new Error(await response.text());
  const paired = (await response.json()) as { device_id: string; device_token: string };
  next.deviceId = paired.device_id;
  next.deviceToken = paired.device_token;
  return next;
}
