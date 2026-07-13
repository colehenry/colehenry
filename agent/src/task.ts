import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { AGENT_HOME } from "./config.js";
import { streamModelTurn, type ModelMessage } from "./openrouter.js";
import { runProcess } from "./process.js";
import type { AgentConfig, TaskAction, TaskRecord, Workspace } from "./types.js";

type Emit = (type: string, payload?: Record<string, unknown>, forward?: boolean) => Promise<void>;
type Approval = { resolve: (approved: boolean) => void };

const SYSTEM_PROMPT = `You are a careful coding agent operating inside one approved workspace.
Inspect the repository before changing it. Make focused, maintainable edits. Use tools instead of guessing.
All writes and shell commands require the user's approval. Read-only tools do not.
After changing code, run the smallest relevant validation when practical. End with a concise summary of changes and validation.
Continue until the user's request is actually satisfied. Never end with progress language about what you are "currently" or "about to" do.
For a broad request such as "audit", inspect representative architecture, backend, frontend, security, tests, and deployment surfaces, then return concrete prioritized findings.
If a tool fails, inspect its error and try another available tool or approach. Do not claim the repository is inaccessible after one missing utility.
Never access paths outside the workspace. Never expose secrets or copy credential files into your response.`;

function within(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function safePath(root: string, requested: string): Promise<string> {
  if (!requested || isAbsolute(requested)) throw new Error("Path must be relative to the workspace");
  const normalizedRoot = await realpath(root);
  const target = resolve(normalizedRoot, requested);
  if (!within(normalizedRoot, target)) throw new Error("Path escapes the approved workspace");
  try {
    const resolvedTarget = await realpath(target);
    if (!within(normalizedRoot, resolvedTarget)) throw new Error("Path follows a link outside the workspace");
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
    let ancestor = dirname(target);
    while (ancestor !== normalizedRoot) {
      try {
        const resolvedAncestor = await realpath(ancestor);
        if (!within(normalizedRoot, resolvedAncestor)) throw new Error("Path follows a link outside the workspace");
        break;
      } catch (ancestorError: any) {
        if (ancestorError?.code !== "ENOENT") throw ancestorError;
        ancestor = dirname(ancestor);
      }
    }
  }
  return target;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new Error("Model returned invalid tool arguments");
  }
}

function visibleArgs(name: string, args: Record<string, unknown>) {
  if (name !== "write_file") return args;
  return { path: args.path, bytes: String(args.content ?? "").length };
}

function toolLabel(name: string, args: Record<string, unknown>): string {
  if (name === "read_file") return `Reading ${String(args.path ?? "file")}`;
  if (name === "list_files") return "Scanning files";
  if (name === "search") return `Searching for ${String(args.query ?? "text")}`;
  if (name === "write_file") return `Editing ${String(args.path ?? "file")}`;
  if (name === "run_command") return `Running ${String(args.command ?? "command")}`;
  return name;
}

function missingExecutable(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function globRegex(pattern: string): RegExp {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      index += 1;
      if (pattern[index + 1] === "/") {
        index += 1;
        source += "(?:.*/)?";
      } else source += ".*";
    } else if (character === "*") source += "[^/]*";
    else if (character === "?") source += "[^/]";
    else source += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  return new RegExp(`${source}$`);
}

const skippedDirectories = new Set([".git", ".next", ".venv", "build", "coverage", "dist", "node_modules"]);

async function fallbackFileList(root: string): Promise<string[]> {
  const git = await runProcess(
    "/usr/bin/git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root },
  );
  if (git.code === 0) return git.stdout.split("\n").filter(Boolean);

  const files: string[] = [];
  async function walk(directory: string, prefix = ""): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(resolve(directory, entry.name), path);
      else if (entry.isFile()) files.push(path);
      if (files.length >= 10_000) return;
    }
  }
  await walk(root);
  return files;
}

