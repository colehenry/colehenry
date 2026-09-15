"""French tutor chat — the context-aware assistant embedded in the learning hub.

Three context layers, ordered stable → volatile so the provider's prompt cache
hits the prefix: (1) persona + presentation rules + output-tag contract + the
reference-sheet index, (2) learner state from `build_context(purpose="tutor")`
plus the titles of recent threads, (3) the on-screen *focus* the client sends
with each message. Anything else the model pulls through tools.

Replies stream as markdown with inline tags the UI renders (see TAG_CONTRACT).
After a reply completes, `[[ref:]]` / `[[activity:]]` tags pointing at ids that
don't exist are unwrapped to plain text; the cleaned reply is persisted and
sent in the `done` event so the client swaps its buffer.

Streaming loop mirrors `services/brain.py` (same SSE event names); model chain
TUTOR_MODEL → TUTOR_FALLBACK_MODEL. See context/tutor_plan.md.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.curriculum import references
from app.curriculum.sprints import ALL_ACTIVITIES, SPRINTS
from app.curriculum.verbs import CORE_VERBS_BY_INF
from app.db import SessionLocal
from app.models import LearningInterference, LearningTutorMessage, LearningTutorThread, LearningVocab
from app.services import conjugator
from app.services.learning import sync
from app.services.learning.context import allowed_vocabulary, build_context
from app.services.learning.mastery import get_state, sprint_progress, weakest_dimensions
from app.services.tool_registry import LLMTool, ToolRegistry

log = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 4
MAX_HISTORY = 24  # turns sent to the model (older ones stay in the DB)
FOCUS_MAX_CHARS = 2000
TITLE_MAX_CHARS = 60

# ---------------------------------------------------------------------------
# layer 1 — persona, rules, tag contract (static)
# ---------------------------------------------------------------------------

TAG_CONTRACT = """OUTPUT FORMAT — markdown with these inline tags (the app renders them; use them, don't describe them):
- [[fr:…]]  every French word, phrase or sentence you want the learner to hear: renders with a play button. Wrap ALL French examples.
- [[fr-slow:…]]  the same, spoken slowly — use for pronunciation contrasts and minimal pairs.
- [[ref:sheet#section]]  link to a reference sheet section from the REFERENCE INDEX below. Only ids that exist there.
- [[activity:id]]  link to a practice activity; only ids returned by find_activities.
- [[vocab:mot]]  a word from the learner's curriculum (shows its status).
- [[new:mot]]  a French word the learner has NOT met yet (outside the known/learning lists). Mark every such word.
Never invent ids. Never put tags inside code spans. Plain markdown otherwise: short paragraphs, small lists, bold for the rule."""

SYSTEM = """You are the French tutor inside Cole's personal learning app. One learner, always the same person:
A0 French (month 1), C1 Spanish, native English, learning metropolitan France French.

HOW TO ANSWER
- Explain in the EXPLANATION LANGUAGE given at the end of this prompt, whatever language the question is in. Spanish is always the bridge: French for examples, Spanish parallels in every answer.
- Name the rule, not the feeling. One idea per answer; go deeper only if asked. No filler, no praise, no "¡Buena pregunta!".
- Always draw the Spanish parallel or the Spanish trap (interference). If the learner's question contains a French mistake, correct it first, briefly.
- Examples: 2–3, natural, spoken French, built ONLY from the learner's known/learning vocabulary (see LEARNER). If you must use an unknown word, tag it [[new:…]]. Nouns always with an article that shows gender.
- Pronunciation questions: IPA + a mouth/ear cue + a Spanish-sound anchor + a minimal-pair contrast with [[fr-slow:…]].
- Point to the curriculum: link the relevant [[ref:…]] section(s) and, when practice would help, an [[activity:…]]. Use tools when you need the actual sheet content, a word's mastery, or a conjugation — don't guess about the learner's state.
- Stay within month-1 scope unless asked: don't teach tenses/grammar beyond the learner's target grammar list; if they ask, answer but say it's ahead of the plan.
- You may call log_interference when you correct a Spanish-driven error, and mark_encountered when the learner asks about a word outside the curriculum. Say what you logged in one short line.

""" + TAG_CONTRACT


def _reference_index_block() -> str:
    lines = ["REFERENCE INDEX (sheet#section ids you may link):"]
    for s in references.sheet_index():
        secs = ", ".join(x["id"] for x in s["sections"])
        lines.append(f"- {s['id']} ({s['title']}): {secs}" if secs else f"- {s['id']} ({s['title']}) [dynamic]")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# layer 2 — learner state
# ---------------------------------------------------------------------------

def _already_explained(db: Session, exclude_thread: int | None, limit: int = 20) -> list[str]:
    q = select(LearningTutorThread.title).where(LearningTutorThread.title != "")
    if exclude_thread:
        q = q.where(LearningTutorThread.id != exclude_thread)
    rows = db.execute(q.order_by(LearningTutorThread.updated_at.desc()).limit(limit)).scalars().all()
    return list(rows)


def learner_block(db: Session, thread_id: int | None = None) -> str:
    sprint = get_state(db).active_sprint
    ctx = build_context(db, sprint, purpose="tutor")
    ctx["already_explained_recently"] = _already_explained(db, thread_id)
    ctx["today"] = datetime.now(timezone.utc).date().isoformat()
    return "LEARNER (live state — trust this over assumptions):\n" + json.dumps(ctx, ensure_ascii=False)


LANG_NAMES = {"es": "Spanish", "en": "English"}


def system_prompt(db: Session, thread_id: int | None = None, lang: str = "es") -> str:
    lang_line = f"EXPLANATION LANGUAGE: {LANG_NAMES.get(lang, 'Spanish')}."
    return "\n\n".join([SYSTEM, _reference_index_block(), learner_block(db, thread_id), lang_line])


# ---------------------------------------------------------------------------
# layer 3 — focus (what's on screen)
# ---------------------------------------------------------------------------

def render_focus(focus: dict | None) -> str:
    if not focus or not isinstance(focus, dict):
        return ""
    surface = str(focus.get("surface") or "")
    body = json.dumps({k: v for k, v in focus.items() if k != "surface"}, ensure_ascii=False)[:FOCUS_MAX_CHARS]
    return f"<focus surface=\"{surface}\">{body}</focus>\n\n"


# ---------------------------------------------------------------------------
# tools
# ---------------------------------------------------------------------------

ARTICLE_RE = re.compile(r"^(le|la|les|l'|l’|un|une|des|du|de la|de l'|d')\s*", re.IGNORECASE)


def _strip_article(word: str) -> str:
    return ARTICLE_RE.sub("", word.strip().replace("’", "'")).strip()


def _activity_sprint() -> dict[str, int]:
    return {a.id: s.number for s in SPRINTS for a in s.activities}


def _vocab_row_out(row: LearningVocab, allowed: set[str]) -> dict:
    return {
        "french": row.french, "spanish": row.spanish, "english": row.english, "part_of_speech": row.part_of_speech,
        "gender": row.gender, "ipa": row.ipa, "sprint": row.sprint, "status": row.status, "source": row.source,
        "example_fr": row.example_fr, "example_es": row.example_es, "pattern": row.pattern,
        "spanish_connection": row.spanish_connection, "pronunciation_warning": row.pronunciation_warning,
        "cognate_type": row.cognate_type, "false_friend": row.false_friend, "reference_links": row.reference_links,
        "mastery": {
            "recognition": round(row.recognition, 2), "audio_recognition": round(row.audio_recognition, 2),
            "written_production": round(row.written_production, 2), "spoken_production": round(row.spoken_production, 2),
            "contextual_use": round(row.contextual_use, 2), "attempts": row.attempts,
            "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
        },
        "in_known_set": _strip_article(row.french).lower() in allowed,
    }


def tool_lookup_vocab(db: Session, args: dict) -> dict:
    word = _strip_article(str(args.get("word") or ""))
    if not word:
        return {"error": "word required"}
    sprint = get_state(db).active_sprint
    allowed = allowed_vocabulary(sprint)
    exact = db.execute(select(LearningVocab).where(LearningVocab.french.ilike(word))).scalars().all()
    rows = exact or db.execute(
        select(LearningVocab).where(LearningVocab.french.ilike(f"%{word}%")).order_by(LearningVocab.sprint).limit(5)
    ).scalars().all()
    if not rows:
        return {"found": False, "word": word, "in_known_set": word.lower() in allowed,
                "note": "not in the curriculum or the learner's vocabulary; treat as [[new:…]]"}
    return {"found": True, "items": [_vocab_row_out(r, allowed) for r in rows]}


def tool_search_references(db: Session, args: dict) -> dict:
    return {"hits": references.search(str(args.get("query") or ""))}


def tool_read_reference(db: Session, args: dict) -> dict:
    out = references.read_section(str(args.get("sheet") or ""), str(args.get("section") or ""))
    return out or {"error": "no such sheet/section"}


def tool_conjugate(db: Session, args: dict) -> dict:
    inf = str(args.get("verb") or "").strip().lower()
    v = CORE_VERBS_BY_INF.get(inf)
    if v is not None:
        return {
            "source": "core_verb_atlas", "infinitive": v.infinitive, "spanish": v.spanish, "english": v.english, "sprint": v.sprint,
            "ipa": v.ipa, "group": v.group, "present": dict(zip(("je", "tu", "il/elle", "nous", "vous", "ils/elles"), v.present)),
            "participle": v.participle, "auxiliary": v.auxiliary, "es_present": v.es_present, "family": v.family,
            "constructions": v.constructions, "examples": v.examples, "prepositions": v.prepositions,
            "pronunciation": v.pronunciation, "notes": v.notes,
        }
    data = conjugator.conjugate(inf, "fr")
    if not data:
        return {"error": "unknown verb"}
    forms = [f for f in data["forms"] if f["mood"] == "indicative" and f["tense"] in ("present", "passé composé", "passe compose")]
    return {"source": "conjugator", "infinitive": data["infinitive"], "group": data.get("group"),
            "is_irregular": data.get("is_irregular"), "forms": forms[:24],
            "note": "not a month-1 core verb — say so if the learner is relying on it"}


def tool_find_activities(db: Session, args: dict) -> dict:
    skill = str(args.get("skill") or "").strip().lower()
    query = str(args.get("query") or "").strip().lower()
    sprint_of = _activity_sprint()
    active = get_state(db).active_sprint
    hits = []
    for a in ALL_ACTIVITIES.values():
        if a.kind in ("test", "external"):
            continue
        if skill and a.skill != skill:
            continue
        hay = f"{a.name} {a.target} {a.format} {a.skill}".lower()
        if query and not any(t in hay for t in query.split()):
            continue
        hits.append({"id": a.id, "name": a.name, "skill": a.skill, "minutes": a.minutes, "kind": a.kind,
                     "format": a.format, "target": a.target, "sprint": sprint_of.get(a.id)})
    hits.sort(key=lambda h: (abs((h["sprint"] or active) - active), h["minutes"]))
    return {"activities": hits[:12]}


def tool_get_progress(db: Session, args: dict) -> dict:
    sprint = get_state(db).active_sprint
    p = sprint_progress(db, sprint)
    return {
        "sprint": sprint, "readiness": p["readiness"], "dims": {k: round(v, 2) for k, v in p["dims"].items()},
        "weakest": weakest_dimensions(p),
        "grammar_unmet": [g["id"] for g in p["grammar"] if not g["met"]],
        "pronunciation_unmet": [x["id"] for x in p["pronunciation"] if not x["met"]],
        "targets": p["targets"],
    }


def tool_log_interference(db: Session, args: dict) -> dict:
    error, correct = str(args.get("error") or "").strip(), str(args.get("correct") or "").strip()
    if not error or not correct:
        return {"error": "error and correct required"}
    ref = str(args.get("ref") or "").strip()
    if ref and not references.valid_ref(ref):
        ref = ""
    existing = db.execute(
        select(LearningInterference).where(LearningInterference.error.ilike(error), LearningInterference.resolved.is_(False))
    ).scalars().first()
    if existing:
        existing.times_seen += 1
        existing.last_seen = datetime.now(timezone.utc)
        db.commit()
        return {"logged": True, "id": existing.id, "times_seen": existing.times_seen, "note": "already logged; count bumped"}
    row = LearningInterference(error=error, correct=correct, spanish_source=str(args.get("why") or "").strip()[:300],
                               explanation=str(args.get("explanation") or "").strip()[:500], ref=ref, source="tutor")
    db.add(row)
    db.commit()
    return {"logged": True, "id": row.id, "times_seen": 1}


def tool_mark_encountered(db: Session, args: dict) -> dict:
    french = str(args.get("french") or "").strip()
    if not french:
        return {"error": "french required"}
    row = sync.add_encountered(
        db, french=french, spanish=str(args.get("spanish") or ""), english=str(args.get("english") or ""),
        part_of_speech=str(args.get("part_of_speech") or ""), gender=str(args.get("gender") or ""),
        ipa=str(args.get("ipa") or ""), example_fr=str(args.get("example_fr") or ""), example_es=str(args.get("example_es") or ""),
        sprint=get_state(db).active_sprint, status="encountered",
    )
    return {"ok": True, "french": row.french, "status": row.status}


def _obj(properties: dict, required: tuple[str, ...] = ()) -> dict:
    return {"type": "object", "properties": properties, "required": list(required), "additionalProperties": False}


TOOLS = ToolRegistry([
    LLMTool("lookup_vocab", "Look up a French word in the learner's curriculum + vocabulary: meaning, gender, IPA, example, Spanish connection, "
            "and the learner's own status/mastery. Use before saying whether they 'know' a word.",
            _obj({"word": {"type": "string", "description": "French word, with or without article."}}, ("word",)),
            tool_lookup_vocab, lambda db, a: f"looking up {a.get('word', '')}"),
    LLMTool("search_references", "Find reference-sheet sections (pronunciation, spelling, grammar, ES→FR transfer…) matching a query. Returns sheet#section ids to link.",
            _obj({"query": {"type": "string"}}, ("query",)),
            tool_search_references, lambda db, a: f"searching references for “{a.get('query', '')}”"),
    LLMTool("read_reference", "Read one reference sheet section (its rows/notes) so you can cite it precisely. Omit section to list a sheet's sections.",
            _obj({"sheet": {"type": "string"}, "section": {"type": "string"}}, ("sheet",)),
            tool_read_reference, lambda db, a: f"reading {a.get('sheet', '')}#{a.get('section', '')}".rstrip("#")),
    LLMTool("conjugate", "Conjugation + Spanish parallel for a verb. Core month-1 verbs return the full atlas entry (constructions, examples, sound notes).",
            _obj({"verb": {"type": "string", "description": "French infinitive"}}, ("verb",)),
            tool_conjugate, lambda db, a: f"conjugating {a.get('verb', '')}"),
    LLMTool("find_activities", "List practice activities in the curriculum, optionally by skill (pronunciation | vocabulary | verbs | grammar | listening | speaking | reading) and/or keyword. Returns ids for [[activity:id]] links.",
            _obj({"skill": {"type": "string"}, "query": {"type": "string"}}),
            tool_find_activities, lambda db, a: "finding activities"),
    LLMTool("get_progress", "The learner's current sprint progress: readiness, per-dimension scores, unmet grammar/pronunciation targets.",
            _obj({}), tool_get_progress, lambda db, a: "checking progress"),
    LLMTool("log_interference", "Record a Spanish-driven French error in the learner's Interference Log (error → correct, why Spanish causes it). Call when you correct such an error.",
            _obj({"error": {"type": "string"}, "correct": {"type": "string"}, "why": {"type": "string", "description": "the Spanish source, one line"},
                  "explanation": {"type": "string"}, "ref": {"type": "string", "description": "sheet#section"}}, ("error", "correct", "why")),
            tool_log_interference, lambda db, a: f"logging “{a.get('error', '')}” → “{a.get('correct', '')}”"),
    LLMTool("mark_encountered", "Add a French word outside the curriculum to the learner's vocabulary as 'encountered' (no flashcards yet).",
            _obj({"french": {"type": "string"}, "spanish": {"type": "string"}, "english": {"type": "string"}, "part_of_speech": {"type": "string"},
                  "gender": {"type": "string"}, "ipa": {"type": "string"}, "example_fr": {"type": "string"}, "example_es": {"type": "string"}}, ("french",)),
            tool_mark_encountered, lambda db, a: f"adding {a.get('french', '')} as encountered"),
])


def _run_tool(db: Session, name: str, args: dict) -> str:
    tool = TOOLS.get(name)
    if tool is None:
        return json.dumps({"error": f"unknown tool {name}"})
    try:
        return json.dumps(tool.handler(db, args), ensure_ascii=False, default=str)
    except Exception as exc:  # noqa: BLE001 — tool errors must not kill the stream
        log.warning("tutor: tool %s failed: %s", name, exc)
        db.rollback()
        return json.dumps({"error": str(exc)[:200]})


# ---------------------------------------------------------------------------
# output tags — validation
# ---------------------------------------------------------------------------

TAG_RE = re.compile(r"\[\[(ref|activity):([^\]\n]+)\]\]")


def clean_tags(text: str) -> tuple[str, list[str]]:
    """Unwrap ref/activity tags whose ids don't exist. Returns (text, dropped ids)."""
    dropped: list[str] = []

    def sub(m: re.Match) -> str:
        kind, ident = m.group(1), m.group(2).strip()
        ok = references.valid_ref(ident) if kind == "ref" else ident in ALL_ACTIVITIES
        if ok:
            return f"[[{kind}:{ident}]]"
        dropped.append(f"{kind}:{ident}")
        return ident.replace("#", " · ").replace("-", " ") if kind == "ref" else ident
    return TAG_RE.sub(sub, text), dropped


# ---------------------------------------------------------------------------
# streaming tool loop
# ---------------------------------------------------------------------------

def available() -> bool:
    s = get_settings()
    return bool(s.open_router_api_key and (s.tutor_model or s.tutor_fallback_model))


def model_chain() -> list[str]:
    s = get_settings()
    return list(dict.fromkeys(m for m in (s.tutor_model, s.tutor_fallback_model) if m))


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _stream_once(model: str, convo: list[dict]):
    """One model call. Yields ('token', text), ('usage', dict) and finally ('calls', {idx: slot})."""
    s = get_settings()
    tool_calls: dict[int, dict] = {}
    with httpx.stream(
        "POST", f"{s.llm_base_url.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {s.open_router_api_key}"},
        # reasoning=low: Gemini Flash otherwise thinks for ~12 s before the first token (600 hidden
        # tokens, 4× the cost) and the answers were no better. Providers without the knob ignore it.
        json={"model": model, "messages": convo, "tools": TOOLS.active_schemas(), "stream": True, "temperature": 0.4,
              "reasoning": {"effort": "low"}, "usage": {"include": True}},
        timeout=90,
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
            if chunk.get("error"):
                raise httpx.HTTPError(str(chunk["error"]))
            if chunk.get("usage"):
                yield ("usage", chunk["usage"])
            choice = (chunk.get("choices") or [{}])[0]
            delta = choice.get("delta") or {}
            if delta.get("content"):
                yield ("token", delta["content"])
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
    yield ("calls", tool_calls)


def _chat_events(db: Session, messages: list[dict], thread_id: int | None, lang: str = "es"):
    """Agentic loop. Yields (event, data). Events: token · reset · tool · error · done."""
    if not available():
        yield ("error", {"message": "tutor not configured"})
        yield ("done", {})
        return
    convo = [{"role": "system", "content": system_prompt(db, thread_id, lang)}, *messages]
    models = model_chain()
    model = models[0]
    cost, tokens_in, tokens_out = 0.0, 0, 0
    try:
        for _ in range(MAX_TOOL_ROUNDS):
            content_parts: list[str] = []
            tool_calls: dict[int, dict] = {}
            for attempt, m in enumerate(models):
                model = m
                try:
                    for kind, data in _stream_once(m, convo):
                        if kind == "token":
                            content_parts.append(data)
                            yield ("token", {"text": data})
                        elif kind == "usage":
                            cost += float(data.get("cost") or 0)
                            tokens_in += int(data.get("prompt_tokens") or 0)
                            tokens_out += int(data.get("completion_tokens") or 0)
                        else:
                            tool_calls = data
                    break
                except httpx.HTTPError as exc:
                    log.warning("tutor: %s failed (%s)", m, exc)
                    if content_parts or attempt == len(models) - 1:
                        raise
            if not tool_calls:
                if content_parts:
                    break
                yield ("error", {"message": "the model returned an empty reply; try again"})
                break
            if content_parts:
                yield ("reset", {})  # hide pre-tool chatter; the tool trail says what happened
            ordered = [tool_calls[i] for i in sorted(tool_calls)]
            convo.append({"role": "assistant", "content": "".join(content_parts) or None, "tool_calls": [
                {"id": t["id"], "type": "function", "function": {"name": t["name"], "arguments": t["args"] or "{}"}} for t in ordered
            ]})
            for t in ordered:
                try:
                    args = json.loads(t["args"] or "{}")
                except ValueError:
                    args = {}
                tool = TOOLS.get(t["name"])
                yield ("tool", {"name": t["name"], "args": args, "label": tool.label(db, args) if tool else t["name"]})
                convo.append({"role": "tool", "tool_call_id": t["id"], "name": t["name"], "content": _run_tool(db, t["name"], args)})
        else:
            yield ("error", {"message": "too many lookups for one answer; ask a narrower question"})
        yield ("done", {"model": model, "cost": round(cost, 5), "tokens_in": tokens_in, "tokens_out": tokens_out})
    except httpx.HTTPError as exc:
        log.warning("tutor: stream failed: %s", exc)
        yield ("error", {"message": "model request failed"})
        yield ("done", {"model": model})
    except Exception:  # noqa: BLE001 — the browser must never see a silent SSE close
        log.exception("tutor: stream interrupted")
        yield ("error", {"message": "reply interrupted; please try again"})
        yield ("done", {"model": model})


# ---------------------------------------------------------------------------
# threads
# ---------------------------------------------------------------------------

def _title_from(content: str) -> str:
    text = " ".join(content.split())
    first = re.split(r"(?<=[.!?¿¡])\s+", text, maxsplit=1)[0]
    return (first[:TITLE_MAX_CHARS].rstrip() + "…") if len(first) > TITLE_MAX_CHARS else first


def _history(db: Session, thread_id: int) -> list[dict]:
    rows = db.execute(
        select(LearningTutorMessage).where(LearningTutorMessage.thread_id == thread_id).order_by(LearningTutorMessage.id.desc()).limit(MAX_HISTORY)
    ).scalars().all()
    out = []
    for m in reversed(rows):
        content = m.content
        if m.role == "user":
            content = render_focus(m.focus) + content
        out.append({"role": m.role, "content": content})
    return out


def converse(thread_id: int, user_content: str, focus: dict | None, lang: str = "es"):
    """Persisted SSE chat: save the user turn (with its focus), stream the reply,
    validate tags, save the assistant turn. Own session — a StreamingResponse
    outlives the request's dependency."""
    db = SessionLocal()
    try:
        thread = db.get(LearningTutorThread, thread_id)
        if thread is None:
            yield _sse("error", {"message": "thread not found"})
            yield _sse("done", {})
            return
        db.add(LearningTutorMessage(thread_id=thread.id, role="user", content=user_content, focus=focus or None))
        if not thread.title:
            thread.title = _title_from(user_content)
        if focus and not thread.focus:
            thread.focus = focus
        db.commit()

        acc: list[str] = []
        tools_used: list[dict] = []
        error_message = ""
        model = ""
        for name, data in _chat_events(db, _history(db, thread.id), thread.id, lang):
            if name == "token":
                acc.append(data["text"])
            elif name == "reset":
                acc.clear()
            elif name == "tool":
                tools_used.append(data)
            elif name == "error":
                error_message = str(data.get("message") or "reply interrupted")
            elif name == "done":
                model = str(data.get("model") or "")
                content, dropped = clean_tags("".join(acc))
                if not content:
                    content = f"⚠ {error_message or 'sin respuesta'}"
                db.add(LearningTutorMessage(thread_id=thread.id, role="assistant", content=content, tool_calls=tools_used or None))
                thread.updated_at = datetime.now(timezone.utc)
                db.commit()
                data = {**data, "content": content, "dropped": dropped}
            yield _sse(name, data)
    finally:
        db.close()
