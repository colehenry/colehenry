# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cole Henry, single user, owner and only account. No second audience exists for
the private surfaces and none is planned — there is no sharing, collaboration,
or multi-user concept anywhere in the product.

Public surfaces (`/`, `/projects`, `/resume`, `/blog`, `/catan`, `/recipes`)
have visitors: people evaluating Cole professionally, plus friends he sends a
recipe or a Catan standings link to. Owner-only surfaces (`/dashboard`,
`/brain`, `/journal`, `/challenges`, `/coding`, `/quenoseteolvide`) have
exactly one user.

Confirmed use scene for `/dashboard`: no single dominant moment. Morning on a
phone in the kitchen, parked on a desktop during the workday, and evening on a
laptop are all real. Every direction must therefore hold up in both light and
dark and at both phone and desktop width; none may be optimized for one
moment at the others' expense.

## Product Purpose

`colehenry.dev` is a personal site that is also the toolchain Cole actually
runs his life on. It serves two jobs at once: a portfolio that shows work to
people evaluating him, and a set of private tools good enough that he prefers
them to the commercial products they replace.

The second job is the load-bearing one. Each tool exists because the
off-the-shelf equivalent was worse for his specific use: `/recipes` replaces
wherever recipes lived before, `/language` replaces flashcard apps,
`/brain` replaces search over an Obsidian vault, `/dashboard` replaces Google
Calendar plus whatever the current to-do list is.

Success for `/dashboard` is narrow and behavioral: Cole opens it instead of
Google Calendar, and things he needs to remember reliably end up in it.

## Positioning

The tools share one account, one database, and one agent, so they compose in
ways that separate commercial apps cannot. A recipe in `/recipes` becomes a
planned meal on the dashboard calendar, which becomes grocery items keyed to
the same ingredient slugs, which update pantry state when checked off, which
feed back into what the agent suggests cooking next. The `/brain` agent can
read and write all of it from one conversation.

The mechanism a neighboring product could not copy is that shared ingredient
key namespace plus a single agent with tool access across every surface.

## Operating Context

Monorepo. `/frontend` is Next.js 16 (App Router, React 19, Tailwind v4 with
`@theme`, shadcn primitives, `next-themes`, TanStack Query, zod clients) on
Netlify. `/backend` is FastAPI + SQLAlchemy + Alembic on Railway, Postgres on
Neon. `/agent` is a separate TypeScript service. Auth is Google OAuth,
single-owner, `ch_session` JWT cookie; `frontend/proxy.ts` bounces owner-only
routes to `/login` as a UX layer while the API enforces the real check.

Conventions every feature follows: model → migration → schema → router → zod
client → page. Sections reskin themselves by overriding `--accent` on a
`data-section` attribute in `app/globals.css`.

The `/brain` agent already has a tool registry
(`backend/app/services/brain_tool_registry.py`) with connectors for Google
Calendar (read-only), Gmail (read), the vault, code, and Railway. New
capabilities are added as a `tools()` function registered there, which is how
the dashboard is expected to become agent-writable.

Cole's working rhythm matters to the design: he does not plan by the hour, and
often has weeks with nothing on his calendar at all. The product must read as
correct and intentional when nearly empty, not as a dashboard waiting to be
filled.

## Capabilities and Constraints

Built and live: projects, resume, `/catan`, `/challenges`, `/language`,
`/recipes`, `/brain` (vault ingest, chat, calendar/gmail/code connectors),
`/coding`. `/dashboard` is a coming-soon stub at
`frontend/app/dashboard/page.tsx`.

Planned for `/dashboard`, specified in `context/dashboard_plan.md`: one
`dash_items` table with a `kind` discriminator (task, grocery, meal, note,
deadline, waiting) rather than separate tables per feature; ad-hoc grocery
lists that are never weekly and never deleted, only snapshotted; pantry state
carried as a flag on grocery items rather than as its own section or tab;
routine as recurring templates whose uncompleted instances are deleted on date
roll; meals linked to `recipes` rows; Google Calendar mirrored read-only with
all writes going to `dash_items`.

Terminology: items have `kind`, not "type". Lists are lists. Pantry status is
`stocked | low | out`. Ingredient keys are lowercase hyphenated slugs matching
`^[a-z0-9-]+$`, validated in `backend/app/schemas/recipe.py`.

Undecided: whether `/` gains any logged-in treatment beyond a post-login
redirect to `/dashboard`.

## Brand Commitments

Carolina blue (`#7BAFD4`) with a UNC navy companion (`#13294B`) is the
site-wide brand, defined in `app/globals.css`. Individual sections override
`--accent` and are expected to look materially different from one another —
`/catan` is amber, `/language` teal, `/recipes` herb green, `/brain` violet.
Section-level divergence is a deliberate feature of the site, not drift.

Binding aesthetic constraints Cole has stated:

- Web nostalgia is welcome and already used — the Windows XP window shell on
  `/language`, the 2006 food blog on `/recipes`.
- Analog-object skeuomorphism is rejected outright. A recipe-tin skin with a
  jadeite counter, handwriting fonts, and ruled index cards was built and
  killed the same day. No paper kitsch, no handwriting faces, no simulated
  physical objects standing in for interface.
- No gamification anywhere: no streaks, no completion counts, no charts of
  tasks done, no badges, no progress rings, no "you're on a roll".
- Nothing nags. Nothing turns red for being late. An overdue date renders as a
  muted date and that is the entire pressure mechanism.

`/dashboard` is explicitly asked to read as more premium than the rest of the
site.

## Evidence on Hand

Real data exists in Neon for projects, Catan games, challenges, language
decks, recipes, and brain notes. No dashboard data exists yet — every item,
list, meal, and pantry row shown in this build is authored demonstration
content and must be labeled as such until the tables ship.

No commercial claims exist anywhere in the product: no prices, customers,
benchmarks, or testimonials. None may be invented.

## Product Principles

1. **Capture beats structure.** If putting something in takes more than a few
   seconds it will not get put in. Every feature is judged on that first.
2. **Passive data entry.** State that requires bookkeeping gets abandoned
   within two weeks. Writes must be side effects of things Cole was already
   doing — checking off groceries, marking a meal cooked, chatting with the
   agent.
3. **The agent is the primary write path.** The interface is for reading and
   one-tap confirmation; typing is the fallback.
4. **Empty is a valid state, not a failure.** Weeks with nothing scheduled are
   normal and must look deliberate.
5. **Never score the user.** No counting, no streaks, no urgency theater. The
   product reports what is true and stays quiet.

## Accessibility & Inclusion

No diagnosed requirement recorded. Standard obligations apply: WCAG AA
contrast, visible keyboard focus, `prefers-reduced-motion` honored, real
targets on touch. The dashboard is used one-handed on a phone, so tap targets
and thumb reach are a functional requirement rather than a nicety.