async function fallbackSearch(root: string, query: string, glob?: string): Promise<string> {
  const matcher = glob ? globRegex(glob) : null;
  const files = (await fallbackFileList(root)).filter((path) => !matcher || matcher.test(path));
  const matches: string[] = [];
  for (const path of files.slice(0, 5_000)) {
    const target = resolve(root, path);
    try {
      const info = await stat(target);
      if (info.size > 1_000_000) continue;
      const content = await readFile(target, "utf8");
      if (content.includes("\0")) continue;
      for (const [index, line] of content.split("\n").entries()) {
        if (line.includes(query)) matches.push(`${path}:${index + 1}:${line}`);
        if (matches.length >= 500) return matches.join("\n");
      }
    } catch {
      // Files can disappear between listing and reading; skip them.
    }
  }
  return matches.join("\n") || "No matches";
}

export class TaskRuntime {
  readonly record: TaskRecord;
  private cwd = "";
  private branch: string | null = null;
  private initialized = false;
  private baselineStatus = "";
  private baselinePatch = "";
  private abortController: AbortController | null = null;
  private approvals = new Map<string, Approval>();
  private messages: ModelMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  constructor(
    record: TaskRecord,
    private readonly workspace: Workspace,
    private readonly config: AgentConfig,
    private readonly emit: Emit,
    private readonly isolated: boolean,
  ) {
    this.record = record;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    this.cwd = this.workspace.path;
    const gitRoot = await runProcess("git", ["rev-parse", "--show-toplevel"], {
      cwd: this.workspace.path,
    });
    if (gitRoot.code === 0) {
      const root = gitRoot.stdout.trim();
      const currentBranch = await runProcess("git", ["branch", "--show-current"], {
        cwd: this.workspace.path,
      });
      this.branch = currentBranch.stdout.trim() || null;
      if (this.isolated) {
        const subpath = relative(root, this.workspace.path);
        const worktree = resolve(AGENT_HOME, "worktrees", this.workspace.id, this.record.id);
        await mkdir(dirname(worktree), { recursive: true });
        this.branch = `codex/agent-${this.record.id.slice(0, 8)}`;
        const created = await runProcess(
          "git",
          ["worktree", "add", "-b", this.branch, worktree, "HEAD"],
          { cwd: root },
        );
        if (created.code !== 0) throw new Error(`Could not create isolated worktree: ${created.stderr}`);
        this.cwd = resolve(worktree, subpath);
      }
    } else if (this.isolated) {
      await this.emit("activity", {
        label: "Workspace is not a Git repository; using its approved directory directly",
      });
    }
    this.initialized = true;
    const baselineStatus = await runProcess("git", ["status", "--short"], { cwd: this.cwd });
    const baselinePatch = await runProcess("git", ["diff", "--no-ext-diff", "--unified=3"], { cwd: this.cwd });
    this.baselineStatus = baselineStatus.stdout;
    this.baselinePatch = baselinePatch.stdout;
    this.record.branch = this.branch;
    await this.emit("task_started", { branch: this.branch, cwd: this.workspace.name });
  }

