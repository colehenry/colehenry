# colehenry.dev

Personal site + a growing set of private tools. Next.js frontend, FastAPI
backend, Neon Postgres. Build 1: foundation, shared shell, Google login, and
the portfolio wired end to end.

```
/frontend    Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query · cmdk
/backend    FastAPI · SQLAlchemy 2.0 · Alembic · Authlib (Google OAuth) · PyJWT · psycopg
```

---

## Local setup

### API (`/backend`)

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # fill in values (see below)
alembic upgrade head         # run migrations
python -m app.seed           # seed owner user + lapwise project
uvicorn app.main:app --reload --port 8000
```

`.env` for local dev:

| var | local value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** string, `postgresql+psycopg://…?sslmode=require` |
| `JWT_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `OWNER_EMAIL` | your Google email — the entire allowlist |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud (below) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | dedicated Fernet key; generate with the command in `.env.example` |
| `OAUTH_REDIRECT_URI` | `http://localhost:8000/auth/google/callback` |
| `COOKIE_DOMAIN` | empty (host-only cookie on localhost) |
| `FRONTEND_ORIGIN` | `http://localhost:3000` |

### Web (`/frontend`)

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000. `⌘K` opens the palette.

---

## Architecture notes

- **Auth:** FastAPI is the only auth authority. Google OAuth (Authlib) →
  email checked against `OWNER_EMAIL` → JWT in an `httpOnly` cookie
  (`ch_session`, `Domain=.colehenry.dev` in prod so both apps see it).
  Two enforcement layers: `frontend/proxy.ts` redirects owner-only routes to
  `/login` when the cookie is missing (UX only), and the API validates the
  JWT on every protected endpoint (the real gate).
- **Visibility:** every content model carries `visibility`
  (`public | passcode | private`). This build only enforces public reads +
  owner writes; passcode gates and share links come later.
- **Design tokens:** raw HSL triplets in `frontend/app/globals.css`
  (`--bg`, `--fg`, `--accent`, `--accent-2`). Purple is the brand, amber the
  companion. Sections reskin themselves by setting `data-section` on their
  root — one CSS line per section. Tailwind v4 is configured in CSS via
  `@theme inline` (there is no `tailwind.config` file in v4; the tokens are
  wired to utilities like `bg-background` and `text-brand` there).
- **Middleware naming:** Next 16 renamed `middleware.ts` → `proxy.ts`; same
  role as the middleware described in the plan.
- **Resume:** rendered from `frontend/lib/resume.ts` + static `frontend/public/resume.pdf`.
  TODO (later build): move into the DB with inline editing.
- **Brain tools:** `/brain` exposes narrowly scoped server-side tools to the
  selected chat model. Notes remain backed by the private vault; optional code
  tools can inspect only the repositories in `BRAIN_CODE_REPOS`. GitHub tokens
  stay in the backend and are never sent to the model or browser. Code access
  is read-only and filters credentials, secret files, generated output,
  dependencies, lockfiles, binaries, and oversized files. Commit, comparison,
  merge, and pull-request tools use the same allowlist and filtering boundary.
  Optional Railway tools use separate project-scoped production tokens for the
  `colehenry` and `lapwise` services. They can list deployments, inspect a
  deployment, and read bounded/redacted build or runtime logs. The connector
  verifies each deployment belongs to its configured project, environment, and
  service; it exposes no mutations, environment variables, or configuration.
  Optional Google Calendar tools list calendars, read/search bounded event
  ranges, and inspect free/busy intervals. Calendar uses incremental OAuth with
  the `calendar.readonly` scope, stores only an encrypted refresh token, and
  exposes no event write operations.
  Optional Gmail tools search bounded message metadata/snippets and retrieve a
  full body only after a second explicit tool call. Gmail uses a separate
  encrypted refresh token with `gmail.readonly`; attachments are inaccessible,
  email content is treated as untrusted, and no mailbox write methods exist.
  Calendar/Gmail model calls require an OpenRouter provider with prompt
  collection denied and zero-data retention enabled. Gmail content is redacted
  for common credentials, one-time codes, sensitive links, and financial
  identifiers; full reads are rate-limited and audited without message IDs,
  queries, or content. Replies based on Gmail are shown live but replaced by a
  privacy placeholder in durable Brain chat history.

---

## Adding a tool (the pattern)

Projects is the worked example — every future tool (catan, blog, recipes,
challenges, language) follows the same six steps:

1. **SQLAlchemy model** in `backend/app/models/` — e.g. `project.py`. Include the
   `visibility` enum. Export it from `models/__init__.py`.
2. **Alembic migration** — `cd backend && alembic revision --autogenerate -m "add X"`,
   review it, `alembic upgrade head`.
