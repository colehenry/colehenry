import Database from "better-sqlite3";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { ModelMessage } from "./openrouter.js";
import type { AgentEvent, RuntimeState, TaskRecord, TaskStatus } from "./types.js";

type SessionRow = {
  id: string;
  device_id: string;
  title: string;
  workspace_id: string;
  workspace_name: string;
  model: string;
  branch: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  cwd: string;
  initialized: number;
  baseline_status: string;
  baseline_patch: string;
};

type EventRow = {
  seq: number;
  type: string;
  payload: string;
  created_at: string;
};

type MessageRow = {
  role: ModelMessage["role"];
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
};

const INTERRUPTED_RESULT = "Tool execution was interrupted when the local agent stopped. Inspect the repository and command state before deciding whether to retry it.";

export class SessionStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new Database(path);
    chmodSync(path, 0o600);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.migrate();
    this.recoverInterruptedWork();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        title TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        workspace_name TEXT NOT NULL,
        model TEXT NOT NULL,
        branch TEXT,
        status TEXT NOT NULL,
        cwd TEXT NOT NULL DEFAULT '',
        initialized INTEGER NOT NULL DEFAULT 0,
        baseline_status TEXT NOT NULL DEFAULT '',
        baseline_patch TEXT NOT NULL DEFAULT '',
        system_prompt_version INTEGER NOT NULL DEFAULT 1,
        context_snapshot_sha TEXT,
        summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_sessions_active_updated
        ON sessions(archived_at, updated_at DESC);
      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        partial_content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_turns_session ON turns(session_id, created_at);
      CREATE TABLE IF NOT EXISTS model_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        turn_id TEXT,
        role TEXT NOT NULL,
        content TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(session_id, seq)
      );
      CREATE INDEX IF NOT EXISTS ix_model_messages_session
        ON model_messages(session_id, seq);
      CREATE TABLE IF NOT EXISTS tool_runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        turn_id TEXT NOT NULL,
        name TEXT NOT NULL,
        arguments TEXT NOT NULL,
        status TEXT NOT NULL,
        result TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_tool_runs_session
        ON tool_runs(session_id, created_at);
      CREATE TABLE IF NOT EXISTS events (
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(session_id, seq)
      );
      CREATE INDEX IF NOT EXISTS ix_events_session ON events(session_id, seq);
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (1, datetime('now'));
    `);
  }

  private recoverInterruptedWork(): void {
    const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      const interrupted = this.db.prepare(
        "SELECT id, session_id FROM tool_runs WHERE status IN ('running', 'awaiting_approval')",
      ).all() as { id: string; session_id: string }[];
      for (const tool of interrupted) {
        this.db.prepare(
          "UPDATE tool_runs SET status = 'interrupted', result = ?, updated_at = ? WHERE id = ?",
        ).run(INTERRUPTED_RESULT, now, tool.id);
        const callAlreadyClosed = this.db.prepare(
          "SELECT 1 FROM model_messages WHERE session_id = ? AND role = 'tool' AND tool_call_id = ?",
        ).get(tool.session_id, tool.id);
        if (!callAlreadyClosed) this.appendModelMessage(tool.session_id, { role: "tool", tool_call_id: tool.id, content: INTERRUPTED_RESULT }, null, now);
      }
      const assistantCalls = this.db.prepare(
        "SELECT session_id, tool_calls FROM model_messages WHERE role = 'assistant' AND tool_calls IS NOT NULL",
      ).all() as { session_id: string; tool_calls: string }[];
      for (const row of assistantCalls) {
        const calls = JSON.parse(row.tool_calls) as { id?: string }[];
        for (const call of calls) {
          if (!call.id) continue;
          const closed = this.db.prepare(
            "SELECT 1 FROM model_messages WHERE session_id = ? AND role = 'tool' AND tool_call_id = ?",
          ).get(row.session_id, call.id);
          if (closed) continue;
          const run = this.db.prepare(
            "SELECT status, result FROM tool_runs WHERE session_id = ? AND id = ?",
          ).get(row.session_id, call.id) as { status: string; result: string | null } | undefined;
          const result = run?.result || INTERRUPTED_RESULT;
          this.appendModelMessage(row.session_id, { role: "tool", tool_call_id: call.id, content: result }, null, now);
        }
      }
      this.db.prepare(
        "UPDATE turns SET status = 'interrupted', updated_at = ? WHERE status IN ('queued', 'running', 'awaiting_approval')",
      ).run(now);
      const sessions = this.db.prepare(
        "SELECT id FROM sessions WHERE status IN ('queued', 'running', 'attention') AND archived_at IS NULL",
      ).all() as { id: string }[];
      for (const session of sessions) {
        this.db.prepare("UPDATE sessions SET status = 'interrupted', updated_at = ? WHERE id = ?").run(now, session.id);
        const last = this.db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM events WHERE session_id = ?").get(session.id) as { seq: number };
        this.db.prepare(
          "INSERT INTO events(session_id, seq, type, payload, created_at) VALUES (?, ?, 'task_interrupted', ?, ?)",
        ).run(session.id, last.seq + 1, JSON.stringify({ message: "Agent stopped before this task finished" }), now);
      }
    });
    transaction();
  }

  createSession(record: TaskRecord): void {
    this.db.prepare(`
      INSERT INTO sessions(
        id, device_id, title, workspace_id, workspace_name, model, branch, status,
        created_at, updated_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id, record.device_id, record.title, record.workspace_id, record.workspace_name,
      record.model, record.branch, record.status, record.created_at, record.updated_at,
      record.archived_at ?? null,
    );
  }

  loadSessions(includeArchived = false): { record: TaskRecord; runtime: RuntimeState }[] {
    const rows = this.db.prepare(`
      SELECT * FROM sessions
      ${includeArchived ? "" : "WHERE archived_at IS NULL"}
      ORDER BY updated_at DESC
    `).all() as SessionRow[];
    return rows.map((row) => ({
      record: this.rowToRecord(row),
      runtime: {
        cwd: row.cwd,
        branch: row.branch,
        initialized: Boolean(row.initialized),
        baselineStatus: row.baseline_status,
        baselinePatch: row.baseline_patch,
      },
    }));
  }

  getSession(id: string): { record: TaskRecord; runtime: RuntimeState } | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
    if (!row) return null;
    return {
      record: this.rowToRecord(row),
      runtime: {
        cwd: row.cwd,
        branch: row.branch,
        initialized: Boolean(row.initialized),
        baselineStatus: row.baseline_status,
        baselinePatch: row.baseline_patch,
      },
    };
  }

  private rowToRecord(row: SessionRow): TaskRecord {
    const eventRows = this.db.prepare(
      "SELECT seq, type, payload, created_at FROM events WHERE session_id = ? ORDER BY seq",
    ).all(row.id) as EventRow[];
    return {
      id: row.id,
      device_id: row.device_id,
      title: row.title,
      workspace_id: row.workspace_id,
      workspace_name: row.workspace_name,
      model: row.model,
      branch: row.branch,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      archived_at: row.archived_at,
      events: eventRows.map((event) => ({
        seq: event.seq,
        type: event.type,
        payload: JSON.parse(event.payload),
        created_at: event.created_at,
      })),
    };
  }

  updateSession(record: TaskRecord): void {
    this.db.prepare(`
      UPDATE sessions SET title = ?, workspace_id = ?, workspace_name = ?, model = ?, branch = ?, status = ?, updated_at = ?, archived_at = ?
      WHERE id = ?
    `).run(
      record.title,
      record.workspace_id,
      record.workspace_name,
      record.model,
      record.branch,
      record.status,
      record.updated_at,
      record.archived_at ?? null,
      record.id,
    );
  }

  appendEventAndUpdate(record: TaskRecord, event: AgentEvent): void {
    this.db.transaction(() => {
      this.appendEvent(record.id, event);
      this.updateSession(record);
    })();
  }

  updateRuntime(sessionId: string, state: RuntimeState): void {
    this.db.prepare(`
      UPDATE sessions SET cwd = ?, branch = ?, initialized = ?, baseline_status = ?, baseline_patch = ?
      WHERE id = ?
    `).run(state.cwd, state.branch, state.initialized ? 1 : 0, state.baselineStatus, state.baselinePatch, sessionId);
  }

  appendEvent(sessionId: string, event: AgentEvent): void {
    this.db.prepare(
      "INSERT INTO events(session_id, seq, type, payload, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(sessionId, event.seq, event.type, JSON.stringify(event.payload), event.created_at);
  }

  loadModelMessages(sessionId: string): ModelMessage[] {
    const rows = this.db.prepare(`
      SELECT role, content, tool_calls, tool_call_id
      FROM model_messages WHERE session_id = ? ORDER BY seq
    `).all(sessionId) as MessageRow[];
    return rows.map((row) => ({
      role: row.role,
      content: row.content,
      ...(row.tool_calls ? { tool_calls: JSON.parse(row.tool_calls) } : {}),
      ...(row.tool_call_id ? { tool_call_id: row.tool_call_id } : {}),
    }));
  }

  appendModelMessage(sessionId: string, message: ModelMessage, turnId: string | null, createdAt = new Date().toISOString()): void {
    const last = this.db.prepare(
      "SELECT COALESCE(MAX(seq), 0) AS seq FROM model_messages WHERE session_id = ?",
    ).get(sessionId) as { seq: number };
    this.db.prepare(`
      INSERT INTO model_messages(session_id, seq, turn_id, role, content, tool_calls, tool_call_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      last.seq + 1,
      turnId,
      message.role,
      message.content,
      message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      message.tool_call_id ?? null,
      createdAt,
    );
  }

  startTurn(sessionId: string, turnId: string, prompt: string): void {
    const now = new Date().toISOString();
    this.db.prepare(
      "INSERT INTO turns(id, session_id, prompt, status, created_at, updated_at) VALUES (?, ?, ?, 'running', ?, ?)",
    ).run(turnId, sessionId, prompt, now, now);
  }

  beginTurn(sessionId: string, turnId: string, prompt: string, message: ModelMessage): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.prepare(
        "INSERT INTO turns(id, session_id, prompt, status, created_at, updated_at) VALUES (?, ?, ?, 'running', ?, ?)",
      ).run(turnId, sessionId, prompt, now, now);
      this.appendModelMessage(sessionId, message, turnId, now);
    })();
  }

  updateTurn(turnId: string, status: string, partialContent?: string): void {
    const now = new Date().toISOString();
    if (partialContent === undefined) {
      this.db.prepare("UPDATE turns SET status = ?, updated_at = ? WHERE id = ?").run(status, now, turnId);
    } else {
      this.db.prepare("UPDATE turns SET status = ?, partial_content = ?, updated_at = ? WHERE id = ?").run(status, partialContent, now, turnId);
    }
  }

  startTool(sessionId: string, turnId: string, id: string, name: string, args: Record<string, unknown>): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR REPLACE INTO tool_runs(id, session_id, turn_id, name, arguments, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'running', ?, ?)
    `).run(id, sessionId, turnId, name, JSON.stringify(args), now, now);
  }

  updateTool(id: string, status: string, result?: string): void {
    this.db.prepare(
      "UPDATE tool_runs SET status = ?, result = COALESCE(?, result), updated_at = ? WHERE id = ?",
    ).run(status, result ?? null, new Date().toISOString(), id);
  }

  archive(sessionId: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE sessions SET archived_at = ?, updated_at = ? WHERE id = ?").run(now, now, sessionId);
  }

  restore(sessionId: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE sessions SET archived_at = NULL, updated_at = ? WHERE id = ?").run(now, sessionId);
  }

  delete(sessionId: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }
}
