"""Second-brain vault: ingest, search, and agentic chat.

Git is the source of truth (a private Obsidian vault repo); this service keeps
a derived, rebuildable index in Postgres.  Files are fetched from the GitHub
Contents/Trees API with a fine-grained PAT (no git binary on the server).

Retrieval is agentic full-text tool-reading, not vector RAG (see
context/brain_plan.md §0.5): the chat model is handed a vault map and two
tools, ``search`` and ``read_note``, and pulls what it needs.

Notes under ``_private/`` are indexed and readable by the owner in the UI, but
are never handed to the LLM — excluded from ``search``, ``read_note``, and the
vault map, so crown-jewel notes never leave the box via model egress.
"""

import base64
import hashlib
import json
import logging
import re
from datetime import date, datetime, timezone

import httpx
import yaml

from app.config import get_settings
from app.db import SessionLocal
from app.models import BrainConversation, BrainLink, BrainMessage, BrainNote

log = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
# Standard markdown link to a local note: [label](path/to/note.md). The vault
# uses these rather than [[wikilinks]], so they feed the graph too.
MDLINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
PRIVATE_PREFIX = "_private/"

CHAT_SYSTEM = """You are "brain", a personal assistant that only ever talks to one person: its owner. \
Always address them directly as "you"/"your" — never in the third person, never by name.

Today's date is {today}. Treat that as the current date for anything time-sensitive — "this \
summer", "next weekend", recent events, current prices — and when you run web searches (search \
the current year, not an older one).

You are a fully capable general-purpose assistant. Answer questions on any topic (science, code, \
advice, trivia, whatever) using your own knowledge, exactly like a normal chatbot. You are NOT \
limited to the notes below — never say you can only answer from them. When a `web_search` tool is \
available, use it for current events, real-time facts, prices, news, or anything that may have \
changed since your training.

On top of that, you have private access to the owner's personal notes vault. Use it whenever a \
question touches their life, work, projects, preferences, plans, people, or anything personal. \
`README.md` (below) is the vault's map — it says what lives where and the path to each note. When \
personal context would help:
- find the relevant note(s) and their paths in README.md,
- read them with `read_note` (by path); use `neighbors` to follow links between notes.
Navigate purely by README.md's paths and links — do NOT keyword-search the vault. If README.md \
doesn't reference something, it isn't in the vault; say so plainly (and use web_search if it's a \
general/current-info question).

Weave the notes in naturally when they're relevant; otherwise just answer normally from your own \
knowledge.

Style:
- Your FIRST words must be the answer itself. Never open with a sentence describing what you're \
about to do or fetch — no "Let me pull up…", "Let me check…", "Let me look at…", "I checked your \
notes", "Of course", "Sure", "Great question". The interface already shows any lookups; your prose \
is only the answer.
- Speak from shared memory, not documents. Say "you've mentioned", "you've talked about", \
"you're into" — never "your notes say", "according to your notes", or "your notes mention".
- Be concise, natural, and warm — like a sharp friend who knows you well.

--- README.md (your vault map) ---
{main_doc}
--- END README.md ---

--- FULL NOTE INDEX (fallback) ---
{vault_map}
--- END INDEX ---"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_note",
            "description": "Read the full markdown of one note by its vault path (as given in MAIN.md or the index). This is the primary tool.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Repo-relative path, e.g. 'projects/lapwise.md'."}
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "neighbors",
            "description": "List a note's linked connections (outbound + inbound) so you can traverse the vault by its links. Optional — README.md usually tells you the path directly.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Repo-relative path of the note whose links you want."}
                },
                "required": ["path"],
            },
        },
    },
]

# Offered only when Google CSE is configured (see web_search_available()).
WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the live web (Google) for current events, real-time facts, prices, news, or anything outside your training data and the personal vault. Returns titles, links, and snippets.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Web search query."}
            },
            "required": ["query"],
        },
    },
}


def _active_tools() -> list[dict]:
    """Base vault tools, plus web_search when it's configured."""
    tools = list(TOOLS)
    if web_search_available():
        tools.append(WEB_SEARCH_TOOL)
    return tools


def available() -> bool:
    s = get_settings()
    return bool(s.brain_repo and s.brain_github_token)


def chat_available() -> bool:
    s = get_settings()
    return bool(s.open_router_api_key and (s.brain_chat_model or True))


def web_search_available() -> bool:
    return bool(get_settings().brain_tavily_key)


def is_private(path: str) -> bool:
    return path == PRIVATE_PREFIX.rstrip("/") or path.startswith(PRIVATE_PREFIX)


