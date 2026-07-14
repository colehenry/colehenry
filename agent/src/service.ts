import { execFile } from "node:child_process";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { AGENT_HOME } from "./config.js";

const execFileAsync = promisify(execFile);
const label = "dev.colehenry.coding-agent";
const plistPath = resolve(homedir(), "Library", "LaunchAgents", `${label}.plist`);

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function serviceDefinition(nodePath: string, entryPath: string): string {
  const servicePath = [
    dirname(nodePath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ].join(":");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodePath)}</string>
    <string>${xml(entryPath)}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${xml(servicePath)}</string>
  </dict>
  <key>StandardOutPath</key><string>${xml(resolve(AGENT_HOME, "agent.log"))}</string>
  <key>StandardErrorPath</key><string>${xml(resolve(AGENT_HOME, "agent.error.log"))}</string>
</dict>
</plist>
`;
}

export async function installService(): Promise<void> {
  if (process.platform !== "darwin") throw new Error("Background service installation currently supports macOS");
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const entryPath = resolve(packageRoot, "dist", "index.js");
  await access(entryPath);
  await mkdir(AGENT_HOME, { recursive: true, mode: 0o700 });
  await mkdir(dirname(plistPath), { recursive: true });
  await writeFile(plistPath, serviceDefinition(process.execPath, entryPath), { mode: 0o600 });
  const domain = `gui/${process.getuid?.() ?? 501}`;
  await execFileAsync("launchctl", ["bootout", domain, plistPath]).catch(() => undefined);
  await execFileAsync("launchctl", ["bootstrap", domain, plistPath]);
  await execFileAsync("launchctl", ["enable", `${domain}/${label}`]);
}

export async function uninstallService(): Promise<void> {
  if (process.platform !== "darwin") throw new Error("Background service installation currently supports macOS");
  const domain = `gui/${process.getuid?.() ?? 501}`;
  await execFileAsync("launchctl", ["bootout", domain, plistPath]).catch(() => undefined);
  await unlink(plistPath).catch(() => undefined);
}

export async function serviceStatus(): Promise<string> {
  if (process.platform !== "darwin") return "unsupported";
  const domain = `gui/${process.getuid?.() ?? 501}`;
  try {
    const { stdout } = await execFileAsync("launchctl", ["print", `${domain}/${label}`]);
    const state = stdout.match(/state = ([^\n]+)/)?.[1]?.trim();
    return state || "loaded";
  } catch {
    return "not installed";
  }
}
