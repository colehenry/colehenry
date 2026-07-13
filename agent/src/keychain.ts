import { execFile } from "node:child_process";
import { userInfo } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const service = "cole-agent-openrouter";

export async function readOpenRouterKey(): Promise<string | undefined> {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (process.env.OPEN_ROUTER_API_KEY) return process.env.OPEN_ROUTER_API_KEY;
  if (process.platform !== "darwin") return undefined;
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-a",
      userInfo().username,
      "-s",
      service,
      "-w",
    ]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function storeOpenRouterKey(key: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("Keychain storage is currently supported on macOS; use OPENROUTER_API_KEY elsewhere.");
  }
  await execFileAsync("security", [
    "add-generic-password",
    "-U",
    "-a",
    userInfo().username,
    "-s",
    service,
    "-w",
    key,
  ]);
}

export function promptSecret(label: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal");
  }
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}
