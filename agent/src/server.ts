import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { publicWorkspace } from "./config.js";
import { TaskManager } from "./manager.js";
import type { AgentConfig, StartTaskInput, TaskAction } from "./types.js";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8888",
  "http://127.0.0.1:8888",
]);

function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Origin is not allowed" }));
    return false;
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Cole-Agent");
  if (req.method !== "OPTIONS" && req.headers["x-cole-agent"] !== "1") {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Missing local agent header" }));
    return false;
  }
  return true;
}

async function body(req: IncomingMessage): Promise<any> {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 2_000_000) throw new Error("Request body is too large");
  }
  return text ? JSON.parse(text) : {};
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function withoutEvents(task: ReturnType<TaskManager["tasks"]["get"]>) {
  if (!task) return null;
  const { events: _events, ...summary } = task;
  return summary;
}

export function startLocalServer(config: AgentConfig, manager: TaskManager) {
  const server = createServer(async (req, res) => {
    if (!cors(req, res)) return;
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        json(res, 200, { ok: true, version: "0.1.0" });
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/devices") {
        json(res, 200, [
          {
            id: config.deviceId ?? "local",
            name: config.deviceName,
            connected: true,
            capabilities: {
              workspaces: config.workspaces.map(publicWorkspace),
              max_concurrency: config.maxConcurrency,
              version: "0.1.0",
            },
            created_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
        ]);
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/tasks") {
        const tasks = url.searchParams.get("archived") === "1"
          ? manager.store.loadSessions(true).map(({ record }) => record).filter((task) => task.archived_at)
          : [...manager.tasks.values()];
        json(res, 200, tasks.map((task) => withoutEvents(task)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/tasks") {
        const input = (await body(req)) as StartTaskInput;
        const task = manager.createTask(input);
        json(res, 201, withoutEvents(task));
        return;
      }
      const taskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
      if (req.method === "GET" && taskMatch) {
        const task = manager.tasks.get(taskMatch[1]);
        if (!task) return json(res, 404, { detail: "Task not found" });
        json(res, 200, task);
        return;
      }
      if (req.method === "PATCH" && taskMatch) {
        const payload = await body(req);
        let task = manager.tasks.get(taskMatch[1]);
        if (!task) return json(res, 404, { detail: "Task not found" });
        if (typeof payload.model === "string") task = manager.updateModel(taskMatch[1], payload.model);
        if (typeof payload.title === "string") task = manager.updateTitle(taskMatch[1], payload.title);
        if (typeof payload.workspace_id === "string") task = manager.updateWorkspace(taskMatch[1], payload.workspace_id);
        json(res, 200, withoutEvents(task));
        return;
      }
      const archiveMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/archive$/);
      if (req.method === "POST" && archiveMatch) {
        await manager.archiveTask(archiveMatch[1]);
        json(res, 200, { ok: true });
        return;
      }
      const restoreMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/restore$/);
      if (req.method === "POST" && restoreMatch) {
        json(res, 200, withoutEvents(manager.restoreTask(restoreMatch[1])));
        return;
      }
      const resumeMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/resume$/);
      if (req.method === "POST" && resumeMatch) {
        const payload = await body(req);
        manager.sendMessage(resumeMatch[1], String(payload.content ?? ""), payload.model);
        json(res, 202, { ok: true });
        return;
      }
      if (req.method === "DELETE" && taskMatch) {
        await manager.closeTask(taskMatch[1]);
        json(res, 200, { ok: true });
        return;
      }
      const messageMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/messages$/);
      if (req.method === "POST" && messageMatch) {
        const payload = await body(req);
        manager.sendMessage(messageMatch[1], String(payload.content ?? ""), payload.model);
        json(res, 202, { ok: true });
        return;
      }
      const actionMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/actions$/);
      if (req.method === "POST" && actionMatch) {
        const action = (await body(req)) as TaskAction;
        await manager.handleAction(actionMatch[1], action);
        json(res, 202, { ok: true });
        return;
      }
      const eventsMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)\/events$/);
      if (req.method === "GET" && eventsMatch) {
        const task = manager.tasks.get(eventsMatch[1]);
        if (!task) return json(res, 404, { detail: "Task not found" });
        let latest = Number(url.searchParams.get("after") ?? 0);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        for (const event of task.events) {
          if (event.seq <= latest) continue;
          latest = event.seq;
          res.write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
        }
        const unsubscribe = manager.subscribe(task.id, (event) => {
          if (event.seq <= latest) return;
          latest = event.seq;
          res.write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
        });
        const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 15_000);
        req.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
        return;
      }
      json(res, 404, { detail: "Not found" });
    } catch (error) {
      json(res, 400, { detail: error instanceof Error ? error.message : String(error) });
    }
  });
  server.listen(config.localPort, "127.0.0.1");
  return server;
}