  async process(prompt: string, model?: string): Promise<void> {
    if (!this.config.openRouterApiKey) {
      await this.emit("task_failed", {
        message: "OPENROUTER_API_KEY is not configured in the local agent.",
      });
      return;
    }
    if (model) this.record.model = model;
    this.abortController = new AbortController();
    try {
      if (this.initialized) await this.emit("task_started", { branch: this.branch, cwd: this.workspace.name });
      else await this.initialize();
      this.messages.push({ role: "user", content: prompt });
      for (let iteration = 0; iteration < 20; iteration += 1) {
        const turnId = randomUUID();
        let deltaBuffer = "";
        let lastFlush = Date.now();
        const turn = await streamModelTurn({
          apiKey: this.config.openRouterApiKey,
          model: this.record.model,
          messages: this.messages,
          signal: this.abortController.signal,
          onText: async (text) => {
            deltaBuffer += text;
            if (deltaBuffer.length >= 48 || text.includes("\n") || Date.now() - lastFlush >= 80) {
              const chunk = deltaBuffer;
              deltaBuffer = "";
              lastFlush = Date.now();
              await this.emit("assistant_delta", { turn_id: turnId, text: chunk });
            }
          },
        });
        if (deltaBuffer) await this.emit("assistant_delta", { turn_id: turnId, text: deltaBuffer });
        const assistant: ModelMessage = {
          role: "assistant",
          content: turn.content || null,
          ...(turn.toolCalls.length ? { tool_calls: turn.toolCalls } : {}),
        };
        this.messages.push(assistant);
        if (turn.toolCalls.length && turn.content) {
          await this.emit("assistant_message", { turn_id: turnId, content: turn.content });
        }
        if (!turn.toolCalls.length) {
          await this.emit("assistant_message", { turn_id: turnId, content: turn.content });
          await this.emitDiff();
          await this.emit("task_completed", { message: "Agent finished" });
          return;
        }
        for (const call of turn.toolCalls) {
          const args = parseArgs(call.function.arguments);
          const toolId = call.id || randomUUID();
          await this.emit("tool_started", {
            id: toolId,
            name: call.function.name,
            label: toolLabel(call.function.name, args),
            args: visibleArgs(call.function.name, args),
          });
          let output: string;
          try {
            output = await this.executeTool(toolId, call.function.name, args);
            await this.emit("tool_finished", {
              id: toolId,
              name: call.function.name,
              ok: true,
              summary: output.slice(0, 500),
            });
          } catch (error) {
            output = `Tool failed: ${error instanceof Error ? error.message : String(error)}`;
            await this.emit("tool_finished", {
              id: toolId,
              name: call.function.name,
              ok: false,
              summary: output,
            });
          }
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: output.slice(0, 60_000),
          });
        }
      }
      throw new Error("Agent reached the 20-step safety limit");
    } catch (error: any) {
      if (error?.name === "AbortError") {
        await this.emit("task_cancelled", { message: "Task cancelled" });
      } else {
        await this.emit("task_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      this.abortController = null;
    }
  }

  async handleAction(action: TaskAction): Promise<void> {
    if (action.type === "cancel") {
      this.abortController?.abort();
      for (const approval of this.approvals.values()) approval.resolve(false);
      this.approvals.clear();
      return;
    }
    if (action.type !== "approval_response") return;
    const approvalId = String(action.payload?.approval_id ?? "");
    const pending = this.approvals.get(approvalId);
    if (!pending) return;
    this.approvals.delete(approvalId);
    const approved = Boolean(action.payload?.approved);
    await this.emit("task_started", { branch: this.branch, resumed_after_approval: true });
    pending.resolve(approved);
  }

  private async requestApproval(
    toolId: string,
    tool: string,
    details: Record<string, unknown>,
  ): Promise<boolean> {
    const approvalId = randomUUID();
    await this.emit("approval_required", {
      approval_id: approvalId,
      tool_id: toolId,
      tool,
      details,
    });
    return new Promise<boolean>((resolveApproval) => {
      this.approvals.set(approvalId, { resolve: resolveApproval });
    });
  }

  private async executeTool(
    toolId: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (name === "list_files") {
      const glob = typeof args.glob === "string" && args.glob ? args.glob : undefined;
      try {
        const result = await runProcess("rg", glob ? ["--files", "-g", glob] : ["--files"], {
          cwd: this.cwd,
        });
        if (result.code !== 0 && !result.stdout) throw new Error(result.stderr || "Could not list files");
        return result.stdout.split("\n").slice(0, 600).join("\n");
      } catch (error) {
        if (!missingExecutable(error)) throw error;
        const matcher = glob ? globRegex(glob) : null;
        return (await fallbackFileList(this.cwd))
          .filter((path) => !matcher || matcher.test(path))
          .slice(0, 600)
          .join("\n");
      }
    }
    if (name === "read_file") {
      const target = await safePath(this.cwd, String(args.path ?? ""));
      const info = await stat(target);
      if (info.size > 1_000_000) throw new Error("File is larger than 1 MB");
      const lines = (await readFile(target, "utf8")).split("\n");
      const start = Math.max(1, Number(args.start_line ?? 1));
      const end = Math.min(lines.length, Number(args.end_line ?? start + 799));
      return lines
        .slice(start - 1, end)
        .map((line, index) => `${start + index}: ${line}`)
        .join("\n");
    }
    if (name === "search") {
      const query = String(args.query ?? "");
      if (!query) throw new Error("Search query is empty");
      const commandArgs = ["-n", "--hidden", "--glob", "!.git"];
      if (typeof args.glob === "string" && args.glob) commandArgs.push("--glob", args.glob);
      commandArgs.push("--", query, ".");
      try {
        const result = await runProcess("rg", commandArgs, { cwd: this.cwd });
        if (result.code > 1) throw new Error(result.stderr || "Search failed");
        return result.stdout.split("\n").slice(0, 500).join("\n") || "No matches";
      } catch (error) {
        if (!missingExecutable(error)) throw error;
        return fallbackSearch(this.cwd, query, typeof args.glob === "string" ? args.glob : undefined);
      }
    }
    if (name === "write_file") {
      const requested = String(args.path ?? "");
      const content = String(args.content ?? "");
      const approved = await this.requestApproval(toolId, name, {
        path: requested,
        bytes: Buffer.byteLength(content),
      });
      if (!approved) return "User denied the file write.";
      const target = await safePath(this.cwd, requested);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
      await this.emitFileDiff(requested);
      return `Wrote ${Buffer.byteLength(content)} bytes to ${requested}`;
    }
    if (name === "run_command") {
      const command = String(args.command ?? "").trim();
      if (!command) throw new Error("Command is empty");
      const approved = await this.requestApproval(toolId, name, {
        command,
        cwd: this.workspace.name,
      });
      if (!approved) return "User denied the command.";
      let outputEvents = Promise.resolve();
      const result = await runProcess("/bin/zsh", ["-lc", command], {
        cwd: this.cwd,
        signal: this.abortController?.signal,
        onOutput: (stream, chunk) => {
          outputEvents = outputEvents.then(() => this.emit("command_output", { tool_id: toolId, stream, text: chunk }));
        },
      });
      await outputEvents;
      return `Exit code: ${result.code}\n${result.stdout}${result.stderr}`.slice(0, 60_000);
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  private async emitFileDiff(path: string): Promise<void> {
    const status = await runProcess("git", ["status", "--short", "--", path], { cwd: this.cwd });
    const diff = await runProcess("git", ["diff", "--no-ext-diff", "--unified=3", "--", path], {
      cwd: this.cwd,
    });
    await this.emit("diff", {
      files: [{ path, status: status.stdout.trim() || "modified" }],
      patch: diff.stdout,
    });
  }

  private async emitDiff(): Promise<void> {
    const status = await runProcess("git", ["status", "--short"], { cwd: this.cwd });
    if (status.code !== 0 || !status.stdout.trim()) return;
    const diff = await runProcess("git", ["diff", "--no-ext-diff", "--unified=3"], { cwd: this.cwd });
    if (status.stdout === this.baselineStatus && diff.stdout === this.baselinePatch) return;
    const files = status.stdout
      .trimEnd()
      .split("\n")
      .filter(Boolean)
      .map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3) }));
    const additions = (diff.stdout.match(/^\+(?!\+\+)/gm) ?? []).length;
    const deletions = (diff.stdout.match(/^-(?!--)/gm) ?? []).length;
    await this.emit("diff", { files, patch: diff.stdout, additions, deletions });
  }
}
