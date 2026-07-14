import assert from "node:assert/strict";
import test from "node:test";

import { configForDisk } from "../src/config.js";
import { reconciliationEvent } from "../src/remote.js";
import type { AgentConfig, TaskRecord } from "../src/types.js";

const config: AgentConfig = {
  serverUrl: "https://api.example.test",
  deviceName: "Test Mac",
  openRouterApiKey: "must-not-be-written",
  localPort: 7331,
  maxConcurrency: 2,
  workspaces: [],
};

function task(status: TaskRecord["status"]): TaskRecord {
  return {
    id: "task-1",
    device_id: "device-1",
    title: "Test",
    workspace_id: "workspace-1",
    workspace_name: "Repo",
    model: "model",
    branch: "dev",
    status,
    created_at: "2026-07-14T00:00:00Z",
    updated_at: "2026-07-14T00:00:00Z",
    events: [],
  };
}

test("never serializes the OpenRouter key into agent config", () => {
  const persisted = configForDisk(config);
  assert.equal("openRouterApiKey" in persisted, false);
  assert.equal(JSON.stringify(persisted).includes("must-not-be-written"), false);
});

test("reconciles recovered and terminal tasks with the hosted status", () => {
  assert.equal(reconciliationEvent(task("interrupted")).type, "task_interrupted");
  assert.equal(reconciliationEvent(task("running")).type, "task_started");
  assert.equal(reconciliationEvent(task("completed")).type, "task_completed");
  assert.equal(reconciliationEvent(task("failed")).type, "task_failed");
});