# --------------------------------------------------------------------------- #
# GitHub fetch
# --------------------------------------------------------------------------- #
def _headers() -> dict:
    s = get_settings()
    return {
        "Authorization": f"Bearer {s.brain_github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _default_branch() -> str:
    s = get_settings()
    try:
        res = httpx.get(f"{GITHUB_API}/repos/{s.brain_repo}", headers=_headers(), timeout=20)
        res.raise_for_status()
        return res.json().get("default_branch") or "main"
    except httpx.HTTPError as exc:
        log.warning("brain: default_branch lookup failed: %s", exc)
        return "main"


def _gh_get(path: str) -> str | None:
    """Fetch one file's text via the Contents API. None if missing (404)."""
    s = get_settings()
    try:
        res = httpx.get(
            f"{GITHUB_API}/repos/{s.brain_repo}/contents/{path}",
            headers=_headers(),
            timeout=30,
        )
        if res.status_code == 404:
            return None
        res.raise_for_status()
        data = res.json()
        if data.get("encoding") == "base64":
            return base64.b64decode(data["content"]).decode("utf-8", "replace")
        return data.get("content", "")
    except httpx.HTTPError as exc:
        log.warning("brain: fetch failed for %s: %s", path, exc)
        return None


def list_repo_markdown() -> list[str]:
    """Every .md path in the repo, via the recursive Trees API."""
    s = get_settings()
    branch = _default_branch()
    try:
        res = httpx.get(
            f"{GITHUB_API}/repos/{s.brain_repo}/git/trees/{branch}",
            params={"recursive": "1"},
            headers=_headers(),
            timeout=30,
        )
        res.raise_for_status()
        tree = res.json().get("tree", [])
    except httpx.HTTPError as exc:
        log.warning("brain: tree listing failed: %s", exc)
        return []
    return [
        e["path"]
        for e in tree
        if e.get("type") == "blob" and e.get("path", "").endswith(".md")
    ]


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #
def _jsonable(value):
    """Coerce YAML-parsed frontmatter into JSON-serializable values. YAML turns
    `date: 2026-07-12` into a Python date, which JSONB can't store — stringify
    dates/datetimes and anything else exotic."""
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end].strip("\n")
    body = text[end + 4 :].lstrip("\n")
    try:
        fm = yaml.safe_load(block) or {}
        if not isinstance(fm, dict):
            fm = {}
    except yaml.YAMLError:
        fm = {}
    return _jsonable(fm), body


def _clean_wikilink(raw: str) -> str:
    """`[[folder/Note#heading|alias]]` -> `folder/Note`."""
    target = raw.split("|", 1)[0].split("#", 1)[0].strip()
    return target


def parse_note(path: str, text: str) -> dict:
    fm, body = _split_frontmatter(text)
    title = ""
    if isinstance(fm.get("title"), str):
        title = fm["title"].strip()
    if not title:
        m = HEADING_RE.search(body)
        if m:
            title = m.group(1).strip()
    if not title:
        title = path.rsplit("/", 1)[-1].removesuffix(".md")
    links: list[str] = []
    seen: set[str] = set()

    def add(target: str) -> None:
        if target and target not in seen:
            seen.add(target)
            links.append(target)

    for m in WIKILINK_RE.finditer(body):
        add(_clean_wikilink(m.group(1)))
    for m in MDLINK_RE.finditer(body):
        raw = m.group(1).strip()
        if not raw or "://" in raw or raw.startswith(("mailto:", "#")):
            continue  # external URL, anchor, or empty
        target = raw.split()[0].strip("<>").split("#", 1)[0].lstrip("./")
        if target.endswith(".md"):
            add(target)

    return {"title": title, "body": body, "frontmatter": fm, "links": links}


# --------------------------------------------------------------------------- #
# Ingest
# --------------------------------------------------------------------------- #
def _resolve_links(db) -> None:
    """Point every link's dst_note_id at a real note when one matches, by exact
    path or by basename (Obsidian resolves wikilinks by note name)."""
    notes = db.query(BrainNote).all()
    by_path = {n.path: n.id for n in notes}
    by_path_noext = {n.path.removesuffix(".md"): n.id for n in notes}
    by_stem: dict[str, int] = {}
    for n in notes:
        stem = n.path.rsplit("/", 1)[-1].removesuffix(".md")
        by_stem.setdefault(stem, n.id)  # first wins on collision
    for link in db.query(BrainLink).all():
        t = link.dst_path
        dst = by_path.get(t) or by_path_noext.get(t) or by_stem.get(t.rsplit("/", 1)[-1])
        link.dst_note_id = dst


