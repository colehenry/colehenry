type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ModelMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type ModelTurn = { content: string; toolCalls: ToolCall[] };

export const CODING_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List repository files. Use a glob to narrow the list when helpful.",
      parameters: {
        type: "object",
        properties: { glob: { type: "string", description: "Optional file glob such as src/**/*.ts" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file within the approved workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          start_line: { type: "integer", minimum: 1 },
          end_line: { type: "integer", minimum: 1 },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search",
      description: "Search repository text using ripgrep.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, glob: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Replace or create a UTF-8 text file. This requires user approval.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command inside the task workspace. This requires user approval.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
];

export async function streamModelTurn(options: {
  apiKey: string;
  model: string;
  messages: ModelMessage[];
  signal?: AbortSignal;
  onText: (text: string) => void | Promise<void>;
}): Promise<ModelTurn> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://colehenry.dev/coding",
      "X-Title": "colehenry.dev coding agent",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      tools: CODING_TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: false,
      stream: true,
    }),
    signal: options.signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = new Map<number, ToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line.startsWith("data:") || line === "data: [DONE]") continue;
      let frame: any;
      try {
        frame = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (frame.error) throw new Error(frame.error.message || "OpenRouter stream failed");
      const delta = frame.choices?.[0]?.delta;
      if (!delta) continue;
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        await options.onText(delta.content);
      }
      for (const raw of delta.tool_calls ?? []) {
        const index = Number(raw.index ?? 0);
        const current = toolCalls.get(index) ?? {
          id: raw.id ?? `tool-${index}`,
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        if (raw.id) current.id = raw.id;
        if (raw.function?.name) current.function.name += raw.function.name;
        if (raw.function?.arguments) current.function.arguments += raw.function.arguments;
        toolCalls.set(index, current);
      }
    }
  }
  return { content, toolCalls: [...toolCalls.values()] };
}
