# cole-agent

Mac executor for the private `/coding` workspace on colehenry.dev. Browsers on
the Mac and phone share the hosted Postgres task history; this process owns
repository access, SQLite recovery state, approved shell commands, and
OpenRouter calls.

## One-time local configuration

```bash
# From the repository root
nvm install 20
nvm use 20
npm --prefix agent install
npm --prefix agent run dev -- workspace add . colehenry.dev
npm --prefix agent run dev -- workspace add ../lapwise/lapwise.dev lapwise.dev
npm --prefix agent run dev -- key set
npm --prefix agent run dev -- doctor
```

`key set` saves the OpenRouter API key in macOS Keychain. Configuration and the
registered workspace list live in `~/.cole-agent/config.json` with user-only
file permissions. The OpenRouter key is excluded from that JSON and stored in
Keychain. Coding sessions, complete model/tool history, and transcript events
live in `~/.cole-agent/sessions.sqlite3` using SQLite WAL mode. Hosted Postgres
is the canonical browser-visible task/event history.

## Install the macOS background service

Stop any foreground `npm run dev -- start` process first, then run:

```bash
# From the repository root, after pairing
npm --prefix agent run service:install
npm --prefix agent run service:status
```

The installer builds the TypeScript agent, creates
`~/Library/LaunchAgents/dev.colehenry.coding-agent.plist`, starts it immediately,
and configures it to start at login and restart if it exits. A successful status
normally prints `running`.

For normal use, leave the companion in the background and open
`https://colehenry.dev/coding` on any signed-in device. No terminal or local
frontend process is required.

Check the service and inspect its logs with:

```bash
# From the repository root
npm --prefix agent run service:status
npm --prefix agent run dev -- doctor
tail -f ~/.cole-agent/agent.log
tail -f ~/.cole-agent/agent.error.log
```

After changing agent source code, rerun
`npm --prefix agent run service:install` to rebuild and reload the service.
Remove it with:

```bash
npm --prefix agent run service:uninstall
```

Uninstalling leaves the Keychain entry, configuration, and durable session
database intact.

## Foreground alternative

To debug the companion interactively instead of using the service:

```bash
# From the repository root
npm --prefix agent run dev -- start
```

Do not run foreground and background copies together because both use port
`7331`.

Useful commands:

```bash
npm --prefix agent run dev -- doctor
npm --prefix agent run dev -- key set
npm --prefix agent run dev -- workspace add /absolute/path "Display name"
npm --prefix agent run dev -- pair ABCD2345 https://api.colehenry.dev
npm --prefix agent run build
```

The `OPENROUTER_API_KEY` environment variable is also supported for foreground
use. The key is never sent to the hosted relay.

## Pair the hosted workspace

1. Deploy migrations through `0018` and the updated FastAPI service.
2. Open `https://colehenry.dev/coding` and create a pairing code.
3. Pair and reload the Mac companion from the repository root:

   ```bash
   npm --prefix agent run dev -- pair ABCD2345 https://api.colehenry.dev
   npm --prefix agent run service:install
   ```

   Replace `ABCD2345` with the code shown in the browser.
4. Confirm `npm --prefix agent run dev -- doctor` says `paired: true` and
   `npm --prefix agent run service:status` says `running`.

The local process opens an outbound authenticated WebSocket. No inbound port is
exposed on the Mac. Railway relays task events and stores the canonical
append-only browser history. The OpenRouter key and direct filesystem access
remain on the Mac, but prompts, responses, tool metadata, bounded command
output, and change summaries are stored remotely so every browser can resume.

The Mac must be awake and online to execute. On a MacBook, keep it powered and
open, or use an intentional trusted always-awake setup; closing the lid normally
suspends the companion. The browser continues to show saved history while the
Mac is offline.

## Safety boundary

- Only explicitly registered workspaces are available to a task.
- Relative paths are checked against the real workspace path, including symlinks.
- Tasks operate in the registered workspace and never create branches or Git worktrees.
- Every file write and shell command requires an explicit browser approval.
- Productive agent runs are not capped at 20 tool rounds. An adaptive loop guard
  corrects repeated calls, pauses persistent stagnation as an amber attention
  state, and retains a 200-round emergency fuse.
- A configurable concurrency queue defaults to two tasks and supports up to four.
- Closing a chat archives it; permanent deletion is a separate API operation.
- Interrupted tasks are restored after a restart without automatically rerunning commands.
