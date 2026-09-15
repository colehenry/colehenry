"""Learning-AI service: every model call for the French hub goes through here.

    generate_drill(...)       validated, cached exercises in the shared shape
    compose_session(...)      picks among *existing* activities for a time budget
    explain_french(...)       short Spanish-bridge explanation of a French item
    analyze_conversation(...) prepared interface (v2)
    analyze_text(...)         prepared interface (v2)
    generate_micro_content(...) prepared interface (v2)

Rules: curriculum + learner state + deterministic constraints → LLM. Output is
strict JSON, validated (schema · supported format · target present · unknown
vocabulary budget) and rejected when malformed. Good generations are cached in
`learning_generated` and re-served after spacing instead of regenerating.
Model chain: LEARNING_MODEL → FALLBACK_MODEL → MULTILINGUAL_MODEL. Keys stay
server-side; the app keeps working when nothing answers.
"""

from __future__ import annotations

import hashlib
import json
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.curriculum.sprints import ALL_ACTIVITIES, ALL_GRAMMAR, SPRINT_BY_NUMBER
from app.models import LearningGenerated
from app.services.learning.context import allowed_vocabulary, build_context, unknown_ratio
from app.services.learning.drills import ref_link

log = logging.getLogger(__name__)

PROMPT_VERSION = 2
REUSE_AFTER = timedelta(days=3)
UNKNOWN_BUDGET = 0.15

LLM_FORMATS = ("es_to_fr", "cloze", "sentence_transform", "translation_ladder", "context_choice", "micro_dialogue",
               "error_repair", "reading", "cognate_mining")

SYSTEM = """You write French practice for ONE learner: A0 French, C1 Spanish, native English.
Rules (non-negotiable):
- Metropolitan France French. Natural, conversational, short, plausible. No textbook nonsense.
- Spanish is the bridge: prompts and explanations in Spanish; English only if it truly helps.
- ~90% of the French must come from the learner's known/learning vocabulary lists supplied. Never add advanced words to practice one target.
- One primary difficulty per item. Rotate contexts: daily life, work, friends, tech, travel, media, sports, plans, opinions.
- Where several natural answers exist, list them all in accepted_answers (with and without est-ce que; nous/on; etc.).
- A French noun on its own is never shown or accepted bare: always with an article that reveals its gender (le/la, un/une; "un ami" not "l'ami").
- Output ONLY valid JSON matching the requested schema. No prose, no markdown fences."""

FORMAT_SPECS = {
    "es_to_fr": ("Spanish sentence → the learner types the French.",
                 '{"prompt_es": str, "accepted_answers": [str, ...], "explanation_es": str, "target_ids": [str], "context": str}'),
    "cloze": ("French sentence with ONE blank written as ___ ; the missing word is the target.",
              '{"prompt": str (contains ___), "prompt_es": str, "accepted_answers": [str], "explanation_es": str, "target_ids": [str]}'),
    "sentence_transform": ("Base French sentence + ONE instruction (→ negative / → question / → il / vouloir → pouvoir / → futur proche / → passé composé / demain → hier).",
                           '{"prompt": str (base sentence), "instruction": str, "accepted_answers": [str, ...], "explanation_es": str, "target_ids": [str]}'),
    "translation_ladder": ("A ladder of 4-5 rungs exploring ONE construction: affirmative → negative → question → other person → other tense. Each rung is its own item with the same group id.",
                           '{"group": str, "rung": int, "prompt_es": str, "accepted_answers": [str, ...], "explanation_es": str, "target_ids": [str]}'),
    "context_choice": ("Short French context (1-2 sentences) with a blank; 4 options, one fits.",
                       '{"prompt": str (contains ___), "prompt_es": str, "options": [str, str, str, str], "answer": str, "explanation_es": str, "target_ids": [str]}'),
    "micro_dialogue": ("One French line from an interlocutor + a goal (answer negatively with a reason, ask a follow-up…). Learner types a reply; list 3-5 natural accepted replies using known language.",
                       '{"prompt": str (the line), "prompt_es": str, "goal_es": str, "accepted_answers": [str, ...], "explanation_es": str, "target_ids": [str]}'),
    "error_repair": ("A sentence with ONE typical Spanish-interference error; learner types the corrected sentence.",
                     '{"prompt": str (wrong sentence), "prompt_es": str (Spanish source), "accepted_answers": [str], "explanation_es": str, "target_ids": [str], "pattern": str}'),
    "reading": ("ONE short French passage (60-110 words) using known language + the targets, then 3 comprehension questions (in French) with 4 options each. Return ONE object.",
                '{"title": str, "passage": str, "questions": [{"q": str, "options": [str, str, str, str], "answer": str}], "glossary_es": [{"fr": str, "es": str}], "target_ids": [str]}'),
    "cognate_mining": ("ONE French paragraph (60-90 words) dense with Spanish-transparent cognates on a real-world topic, plus the cognate list with Spanish equivalents, IPA, and pronunciation traps.",
                       '{"passage": str, "cognates": [{"fr": str, "es": str, "ipa": str, "trap": str}], "target_ids": [str]}'),
}


