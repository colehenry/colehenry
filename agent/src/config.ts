import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { basename, resolve } from "node:path";

import type { AgentConfig, Workspace } from "./types.js";
import { readOpenRouterKey } from "./keychain.js";

export const AGENT_HOME = process.env.COLE_AGENT_HOME ?? resolve(homedir(), ".cole-agent");
export const CONFIG_PATH = resolve(AGENT_HOME, "config.json");
export const SESSION_DB_PATH = process.env.COLE_AGENT_SESSION_DB ?? resolve(AGENT_HOME, "sessions.sqlite3");

const defaults: AgentConfig = {
  serverUrl: "https://api.colehenry.dev",
  deviceName: hostname(),
  localPort: 7331,
  maxConcurrency: 2,
  workspaces: [],
};

export async function loadConfig(): Promise<AgentConfig> {
  const keychainKey = await readOpenRouterKey();
  try {
    const parsed = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as Partial<AgentConfig>;
    return {
      ...defaults,
      ...parsed,
      openRouterApiKey: keychainKey ?? parsed.openRouterApiKey,
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
    };
  } catch {
    return { ...defaults, openRouterApiKey: keychainKey };
  }
}

export async function saveConfig(config: AgentConfig): Promise<void> {
  await mkdir(AGENT_HOME, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export async function addWorkspace(path: string, name?: string): Promise<Workspace> {
  const config = await loadConfig();
  const absolute = await realpath(resolve(path));
  const existing = config.workspaces.find((workspace) => workspace.path === absolute);
  if (existing) return existing;
  const workspace = { id: randomUUID(), name: name?.trim() || basename(absolute), path: absolute };
  config.workspaces.push(workspace);
  await saveConfig(config);
  return workspace;
}

export function publicWorkspace(workspace: Workspace) {
  const home = homedir();
  return {
    id: workspace.id,
    name: workspace.name,
    path_hint: workspace.path.startsWith(home) ? `~${workspace.path.slice(home.length)}` : workspace.path,
  };
}
