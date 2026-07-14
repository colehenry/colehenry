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
    maxOutputEventBytes?: number;
    timeoutMs?: number;
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
    const maxOutputEventBytes = options.maxOutputEventBytes ?? maxBytes;
    let forwardedBytes = 0;
    let outputTruncated = false;
    let timedOut = false;
    let stdout = "";
    let stderr = "";
    const forward = (stream: "stdout" | "stderr", chunk: string) => {
      if (!options.onOutput) return;
      const remaining = maxOutputEventBytes - forwardedBytes;
      const bytes = Buffer.from(chunk);
      if (remaining > 0) {
        const visible = bytes.subarray(0, remaining);
        forwardedBytes += visible.length;
        options.onOutput(stream, visible.toString());
      }
      if (bytes.length > Math.max(0, remaining) && !outputTruncated) {
        outputTruncated = true;
        options.onOutput(stream, "\n[command output truncated]\n");
      }
    };
    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout = (stdout + chunk).slice(-maxBytes);
      forward("stdout", chunk);
    });
    child.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr = (stderr + chunk).slice(-maxBytes);
      forward("stderr", chunk);
    });
    const timeout = options.timeoutMs ? setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs) : null;
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      const suffix = timedOut ? `\nCommand timed out after ${options.timeoutMs} ms.` : "";
      resolve({ code: timedOut ? 124 : code ?? 1, stdout, stderr: `${stderr}${suffix}` });
    });
    if (options.input) child.stdin.end(options.input);
    else child.stdin.end();
  });
}
