import { spawn } from "node:child_process";

export type ProcessResult = { code: number; stdout: string; stderr: string };

export function runProcess(
  command: string,
  args: string[],
  options: {
    cwd: string;
    input?: string;
    signal?: AbortSignal;
    onOutput?: (stream: "stdout" | "stderr", chunk: string) => void;
    maxBytes?: number;
  },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      signal: options.signal,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const maxBytes = options.maxBytes ?? 1_000_000;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout = (stdout + chunk).slice(-maxBytes);
      options.onOutput?.("stdout", chunk);
    });
    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr = (stderr + chunk).slice(-maxBytes);
      options.onOutput?.("stderr", chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    if (options.input) child.stdin.end(options.input);
    else child.stdin.end();
  });
}