# ---------------------------------------------------------------------------
# transport
# ---------------------------------------------------------------------------


def available() -> bool:
    s = get_settings()
    return bool(s.open_router_api_key and (s.learning_model or s.fallback_model or s.multilingual_model))


def model_chain() -> list[str]:
    s = get_settings()
    chain = [m for m in (s.learning_model, s.fallback_model, s.multilingual_model) if m]
    return list(dict.fromkeys(chain))


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    return text.strip()


def chat_json(system: str, user: str, *, max_tokens: int = 2500, temperature: float = 0.7) -> tuple[dict | None, str]:
    """Call the model chain; return (parsed JSON, model slug) or (None, "")."""
    if not available():
        return None, ""
    settings = get_settings()
    for model in model_chain():
        try:
            res = httpx.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.open_router_api_key}"},
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                },
                timeout=90,
            )
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"] or ""
            data = json.loads(_strip_fences(content))
            if isinstance(data, dict):
                return data, model
        except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as exc:
            log.warning("learning llm call failed with %s: %s", model, exc)
            continue
    return None, ""


# ---------------------------------------------------------------------------
# validation → shared exercise shape
# ---------------------------------------------------------------------------


def _target_forms(target: str) -> list[str]:
    """Lexical forms a target can surface as. Grammar ids (snake_case / in the
    grammar map) are structural — they aren't checked lexically."""
    t = target.strip().lower()
    if not t or t in ALL_GRAMMAR or "_" in t:
        return []
    forms = [t]
    try:
        from app.services.learning.grammar import verb_info

        info = verb_info(t)
        forms += list(info["present"]) + [info["participle"]]
    except KeyError:
        pass
    return [f for f in forms if len(f) >= 2]


def _targets_ok(item: dict, targets: list[str]) -> bool:
    lexical = [f for t in targets for f in _target_forms(t)]
    if not lexical:
        return True
    haystack = " " + " ".join([
        str(item.get("prompt", "")), " ".join(item.get("accepted_answers", []) or []), str(item.get("answer", "")),
        str(item.get("passage", "")), " ".join(item.get("options", []) or []),
    ]).lower().replace("'", " ") + " "
    return any(f" {f} " in haystack or f" {f}," in haystack or f" {f}." in haystack or f" {f}?" in haystack for f in lexical)


def _french_text(item: dict, fmt: str) -> str:
    bits = [str(item.get("prompt", "")), str(item.get("passage", ""))]
    bits += [str(a) for a in (item.get("accepted_answers") or [])]
    bits += [str(o) for o in (item.get("options") or [])]
    if fmt in ("es_to_fr", "translation_ladder", "micro_dialogue"):
        bits = [b for b in bits if b != item.get("prompt_es")]
    return " ".join(bits)


