# `/coding` — Product Goal, Current State, and Release Plan

Last updated: 2026-07-14

This is the durable handoff document for the browser coding-agent project. It
records the intended product, the architecture we have chosen, the current
implementation, known risks, and a checklist that should be updated as work is
completed.

## Goal

`/coding` should feel like a lean, terminal-flavored Codex or Claude Code UI in
the browser. Cole can open the same durable task from a Mac or phone, choose an
OpenRouter model, and direct an agent that reads and edits a registered project
on the Mac. The Mac may be sitting open at home; the phone never receives
filesystem access and never needs an inbound connection to the Mac.

The common-use flow should be:

1. Install and pair the Mac companion once.
2. Leave the macOS background service running.
3. Open `https://colehenry.dev/coding` on any signed-in device.
4. Create, continue, rename, organize, or delete the same tasks everywhere.
5. Approve sensitive commands and writes from the active browser.

The UI should remain fast and restrained: top task tabs, editable titles,
model/workspace/branch context, up to four resizable panes, compact tool calls,
hover summaries for diffs, a focused full diff viewer, and sounds only when a
task finishes or needs attention.

## Architecture decision

The hosted FastAPI/Postgres service is the canonical task index and event
history for the UI. Both the Mac browser and phone use that same hosted API.
The Mac companion is the executor and a durable local recovery cache.

```text
Mac browser or phone
        |
        | HTTPS + authenticated SSE
        v
FastAPI relay + Postgres (canonical task list/history)
        |
        | outbound authenticated WebSocket
        v
Mac companion + SQLite (execution/recovery cache)
        |
        +-- registered local workspaces
        +-- OpenRouter
        +-- approved shell commands and file writes
```

The companion opens the outbound WebSocket, so the router does not need port
forwarding and the Mac does not expose a public HTTP server. Direct browser to
`127.0.0.1:7331` remains useful as a development/emergency path, but it must not
be presented as a second normal product mode with a separate chat history.

### Storage responsibilities

- **Postgres:** canonical task metadata, task status, transcript/event history,
  device registration, and the task list shown on every browser.
- **Mac SQLite:** complete model/tool session state required to continue an
  agent loop after browser or process restarts, plus a local event cache.
- **Mac Keychain:** OpenRouter API key.
- **Mac config (`~/.cole-agent/config.json`):** registered workspace paths,
  device identity/token, concurrency, port, and relay URL. It must never contain
  the OpenRouter key.

## Current state

### Implemented

- [x] Next.js `/coding` workspace with tabs and up to four split panes.
- [x] Drag/drop pane placement and resizable pane layout.
- [x] Editable task titles, archive/restore/delete history actions, and project
  grouping/filtering.
- [x] OpenRouter model selection and per-task model changes.
- [x] Registered-workspace boundary with real-path/symlink validation.
- [x] Branch display and filesystem change summaries.
- [x] Compact/collapsible tool requests and command output.
- [x] Agent instructions avoid dumping full diffs into chat.
- [x] Dedicated diff viewer with summarized hover entry point.
- [x] Write and command approvals.
- [x] Completion and attention sounds.
- [x] Durable local SQLite sessions.
- [x] Hosted Postgres task/event schema and remote relay.
- [x] Outbound authenticated companion WebSocket.
- [x] macOS LaunchAgent installer and service diagnostics.
- [x] Adaptive stagnation guard plus a high emergency fuse instead of the old
  20-tool-call cutoff.

### In progress in this pass

- [x] Make hosted Postgres history the single normal UI history on Mac and
  phone; remove the confusing production local/remote choice.
- [x] Add an in-product one-time pairing flow with copyable commands.
- [x] Prevent the Keychain OpenRouter key from being serialized to config and
  remove any legacy plaintext config copy.
- [x] Reconcile task status after companion reconnects so a task cannot remain
  falsely queued forever.
- [x] Pin the supported Node runtime for the companion.
- [ ] Add remote relay/pairing coverage. Companion build/tests now run in CI.
- [x] Fix Railway port configuration and update setup documentation.

## Known issues and concerns

### Release blockers

- [ ] **Production deploy and migration:** deploy the backend with migrations
  through `0018`, then deploy the frontend and updated companion package.
- [x] **Pairing usability:** the UI generates a code and a copyable pair/reload
  command.
- [x] **Reconnect reconciliation:** the companion reports recovered state for
  a queued hosted task instead of silently ignoring it.
- [x] **Secret migration:** config saves exclude the key and a legacy plaintext
  copy is moved to Keychain and scrubbed when possible.
- [ ] **Remote regression tests:** pairing, device authentication, event relay,
  approvals, reconnect, archive, and delete need automated coverage.
- [ ] **Single relay process:** device connections and SSE subscribers live in
  FastAPI process memory. Initial production must use one Railway replica and
  one Uvicorn worker. Multiple replicas require Redis or another shared pub/sub
  and connection-routing layer.

