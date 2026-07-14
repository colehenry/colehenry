export type Workspace = {
  id: string;
  name: string;
  path: string;
};

export type AgentConfig = {
  serverUrl: string;
  deviceId?: string;
  deviceToken?: string;
  deviceName: string;
  openRouterApiKey?: string;
  localPort: number;
  maxConcurrency: number;
  workspaces: Workspace[];
};

export type TaskStatus =
  | "draft"
  | "queued"
  | "running"
  | "attention"
  | "interrupted"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentEvent = {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type TaskRecord = {
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
  archived_at?: string | null;
  events: AgentEvent[];
};

export type RuntimeState = {
  cwd: string;
  branch: string | null;
  initialized: boolean;
  baselineStatus: string;
  baselinePatch: string;
};

export type StartTaskInput = {
  id?: string;
  device_id?: string;
  workspace_id: string;
  workspace_name: string;
  prompt: string;
  model: string;
  isolated?: boolean;
};

export type TaskAction = {
  type: string;
  payload?: Record<string, unknown>;
};

export type EventSink = (taskId: string, event: Omit<AgentEvent, "seq" | "created_at">) => void | Promise<void>;
