#!/usr/bin/env node
import { addWorkspace, loadConfig, saveConfig, SESSION_DB_PATH } from "./config.js";
import { TaskManager } from "./manager.js";
import { promptSecret, storeOpenRouterKey } from "./keychain.js";
import { pairRemote, RemoteRelay } from "./remote.js";
import { startLocalServer } from "./server.js";
import { installService, serviceStatus, uninstallService } from "./service.js";

async function main() {
  const [command = "start", ...args] = process.argv.slice(2);
  if (command === "workspace" && args[0] === "add") {
    if (!args[1]) throw new Error("Usage: cole-agent workspace add <path> [name]");
    const workspace = await addWorkspace(args[1], args.slice(2).join(" ") || undefined);
    console.log(`Added workspace ${workspace.name}: ${workspace.path}`);
    return;
  }
  if (command === "pair") {
    if (!args[0]) throw new Error("Usage: cole-agent pair <code> [server-url]");
    const paired = await pairRemote(await loadConfig(), args[0], args[1]);
    await saveConfig(paired);
    console.log(`Paired ${paired.deviceName} with ${paired.serverUrl}`);
    return;
  }
  if (command === "key" && args[0] === "set") {
    const key = await promptSecret("OpenRouter API key: ");
    if (!key) throw new Error("API key cannot be empty");
    await storeOpenRouterKey(key);
    console.log("OpenRouter API key saved in macOS Keychain");
    return;
  }
  if (command === "doctor") {
    const config = await loadConfig();
    console.log(JSON.stringify({
      serverUrl: config.serverUrl,
      paired: Boolean(config.deviceId && config.deviceToken),
      openRouterConfigured: Boolean(config.openRouterApiKey),
      localUrl: `http://127.0.0.1:${config.localPort}`,
      sessionDatabase: SESSION_DB_PATH,
      maxConcurrency: config.maxConcurrency,
      workspaces: config.workspaces.map(({ id, name, path }) => ({ id, name, path })),
    }, null, 2));
    return;
  }
  if (command === "service") {
    if (args[0] === "install") {
      await installService();
      console.log("Coding agent installed as a login service");
      return;
    }
    if (args[0] === "uninstall") {
      await uninstallService();
      console.log("Coding agent login service removed");
      return;
    }
    if (args[0] === "status") {
      console.log(await serviceStatus());
      return;
    }
    throw new Error("Usage: cole-agent service <install|uninstall|status>");
  }
  if (command !== "start") throw new Error(`Unknown command: ${command}`);

  const config = await loadConfig();
  const manager = new TaskManager(config);
  const server = startLocalServer(config, manager);
  const relay = new RemoteRelay(config, manager);
  relay.start();
  console.log(`Local coding agent ready at http://127.0.0.1:${config.localPort}`);
  console.log(`${config.workspaces.length} workspace(s) registered · concurrency ${config.maxConcurrency}`);
  if (!config.openRouterApiKey) console.log("Set OPENROUTER_API_KEY before starting an agent task.");
  if (!config.deviceToken) console.log("Hosted relay is not paired; create a code at colehenry.dev/coding.");
  const shutdown = () => {
    relay.stop();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