### Security and privacy

- Hosted remote history contains prompts, answers, tool metadata, bounded
  command output, and change summaries. Documentation must not imply that all
  filesystem-derived data stays local.
- The site and relay remain owner-only. The API, not hidden frontend controls,
  is the security boundary.
- Device tokens need revocation and eventual rotation. Pairing codes must remain
  short-lived and one-time use.
- Shell commands and writes require explicit approval. Future convenience
  policies should be scoped by workspace and command class, never global.
- [ ] Add explicit size/time limits. Command output, command duration, diffs,
  and file writes are bounded; relay message and companion outbox limits remain.
- Phone approval is powerful: losing an authenticated phone must be treated as
  losing a privileged terminal. Keep device passcode/biometrics enabled and
  retain the ability to revoke web sessions and paired Macs.

### Reliability and UX

- [x] SSE reconnects with backoff and resumes from the last event sequence after
  a temporary phone network change.
- Browser-to-relay commands need durable IDs, acknowledgements, idempotency, and
  retry. Persisting an event is not the same as the Mac receiving it.
- Offline archive/restore/delete actions need deterministic reconciliation with
  the Mac cache.
- Revoking a device leaves its older chats readable, but they cannot yet be
  reassigned to a newly paired replacement device for continued execution.
- Bound the in-memory WebSocket outbox; persistent disconnects must not grow it
  forever.
- The Mac must be awake, online, paired, and running the LaunchAgent. Document
  macOS sleep settings; later add a clear last-seen/offline explanation.
- A task should clearly distinguish `working`, `needs attention`, `ready`, and
  `closed`. Internal failure/interruption details can be shown within the task
  rather than adding more top-level organizational states.

## Work checklist

### Phase 1 — Easy private phone use

- [x] Canonical hosted task list and history from both desktop and phone.
- [x] Production UI shows companion connection state instead of transport mode.
- [x] Generate a pairing code from `/coding`.
- [x] Show copyable `pair` and `service:install` commands.
- [x] Refresh device state automatically and confirm successful connection.
- [x] Show device name, connection, last-seen time, and a revoke action.
- [x] Scrub plaintext OpenRouter keys from config.
- [x] Reconcile interrupted state on reconnect.
- [x] Update root and companion READMEs.
- [x] Test frontend, backend, companion, and production frontend build.

### Phase 2 — Reliable delivery

- [ ] Add protocol message IDs and acknowledgements.
- [ ] Persist an outbound command queue in Postgres.
- [ ] Make task/message/action delivery idempotent.
- [x] Reconnect SSE with a last-event cursor and backoff.
- [ ] Add a companion-to-server task/session manifest reconciliation handshake.
- [ ] Add Redis/shared pub-sub before enabling multiple API replicas/workers.

### Phase 3 — Production hardening

- [ ] Apply command timeout and output/event/diff/write-size limits.
- [ ] Apply companion outbox bounds and backpressure.
- [ ] Add device token rotation and web UI session/device revocation.
- [ ] Add audit records for approvals and destructive actions.
- [ ] Add health/last-seen alerts for a disconnected home Mac.
- [ ] Review Postgres retention, export, and deletion semantics.
- [ ] Threat-model prompt injection from repository files and command output.

### Phase 4 — Product depth

- [ ] Shared project context and user-authored skills, versioned in a deliberate
  repository path and selectively injected by task/workspace.
- [ ] Search across chat history and saved context.
- [ ] Optional per-workspace permission presets.
- [ ] Multiple paired executor Macs with explicit routing.
- [ ] PWA/mobile polish and push notifications for attention/completion.

## Setup and release checklist

### Cole's Mac

- [ ] Pull the deployed revision.
- [x] Use supported Node 20.
- [x] Install agent dependencies.
- [x] Register `colehenry.dev` and `lapwise.dev` workspaces.
- [x] Store the OpenRouter key in Keychain and remove the legacy JSON copy.
- [ ] Generate a code in the hosted `/coding` page and pair the Mac.
- [x] Reinstall/reload the LaunchAgent.
- [ ] Confirm `doctor` reports paired and the service reports running.
- [ ] Keep the Mac awake while remote coding is expected.

### Hosted services

- [ ] Run backend migrations.
- [ ] Keep Railway at exactly one replica/worker for this release.
- [ ] Deploy backend, then frontend.
- [ ] Verify owner login on the phone.
- [ ] Verify device online state, create task, approval, edit, completion,
  refresh/resume, rename, archive, restore, and delete.
- [ ] Confirm no OpenRouter key appears in config, browser traffic, backend
  records, or logs.

## Definition of the first releasable version

The private first release is ready when Cole can create a task on the Mac,
continue it on the phone, approve a safe test edit, see the final summary and
diff, refresh both devices without divergence, and repeat after restarting the
Mac companion. The same task must appear exactly once with one authoritative
status and transcript. No OpenRouter credential may leave the Mac.