def ingest(paths: list[str], force: bool = False) -> dict:
    """Upsert the given .md paths (skip unchanged unless ``force``), delete
    missing ones, and rebuild link edges. Returns counts. No-op when the repo
    isn't configured. Use ``force`` after a parser change to re-parse files
    whose content is byte-identical (hash-diff would otherwise skip them)."""
    if not available():
        log.info("brain: ingest skipped — repo/token not configured")
        return {"notes": 0, "links": 0}

    md_paths = [p for p in paths if p.endswith(".md")]
    db = SessionLocal()
    try:
        for path in md_paths:
            text = _gh_get(path)
            note = db.query(BrainNote).filter(BrainNote.path == path).one_or_none()

            if text is None:  # deleted upstream
                if note is not None:
                    db.delete(note)
                continue

            content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if not force and note is not None and note.content_hash == content_hash:
                continue  # unchanged

            parsed = parse_note(path, text)
            private = is_private(path)
            if note is None:
                note = BrainNote(path=path)
                db.add(note)
            note.title = parsed["title"]
            note.body_md = parsed["body"]
            note.frontmatter = parsed["frontmatter"]
            note.content_hash = content_hash
            db.flush()  # need note.id for links

            # Replace this note's outgoing links. Private notes contribute no
            # edges, so their connections aren't exposed in the graph.
            db.query(BrainLink).filter(BrainLink.src_note_id == note.id).delete()
            if not private:
                for target in parsed["links"]:
                    db.add(BrainLink(src_note_id=note.id, dst_path=target))

        db.flush()
        _resolve_links(db)
        db.commit()
        return {
            "notes": db.query(BrainNote).count(),
            "links": db.query(BrainLink).count(),
        }
    finally:
        db.close()


def reindex(force: bool = False) -> dict:
    """Full backfill from the repo tree. Also prunes rows for deleted files."""
    if not available():
        return {"notes": 0, "links": 0}
    paths = list_repo_markdown()
    result = ingest(paths, force=force)
    # Prune notes whose files no longer exist in the repo.
    db = SessionLocal()
    try:
        keep = set(paths)
        stale = [n for n in db.query(BrainNote).all() if n.path not in keep]
        for n in stale:
            db.delete(n)
        if stale:
            db.commit()
            result["notes"] = db.query(BrainNote).count()
    finally:
        db.close()
    return result


# --------------------------------------------------------------------------- #
# Query (also the chat tools)
# --------------------------------------------------------------------------- #
def search(db, query: str, k: int = 8) -> list[dict]:
    """Full-text search over non-private notes; trigram title fallback."""
    query = (query or "").strip()
    if not query:
        return []
    from sqlalchemy import text as sql

    rows = db.execute(
        sql(
            """
            SELECT path, title,
                   ts_headline('english', body_md, websearch_to_tsquery('english', :q),
                       'MaxFragments=1, MaxWords=30, MinWords=10') AS snippet,
                   ts_rank(tsv, websearch_to_tsquery('english', :q)) AS rank
            FROM brain_notes
            WHERE tsv @@ websearch_to_tsquery('english', :q)
              AND path NOT LIKE :priv
            ORDER BY rank DESC
            LIMIT :k
            """
        ),
        {"q": query, "priv": PRIVATE_PREFIX + "%", "k": k},
    ).fetchall()

    if not rows:  # fuzzy fallback on titles
        rows = db.execute(
            sql(
                """
                SELECT path, title, left(body_md, 160) AS snippet,
                       similarity(title, :q) AS rank
                FROM brain_notes
                WHERE similarity(title, :q) > 0.2
                  AND path NOT LIKE :priv
                ORDER BY rank DESC
                LIMIT :k
                """
            ),
            {"q": query, "priv": PRIVATE_PREFIX + "%", "k": k},
        ).fetchall()

    return [
        {"path": r.path, "title": r.title, "snippet": (r.snippet or "").strip()}
        for r in rows
    ]


def web_search(query: str, k: int = 5) -> list[dict]:
    """Tavily search → [{title, link, snippet}]. Empty on failure or when
    unconfigured. Tavily's free tier is ~1,000 searches/month."""
    query = (query or "").strip()
    s = get_settings()
    if not query or not web_search_available():
        return []
    try:
        res = httpx.post(
            "https://api.tavily.com/search",
            headers={"Authorization": f"Bearer {s.brain_tavily_key}"},
            json={
                "query": query,
                "max_results": max(1, min(k, 10)),
                "search_depth": "basic",
            },
            timeout=25,
        )
        res.raise_for_status()
        results = res.json().get("results", []) or []
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("brain: web_search failed for %r: %s", query, exc)
        return []
    return [
        {
            "title": r.get("title", ""),
            "link": r.get("url", ""),
            "snippet": r.get("content", ""),
        }
        for r in results[:k]
    ]