def validate_item(item: dict, fmt: str, sprint: int, targets: list[str], allowed: set[str]) -> tuple[bool, str]:
    if not isinstance(item, dict):
        return False, "not an object"
    if fmt in ("es_to_fr", "translation_ladder", "micro_dialogue"):
        if not item.get("prompt_es") or not item.get("accepted_answers"):
            return False, "missing prompt_es / accepted_answers"
    elif fmt in ("cloze", "error_repair", "sentence_transform"):
        if not item.get("prompt") or not item.get("accepted_answers"):
            return False, "missing prompt / accepted_answers"
        if fmt == "cloze" and "___" not in item["prompt"]:
            return False, "cloze without blank"
        if fmt == "sentence_transform" and not item.get("instruction"):
            return False, "transform without instruction"
    elif fmt == "context_choice":
        opts = item.get("options") or []
        if not item.get("prompt") or len(opts) < 3 or len(set(opts)) != len(opts) or item.get("answer") not in opts:
            return False, "bad options / answer"
    elif fmt == "reading":
        qs = item.get("questions") or []
        if not item.get("passage") or len(qs) < 2:
            return False, "missing passage / questions"
        for q in qs:
            if not q.get("q") or len(q.get("options") or []) < 3 or q.get("answer") not in q["options"]:
                return False, "bad question"
        words = len(str(item["passage"]).split())
        if words > 160:
            return False, "passage too long"
    elif fmt == "cognate_mining":
        if not item.get("passage") or len(item.get("cognates") or []) < 5:
            return False, "missing passage / cognates"
    else:
        return False, f"unsupported format {fmt}"
    if not _targets_ok(item, targets):
        return False, "target not present"
    ratio, unknown = unknown_ratio(_french_text(item, fmt), allowed)
    budget = UNKNOWN_BUDGET + (0.1 if fmt in ("reading", "cognate_mining") else 0)
    if ratio > budget:
        return False, f"unknown vocabulary {ratio:.0%}: {', '.join(unknown[:6])}"
    return True, ""