3. **Pydantic schemas** in `backend/app/schemas/` — `XOut`, `XCreate`, and an
   all-optional `XUpdate` for PATCH (see `schemas/project.py`).
4. **Router** in `backend/app/routers/` — reads are public (filter to
   `visibility == public` for non-owners), writes depend on `require_owner`.
   Include it in `app/main.py`.
5. **Typed client + zod schema** in `frontend/lib/api/` — mirror the Pydantic
   schema in zod, go through `apiFetch` so responses are validated at runtime
   (see `lib/api/projects.ts`).
6. **Page** that fetches with TanStack Query, handles loading/error states,
   and shows an inline edit form when the owner is logged in (see
   `components/portfolio/projects-section.tsx` + `project-edit-form.tsx`).
   Replace the section's `<ComingSoon />` page, keep its `data-section`
   accent, and it's already in the nav and cmd+k via `frontend/lib/sections.ts`.

Rules: the API enforces access, the client only hides UI; type every response
with zod; secrets stay server-side.

---

## Deployment

### 1. Google Cloud (OAuth client)

1. Console → APIs & Services → Credentials → Create OAuth client ID
   (type: Web application).
2. Authorized redirect URIs: `https://api.colehenry.dev/auth/google/callback`
   (add `http://localhost:8000/auth/google/callback` for dev).
3. Note the client ID + secret for the API env vars.
4. In OAuth consent-screen branding, use
   `https://api.colehenry.dev/auth/google/privacy` as the privacy-policy URL and
   add `colehenry.dev` as an authorized domain. The integration-specific consent
   page appears before Google OAuth as a separate acknowledgement.
5. Enable the Google Calendar API for the project. Add the read-only Calendar
   scope to the OAuth consent screen if Google requires it for the app's
   publishing mode.
6. For Gmail, also enable the Gmail API and add
   `https://www.googleapis.com/auth/gmail.readonly` to the consent screen. This
   is a Google restricted scope. For development, keep the app in Testing and
   add the owner email as a test user. A published app must stay single-owner or
   complete the applicable Google verification before broader use.
7. Generate one dedicated token-encryption key and set the same stable value in
   local and production environments. Rotating it invalidates stored Google
   credentials and requires reconnecting both integrations.
8. After logging in, connect Calendar once at
   `/auth/google/calendar/connect`. The callback returns to `/brain`; status is
   available at `/auth/google/calendar/status`, and `DELETE
   /auth/google/calendar` removes the stored credential.
9. Connect Gmail separately at `/auth/google/gmail/connect`. Status is at
   `/auth/google/gmail/status`; `DELETE /auth/google/gmail` removes only the
   Gmail credential.

### 2. Neon

1. Create a project + database; copy the **pooled** connection string and
   convert the scheme to `postgresql+psycopg://`.
2. From `/backend` with `DATABASE_URL` set: `alembic upgrade head`, then
   `python -m app.seed`.

### 3. Railway (`/backend` → api.colehenry.dev)

1. New service from this repo, root directory `/backend`.
2. Start command:
   `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   (migrations run on every deploy).
3. Set all `.env` vars with production values
   (`COOKIE_DOMAIN=.colehenry.dev`, `FRONTEND_ORIGIN=https://colehenry.dev`,
   `OAUTH_REDIRECT_URI=https://api.colehenry.dev/auth/google/callback`, and the
   stable `GOOGLE_TOKEN_ENCRYPTION_KEY`).
4. Custom domain `api.colehenry.dev` → add the CNAME Railway gives you.

### 4. OpenRouter privacy

Brain enforces `data_collection: deny` and `zdr: true` on every model request
after Calendar or Gmail data enters context. Also disable prompt logging in the
OpenRouter account privacy settings as defense in depth. If the selected model
has no eligible zero-data-retention provider, the answer fails closed instead
of sending the Google data through a less private route.

### 5. Netlify (`/frontend` → colehenry.dev)

1. New site from this repo, base directory `/frontend` (Netlify's Next.js runtime
   picks up the rest).
2. Env var: `NEXT_PUBLIC_API_URL=https://api.colehenry.dev`.
3. Domains: `colehenry.dev` + `www.colehenry.dev`.

### 6. Verify

- `https://api.colehenry.dev/health` returns `{"ok": true}`.
- Log in on the site; DevTools → the `ch_session` cookie has
  `Domain=.colehenry.dev`.
- Projects load on `/` (an API call with `credentials: "include"`), the
  lapwise iframe renders, and the owner edit pencil appears when logged in.
- `/journal` and `/dashboard` redirect to `/login` when logged out.