def read_note(db, path: str) -> dict | None:
    """Full note by path, for the reader and the chat tool. Refuses private."""
    if not path or is_private(path):
        return None
    note = db.query(BrainNote).filter(BrainNote.path == path).one_or_none()
    if note is None:
        return None
    return {"path": note.path, "title": note.title, "body_md": note.body_md}


def neighbors(db, path: str) -> dict:
    """A note's resolved outbound + inbound links, for structured link traversal.
    Excludes private notes on both ends."""
    if not path or is_private(path):
        return {"outbound": [], "inbound": []}
    note = db.query(BrainNote).filter(BrainNote.path == path).one_or_none()
    if note is None:
        return {"error": "not found"}

    out = []
    for link in db.query(BrainLink).filter(
        BrainLink.src_note_id == note.id, BrainLink.dst_note_id.is_not(None)
    ):
        dst = db.get(BrainNote, link.dst_note_id)
        if dst and not is_private(dst.path):
            out.append({"path": dst.path, "title": dst.title})
    inb = []
    for link in db.query(BrainLink).filter(BrainLink.dst_note_id == note.id):
        src = db.get(BrainNote, link.src_note_id)
        if src and not is_private(src.path):
            inb.append({"path": src.path, "title": src.title})
    return {"outbound": out, "inbound": inb}


def main_doc(db) -> str:
    """The vault's README.md for the system prompt — the point of contact / map.
    Case-insensitive, prefers the root-level one. Empty string if absent."""
    from sqlalchemy import func as safunc, or_

    lp = safunc.lower(BrainNote.path)
    rows = (
        db.query(BrainNote)
        .filter(or_(lp == "readme.md", lp.like("%/readme.md")))
        .all()
    )
    if not rows:
        return ""
    rows.sort(key=lambda n: n.path.count("/"))  # shallowest (root) wins
    return rows[0].body_md


def vault_map(db) -> str:
    """Compact markdown outline of the (non-private) vault for the system prompt."""
    notes = (
        db.query(BrainNote)
        .filter(~BrainNote.path.like(PRIVATE_PREFIX + "%"))
        .order_by(BrainNote.path)
        .all()
    )
    lines: list[str] = []
    for n in notes:
        depth = n.path.count("/")
        indent = "  " * depth
        lines.append(f"{indent}- {n.title}  ({n.path})")
    return "\n".join(lines) if lines else "(vault is empty)"


# --------------------------------------------------------------------------- #
# Agentic chat (streaming, tool loop)
# --------------------------------------------------------------------------- #
def _run_tool(db, name: str, args: dict) -> str:
    try:
        if name == "read_note":
            note = read_note(db, args.get("path", ""))
            return json.dumps(note) if note else json.dumps({"error": "not found or private"})
        if name == "neighbors":
            return json.dumps(neighbors(db, args.get("path", "")))
        if name == "search":
            return json.dumps(search(db, args.get("query", ""))[:8])
        if name == "web_search":
            return json.dumps(web_search(args.get("query", "")))
    except Exception as exc:  # noqa: BLE001 — tool errors must not kill the stream
        log.warning("brain: tool %s failed: %s", name, exc)
        return json.dumps({"error": str(exc)})
    return json.dumps({"error": f"unknown tool {name}"})