def to_exercise(item: dict, fmt: str, sprint: int, generated_id: int | None) -> list[dict]:
    """Convert a validated LLM item into the shared exercise shape (a reading yields several)."""
    def base(kind: str, skill: str, dims: dict, **kw) -> dict:
        ex = {
            "id": uuid.uuid4().hex[:12], "format": fmt, "kind": kind, "sprint": sprint, "skill": skill, "dims": dims, "source": "llm",
            "instructions": "", "prompt": "", "prompt_es": "", "hint": "", "audio": None, "audio_only": False, "autoplay": False,
            "options": [], "answer_id": None, "accepted": [], "reveal": "", "explanation": item.get("explanation_es", "") or "",
            "refs": [ref_link(ALL_GRAMMAR[t].ref) for t in (item.get("target_ids") or []) if t in ALL_GRAMMAR][:2],
            "target_ids": [t for t in (item.get("target_ids") or []) if isinstance(t, str)][:6], "difficulty": 2,
            "transformation": "", "pattern": "", "group": "", "meta": {"generated_id": generated_id}, "generated_id": generated_id,
        }
        ex.update(kw)
        return ex

    accepted = list(dict.fromkeys(str(a).strip() for a in (item.get("accepted_answers") or []) if str(a).strip()))
    if fmt == "es_to_fr":
        return [base("typed", "grammar", {"grammar": 0.5, "vocabulary": 0.5}, instructions="→ français", prompt=item["prompt_es"],
                     accepted=accepted, meta={"generated_id": generated_id, "speak_after": accepted[0], "context": item.get("context", "")})]
    if fmt == "cloze":
        return [base("typed", "vocabulary", {"vocabulary": 0.6, "grammar": 0.4}, instructions="Complète", prompt=item["prompt"],
                     prompt_es=item.get("prompt_es", ""), accepted=accepted,
                     meta={"generated_id": generated_id, "dim": "contextual_use", "speak_after": item["prompt"].replace("___", accepted[0])})]
    if fmt == "sentence_transform":
        return [base("typed", "grammar", {"grammar": 0.6, "verbs": 0.4}, instructions=item["instruction"], prompt=item["prompt"],
                     prompt_es=item.get("prompt_es", ""), accepted=accepted, audio={"language": "fr", "text": item["prompt"]},
                     transformation="llm", meta={"generated_id": generated_id, "speak_after": accepted[0]})]
    if fmt == "translation_ladder":
        return [base("typed", "grammar", {"grammar": 0.5, "verbs": 0.3, "writing": 0.2},
                     instructions=f"Échelle {item.get('rung', '')}", prompt=item["prompt_es"], accepted=accepted,
                     group=f"llm-{item.get('group', 'ladder')}", meta={"generated_id": generated_id, "speak_after": accepted[0]})]
    if fmt == "context_choice":
        opts = list(item["options"])
        options = [{"id": "abcd"[i], "text": o, "audio": None} for i, o in enumerate(opts[:4])]
        answer_id = "abcd"[opts.index(item["answer"])] if item["answer"] in opts[:4] else "a"
        return [base("mc", "vocabulary", {"vocabulary": 1.0}, instructions="Choisis", prompt=item["prompt"], prompt_es=item.get("prompt_es", ""),
                     options=options, answer_id=answer_id, meta={"generated_id": generated_id, "dim": "contextual_use",
                                                                 "speak_after": item["prompt"].replace("___", item["answer"])})]
    if fmt == "micro_dialogue":
        return [base("typed", "speaking", {"speaking": 0.5, "grammar": 0.5}, instructions=f"Réponds · {item.get('goal_es', '')}",
                     prompt=f"— {item['prompt']}", prompt_es=item.get("prompt_es", ""), accepted=accepted,
                     audio={"language": "fr", "text": item["prompt"]}, autoplay=True,
                     meta={"generated_id": generated_id, "lenient": True, "samples": accepted[:4], "speak_after": accepted[0]})]
    if fmt == "error_repair":
        return [base("typed", "grammar", {"grammar": 1.0}, instructions="Corrige", prompt=f"✗ {item['prompt']}", prompt_es=item.get("prompt_es", ""),
                     accepted=accepted, pattern=str(item.get("pattern", ""))[:200], meta={"generated_id": generated_id, "speak_after": accepted[0]})]
    if fmt == "reading":
        group = f"reading-{uuid.uuid4().hex[:8]}"
        out = []
        glossary = "\n".join(f"{g.get('fr')} = {g.get('es')}" for g in (item.get("glossary_es") or []) if isinstance(g, dict))
        for i, q in enumerate(item["questions"][:4]):
            opts = list(q["options"])[:4]
            options = [{"id": "abcd"[j], "text": o, "audio": None} for j, o in enumerate(opts)]
            out.append(base("mc", "reading", {"reading": 0.7, "vocabulary": 0.3}, instructions=item.get("title", "Lecture"), prompt=q["q"],
                            options=options, answer_id="abcd"[opts.index(q["answer"])] if q["answer"] in opts else "a", group=group,
                            explanation=glossary if i == 0 else "", meta={"generated_id": generated_id, "passage": item["passage"],
                                                                          "passage_audio": True, "index": i, "glossary": glossary}))
        return out
    if fmt == "cognate_mining":
        table = "\n".join(f"{c.get('fr')} → {c.get('es')} {c.get('ipa', '')} {('· ⚠ ' + c['trap']) if c.get('trap') else ''}".strip()
                          for c in item["cognates"] if isinstance(c, dict))
        return [base("self", "reading", {"reading": 0.7, "vocabulary": 0.3}, instructions="Devine avant de traduire · marque ta confiance",
                     prompt=item["passage"], audio={"language": "fr", "text": item["passage"]}, reveal=table,
                     refs=[ref_link("transfer#cognates")], meta={"generated_id": generated_id, "self_scale": ["<50%", "~70%", "~85%", "tout"]})]
    return []


