# cole-agent

Local executor for the private `/coding` workspace on colehenry.dev. The browser
controls tasks; this process owns repository access, Git worktrees, shell
commands, and OpenRouter calls.

## One-time local configuration

```bash
# From the repository root
cd agent
npm install
npm run dev -- workspace add .. colehenry.dev
npm run dev -- workspace add ../../lapwise/lapwise.dev lapwise.dev
npm run dev -- key set
npm run dev -- doctor
```

`key set` saves the OpenRouter API key in macOS Keychain. Configuration and the
registered workspace list live in `~/.cole-agent/config.json` with user-only
file permissions.

## Install the macOS background service

Stop any foreground `npm run dev -- start` process first, then run:

```bash
# From the repository root, in a new terminal
cd agent
npm run service:install
npm run service:status
```

The installer builds the TypeScript agent, creates
`~/Library/LaunchAgents/dev.colehenry.coding-agent.plist`, starts it immediately,
and configures it to start at login and restart if it exits. A successful status
normally prints `running`.

For normal local use, leave the companion in the background and run only the
frontend:

```bash
# From the repository root, in a new terminal
cd frontend
npm run dev
```

Open `http://localhost:3000/coding` and select **local**. Local mode connects
directly to `http://127.0.0.1:7331`; the FastAPI backend is not required.

Check the service and inspect its logs with:

```bash
# From the repository root
cd agent
npm run service:status
npm run dev -- doctor
tail -f ~/.cole-agent/agent.log
tail -f ~/.cole-agent/agent.error.log
```

After changing agent source code, rerun `npm run service:install` to rebuild and
reload the service. Remove it with:

```bash
npm run service:uninstall
```

Uninstalling leaves the Keychain entry and `~/.cole-agent/config.json` intact.

## Foreground alternative

To debug the companion interactively instead of using the service:

```bash
# From the repository root
cd agent
npm run dev -- start
```

Do not run foreground and background copies together because both use port
`7331`.

Useful commands:

```bash
npm run dev -- doctor
npm run dev -- key set
npm run dev -- workspace add /absolute/path "Display name"
npm run dev -- pair ABCD2345 https://api.colehenry.dev
npm run build
```

The `OPENROUTER_API_KEY` environment variable is also supported for foreground
use. The key is never sent to the hosted relay.

## Remote mode

1. Deploy migration `0017` and the updated FastAPI service.
2. Open `/coding`, switch to remote, and choose **new**.
3. Create a pairing code.
4. Pair the Mac from the repository root:

   ```bash
   cd agent
   npm run dev -- pair ABCD2345 https://api.colehenry.dev
   ```

   Replace `ABCD2345` with the code shown in the browser.
5. Run `npm run service:install` again so the background process reloads the
   new pairing.

The local process opens an outbound authenticated WebSocket. No inbound port is
exposed on the Mac. Railway relays task events and stores the append-only task
history; OpenRouter and filesystem traffic remain local to the agent.

## Safety boundary

- Only explicitly registered workspaces are available to a task.
- Relative paths are checked against the real workspace path, including symlinks.
- Write-capable tasks use isolated `codex/agent-*` Git worktrees when possible.
- Every file write and shell command requires an explicit browser approval.
- A configurable concurrency queue defaults to two tasks and supports up to four.