def _tool_label(db, name: str, args: dict) -> str:
    """Human-readable description of a tool call, for the live activity trail."""
    if name == "read_note":
        path = args.get("path", "")
        note = db.query(BrainNote).filter(BrainNote.path == path).one_or_none()
        return f"reading {note.title}" if note else f"reading {path}"
    if name == "neighbors":
        return f"mapping links from {args.get('path', '')}"
    if name == "search":
        return f'searching notes "{args.get("query", "")}"'
    if name == "web_search":
        return f'searching the web "{args.get("query", "")}"'
    return name


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _chat_events(db, messages: list[dict], model: str | None):
    """Core agentic tool loop. Yields `(event_name, data)` tuples; the caller
    owns the DB session (tools query it). Each model call streams; when it asks
    for tools we run them and loop, up to a guard.
    """
    s = get_settings()
    model = model or s.brain_chat_model or s.fallback_model
    if not s.open_router_api_key or not model:
        yield ("error", {"message": "chat not configured"})
        yield ("done", {})
        return

    convo = [
        {
            "role": "system",
            "content": CHAT_SYSTEM.format(
                today=datetime.now().strftime("%A, %B %-d, %Y"),
                main_doc=main_doc(db) or "(no README.md found in the vault)",
                vault_map=vault_map(db),
            ),
        }
    ]
    convo += [{"role": m["role"], "content": m["content"]} for m in messages]

    active_tools = _active_tools()
    try:
        for _ in range(6):  # tool-loop guard
            content_parts: list[str] = []
            tool_calls: dict[int, dict] = {}

            with httpx.stream(
                "POST",
                f"{s.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {s.open_router_api_key}"},
                json={"model": model, "messages": convo, "tools": active_tools, "stream": True},
                timeout=120,
            ) as res:
                res.raise_for_status()
                for line in res.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except ValueError:
                        continue
                    choice = (chunk.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}
                    if delta.get("content"):
                        content_parts.append(delta["content"])
                        yield ("token", {"text": delta["content"]})
                    for tc in delta.get("tool_calls") or []:
                        idx = tc.get("index", 0)
                        slot = tool_calls.setdefault(idx, {"id": "", "name": "", "args": ""})
                        if tc.get("id"):
                            slot["id"] = tc["id"]
                        fn = tc.get("function") or {}
                        if fn.get("name"):
                            slot["name"] = fn["name"]
                        if fn.get("arguments"):
                            slot["args"] += fn["arguments"]

            if not tool_calls:
                break

            # Drop any "let me check…" chatter emitted before the tool calls, so
            # only the final answer shows (the tool trail conveys the lookups).
            if content_parts:
                yield ("reset", {})

            ordered = [tool_calls[i] for i in sorted(tool_calls)]
            convo.append(
                {
                    "role": "assistant",
                    "content": "".join(content_parts) or None,
                    "tool_calls": [
                        {
                            "id": t["id"],
                            "type": "function",
                            "function": {"name": t["name"], "arguments": t["args"] or "{}"},
                        }
                        for t in ordered
                    ],
                }
            )
            for t in ordered:
                try:
                    args = json.loads(t["args"] or "{}")
                except ValueError:
                    args = {}
                yield (
                    "tool",
                    {"name": t["name"], "args": args, "label": _tool_label(db, t["name"], args)},
                )
                output = _run_tool(db, t["name"], args)
                convo.append(
                    {"role": "tool", "tool_call_id": t["id"], "name": t["name"], "content": output}
                )
        yield ("done", {})
    except httpx.HTTPError as exc:
        log.warning("brain: chat stream failed: %s", exc)
        yield ("error", {"message": "model request failed"})
        yield ("done", {})


def chat_stream(messages: list[dict], model: str | None):
    """Stateless SSE chat (no persistence). Opens its own session because a
    StreamingResponse outlives the request's injected dependency in FastAPI."""
    db = SessionLocal()
    try:
        for name, data in _chat_events(db, messages, model):
            yield _sse(name, data)
    finally:
        db.close()


def converse(conversation_id: int, user_content: str, model: str | None):
    """Persisted SSE chat: append the user turn, stream the reply, and save the
    assistant turn. Yields SSE frames. Titles a fresh conversation from its first
    message. Own session (StreamingResponse outlives the request dependency)."""
    db = SessionLocal()
    try:
        conv = db.get(BrainConversation, conversation_id)
        if conv is None:
            yield _sse("error", {"message": "conversation not found"})
            yield _sse("done", {})
            return

        db.add(BrainMessage(conversation_id=conv.id, role="user", content=user_content))
        if not conv.title.strip():
            conv.title = user_content.strip()[:60] or "New chat"
        db.commit()

        history = [
            {"role": m.role, "content": m.content}
            for m in db.query(BrainMessage)
            .filter(BrainMessage.conversation_id == conv.id)
            .order_by(BrainMessage.id)
            .all()
        ]

        acc: list[str] = []
        tools_used: list[dict] = []
        for name, data in _chat_events(db, history, model):
            if name == "token":
                acc.append(data["text"])
            elif name == "reset":
                acc.clear()  # discard pre-tool chatter from the saved answer
            elif name == "tool":
                tools_used.append(data)
            yield _sse(name, data)

        db.add(
            BrainMessage(
                conversation_id=conv.id,
                role="assistant",
                content="".join(acc),
                tool_calls=tools_used or None,
            )
        )
        conv.updated_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()
