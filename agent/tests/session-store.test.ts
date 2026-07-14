import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { TaskManager } from "../src/manager.js";
import { SessionStore } from "../src/store.js";
import type { AgentConfig, TaskRecord } from "../src/types.js";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "cole-agent-test-"));
  return {
    directory,
    database: join(directory, "sessions.sqlite3"),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function record(id = "session-1"): TaskRecord {
  const now = new Date().toISOString();
  return {
    id,
    device_id: "local",
    title: "Durable task",
    workspace_id: "workspace-1",
    workspace_name: "fixture",
    model: "test/model",
    branch: "dev",
    status: "running",
    created_at: now,
    updated_at: now,
    archived_at: null,
    events: [],
  };
}

test("persists exact model messages and recovers interrupted tools", () => {
  const files = fixture();
  try {
    const first = new SessionStore(files.database);
    const task = record();
    first.createSession(task);
    first.appendModelMessage(task.id, { role: "system", content: "system" }, null);
    first.appendModelMessage(task.id, { role: "user", content: "change it" }, "turn-1");
    first.appendModelMessage(task.id, {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "tool-1", type: "function", function: { name: "run_command", arguments: "{\"command\":\"npm test\"}" } }],
    }, "turn-1");
    first.startTurn(task.id, "turn-1", "change it");
    first.startTool(task.id, "turn-1", "tool-1", "run_command", { command: "npm test" });
    first.updateSystemMessage(task.id, "updated system");
    first.close();

    const recovered = new SessionStore(files.database);
    const session = recovered.getSession(task.id);
    assert.equal(session?.record.status, "interrupted");
    assert.equal(session?.record.events.at(-1)?.type, "task_interrupted");
    const messages = recovered.loadModelMessages(task.id);
    assert.deepEqual(messages.slice(0, 3), [
      { role: "system", content: "updated system" },
      { role: "user", content: "change it" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "tool-1", type: "function", function: { name: "run_command", arguments: "{\"command\":\"npm test\"}" } }],
      },
    ]);
    assert.equal(messages.at(-1)?.role, "tool");
    assert.equal(messages.at(-1)?.tool_call_id, "tool-1");
    assert.match(messages.at(-1)?.content ?? "", /interrupted/i);
    recovered.close();
  } finally {
    files.cleanup();
  }
});

test("manager reloads drafts and archive is reversible without deletion", async () => {
  const files = fixture();
  try {
    const config: AgentConfig = {
      serverUrl: "https://example.invalid",
      deviceName: "test",
      localPort: 7331,
      maxConcurrency: 2,
      workspaces: [
        { id: "workspace-1", name: "fixture", path: files.directory },
        { id: "workspace-2", name: "second fixture", path: files.directory },
      ],
    };
    const first = new TaskManager(config, new SessionStore(files.database));
    const task = first.createTask({
      workspace_id: "workspace-1",
      workspace_name: "fixture",
      prompt: "",
      model: "test/model",
      isolated: false,
    });
    first.updateTitle(task.id, "Renamed session");
    first.updateWorkspace(task.id, "workspace-2");
    first.store.close();

    const second = new TaskManager(config, new SessionStore(files.database));
    assert.equal(second.tasks.get(task.id)?.title, "Renamed session");
    assert.equal(second.tasks.get(task.id)?.workspace_id, "workspace-2");
    assert.equal(second.tasks.get(task.id)?.workspace_name, "second fixture");
    await second.archiveTask(task.id);
    assert.equal(second.tasks.has(task.id), false);
    assert.equal(second.store.getSession(task.id)?.record.archived_at !== null, true);
    const restored = second.restoreTask(task.id);
    assert.equal(restored.title, "Renamed session");
    assert.equal(restored.archived_at, null);
    await second.archiveTask(task.id);
    await second.closeTask(task.id);
    assert.equal(second.store.getSession(task.id), null);
    second.store.close();
  } finally {
    files.cleanup();
  }
});