# ---------------------------------------------------------------------------
# generate drill (cache first)
# ---------------------------------------------------------------------------


def _params_hash(fmt: str, sprint: int, targets: list[str], difficulty: int, extra: dict | None = None) -> str:
    extra_json = json.dumps(extra or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    raw = f"{fmt}|{sprint}|{','.join(sorted(targets))}|{difficulty}|{extra_json}|v{PROMPT_VERSION}"
    return hashlib.sha1(raw.encode()).hexdigest()[:32]


def _cached(db: Session, fmt: str, sprint: int, phash: str, count: int, rng: random.Random) -> list[LearningGenerated]:
    cutoff = datetime.now(timezone.utc) - REUSE_AFTER
    rows = db.execute(
        select(LearningGenerated).where(
            LearningGenerated.format == fmt, LearningGenerated.sprint == sprint, LearningGenerated.params_hash == phash,
            LearningGenerated.valid.is_(True),
        )
    ).scalars().all()
    fresh = [r for r in rows if r.last_served_at is None or r.last_served_at < cutoff]
    # drop items the learner keeps getting right (≥ 3 attempts, ≥ 90 %)
    fresh = [r for r in fresh if not (r.attempts >= 3 and r.correct / r.attempts >= 0.9)]
    rng.shuffle(fresh)
    return fresh[:count]


def generate_drill(db: Session, *, fmt: str, sprint: int, count: int = 8, targets: list[str] | None = None, difficulty: int = 2,
                   fresh: bool = False, extra: dict | None = None) -> dict:
    """Returns {exercises, source: cache|llm|none, model, rejected}."""
    if fmt not in LLM_FORMATS:
        return {"exercises": [], "source": "none", "model": "", "rejected": [f"unsupported {fmt}"]}
    targets = [t for t in (targets or []) if t]
    rng = random.Random()
    extra = extra or {}
    phash = _params_hash(fmt, sprint, targets, difficulty, extra)
    want = 1 if fmt in ("reading", "cognate_mining") else count
    exercises: list[dict] = []
    used_models: set[str] = set()
    if not fresh:
        for row in _cached(db, fmt, sprint, phash, want, rng):
            row.served_count += 1
            row.last_served_at = datetime.now(timezone.utc)
            exercises += to_exercise(row.payload, fmt, sprint, row.id)
            used_models.add(row.model)
        if len(exercises) >= want or (fmt in ("reading", "cognate_mining") and exercises):
            db.commit()
            return {"exercises": exercises, "source": "cache", "model": ", ".join(sorted(used_models)), "rejected": []}
    remaining = want - (len(exercises) if fmt not in ("reading", "cognate_mining") else 0)
    if not available():
        db.commit()
        return {"exercises": exercises, "source": "cache" if exercises else "none", "model": "", "rejected": ["llm unavailable"]}

    ctx = build_context(db, sprint, purpose="drill")
    allowed = allowed_vocabulary(sprint)
    desc, schema = FORMAT_SPECS[fmt]
    n = remaining if fmt not in ("reading", "cognate_mining") else 1
    n_request = n + 2 if fmt not in ("reading", "cognate_mining", "translation_ladder") else n
    user = json.dumps({
        "learner_context": ctx,
        "request": {
            "format": fmt, "format_description": desc, "count": n_request, "targets": targets or ctx["target_grammar"][:3] + ctx["target_verbs"][:3],
            "difficulty": difficulty, "sprint_grammar": [g.label for g in SPRINT_BY_NUMBER[sprint].grammar],
            "extra": extra,
        },
        "output_schema": {"exercises": [json.loads(_schema_to_json(schema))]},
        "notes": "Return {\"exercises\": [...]} with exactly the schema fields. accepted_answers must be complete French sentences where the prompt is a sentence.",
    }, ensure_ascii=False)
    data, model = chat_json(SYSTEM, user)
    rejected: list[str] = []
    if data is None:
        db.commit()
        return {"exercises": exercises, "source": "cache" if exercises else "none", "model": "", "rejected": ["llm failed"]}
    raw_items = data.get("exercises") if isinstance(data.get("exercises"), list) else [data]
    added = 0
    for item in raw_items:
        base_sentence = str(extra.get("base_sentence", "")).strip()
        if fmt == "sentence_transform" and base_sentence and str(item.get("prompt", "")).strip() != base_sentence:
            ok, why = False, "base sentence not preserved"
        else:
            ok, why = validate_item(item, fmt, sprint, targets, allowed)
        if not ok:
            rejected.append(why)
            continue
        row = LearningGenerated(params_hash=phash, format=fmt, sprint=sprint, targets=targets, model=model, prompt_version=PROMPT_VERSION,
                                payload=item, valid=True, served_count=1, last_served_at=datetime.now(timezone.utc))
        db.add(row)
        db.flush()
        if added < n:
            exercises += to_exercise(item, fmt, sprint, row.id)
            added += 1
        else:
            row.served_count = 0
            row.last_served_at = None  # banked for next time
    db.commit()
    return {"exercises": exercises, "source": "llm" if added else ("cache" if exercises else "none"), "model": model, "rejected": rejected}


def _schema_to_json(schema: str) -> str:
    """Turn the human-readable schema string into a JSON example object."""
    out = schema
    for word in ("str (contains ___)", "str (base sentence)", "str (the line)", "str (wrong sentence)", "str (Spanish source)"):
        out = out.replace(word, '"str"')
    out = out.replace("[str, ...]", '["str"]').replace("[str, str, str, str]", '["str","str","str","str"]').replace("[str]", '["str"]')
    out = out.replace(": str", ': "str"').replace(": int", ": 1")
    return out


# ---------------------------------------------------------------------------
# session composer
# ---------------------------------------------------------------------------

SESSION_SYSTEM = """You compose ONE study session for a French learner from a fixed activity bank.
Pick 2-6 activity ids whose minutes sum to roughly the budget (±15%). Prefer: due reviews first if any, then the weakest dimensions,
then the sprint's main skill, then some input (listening/reading) and some output (speaking). Never invent activities.
Output ONLY JSON: {"activities": [{"id": str, "minutes": int, "why": str}]}"""


def compose_session(db: Session, *, sprint: int, minutes: int) -> dict | None:
    if not available():
        return None
    ctx = build_context(db, sprint, purpose="session")
    data, model = chat_json(SESSION_SYSTEM, json.dumps({"budget_minutes": minutes, "context": ctx}, ensure_ascii=False), max_tokens=600, temperature=0.4)
    if not data:
        return None
    plan = []
    total = 0
    for a in data.get("activities") or []:
        if not isinstance(a, dict):
            continue
        act = ALL_ACTIVITIES.get(str(a.get("id", "")))
        if act is None or act.kind == "test":
            continue
        m = int(a.get("minutes") or act.minutes)
        m = max(3, min(m, 60))
        plan.append({"activity_id": act.id, "name": act.name, "skill": act.skill, "minutes": m, "kind": act.kind, "format": act.format,
                     "params": act.params, "target": act.target, "resource": act.resource, "why": str(a.get("why", ""))[:120]})
        total += m
    if not plan or total > minutes * 1.6 or total < minutes * 0.5:
        return None
    return {"plan": plan, "model": model}


# ---------------------------------------------------------------------------
# explain
# ---------------------------------------------------------------------------

EXPLAIN_SYSTEM = """You explain French to a learner with C1 Spanish (A0 French). Answer in Spanish, max 120 words, no preamble.
Lead with the precise Spanish parallel when one exists (venir de + inf ↔ acabar de + inf). Flag false friends and pronunciation traps.
Give 2 short French examples with Spanish glosses. Output ONLY JSON: {"explanation": str, "examples": [{"fr": str, "es": str}], "refs": [str]}
refs are optional reference ids among: pronunciation, spelling, transfer, core-verbs, sentence-architecture, questions, articles, tense-map, pronouns, spoken-french, numbers."""

EXPLAIN_MODES = {
    "explain": "Explain this.",
    "compare_es": "Compare it precisely with Spanish: what transfers, what doesn't.",
    "why_tense": "Why this tense / construction here? Compare with the Spanish choice.",
    "more_examples": "Give 4 more natural short examples with Spanish glosses (known language only).",
    "pronunciation": "How is it pronounced? IPA, the spelling → sound rules involved, and the Spanish-speaker traps.",
}


def explain_french(db: Session, *, text: str, mode: str, sprint: int, context_sentence: str = "") -> dict | None:
    text = text.strip()[:300]
    mode = mode if mode in EXPLAIN_MODES else "explain"
    phash = hashlib.sha1(f"explain|{mode}|{text.lower()}|{context_sentence.lower()[:120]}".encode()).hexdigest()[:32]
    cached = db.execute(select(LearningGenerated).where(LearningGenerated.format == "explain", LearningGenerated.params_hash == phash)).scalars().first()
    if cached:
        cached.served_count += 1
        cached.last_served_at = datetime.now(timezone.utc)
        db.commit()
        return {**cached.payload, "cached": True}
    if not available():
        return None
    ctx = build_context(db, sprint, purpose="explain")
    ctx.pop("core_vocab_known", None)
    user = json.dumps({"item": text, "context_sentence": context_sentence, "task": EXPLAIN_MODES[mode], "learner": ctx}, ensure_ascii=False)
    data, model = chat_json(EXPLAIN_SYSTEM, user, max_tokens=700, temperature=0.5)
    if not data or not data.get("explanation"):
        return None
    payload = {
        "explanation": str(data["explanation"])[:1200],
        "examples": [{"fr": str(e.get("fr", "")), "es": str(e.get("es", ""))} for e in (data.get("examples") or []) if isinstance(e, dict)][:6],
        "refs": [ref_link(r) for r in (data.get("refs") or []) if isinstance(r, str)][:3],
        "mode": mode, "text": text,
    }
    db.add(LearningGenerated(params_hash=phash, format="explain", sprint=sprint, targets=[text], model=model, prompt_version=PROMPT_VERSION,
                             payload=payload, valid=True, served_count=1, last_served_at=datetime.now(timezone.utc)))
    db.commit()
    return {**payload, "cached": False}


# ---------------------------------------------------------------------------
# prepared interfaces (v2 — not wired to UI yet)
# ---------------------------------------------------------------------------


def analyze_conversation(db: Session, *, transcript: str, sprint: int) -> dict:
    """Post-conversation analysis contract: important_errors, spanish_interference,
    useful_reformulations, pronunciation_targets, candidate_cards. Selective (≤ 5 each)."""
    raise NotImplementedError("v2: wire when conversation transcripts exist")


def analyze_text(db: Session, *, text: str, sprint: int) -> dict:
    """Smart text analysis contract: classify tokens as known / recognition /
    transparent_es / inferable / unknown_useful / unknown_low; recommend promotions."""
    raise NotImplementedError("v2: wire from the Texts reader")


def generate_micro_content(db: Session, *, sprint: int, topic: str, required: list[str], length: int) -> dict:
    """Constrained short text/dialogue from known language, reusable for reading,
    TTS, comprehension, cloze, transformation, retelling."""
    raise NotImplementedError("v2")
