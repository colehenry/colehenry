"""Learning model: results in, sprint progress / weak areas out.

Pragmatic, not ML. Every graded item lands in `learning_results`; vocabulary
items also carry EMA mastery dimensions on their `learning_vocab` row (SRS
reviews feed those too). Sprint progress is recomputed on read from those
two sources — cheap at single-learner volume.

Dashboard percentages are completion measures, not accuracy or curriculum
weights. Every dimension starts at zero. A learned target or a successfully
completed, trackable sprint activity contributes one unit; partial attempts do
not make the visible percentage move. Accuracy still determines when lexical,
verb, pronunciation, and grammar targets count as learned.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.curriculum.pronunciation import PRON_BY_ID
from app.curriculum.sprints import ALL_ACTIVITIES, ALL_GRAMMAR, SPRINT_BY_NUMBER, DIMENSIONS
from app.curriculum.verbs import CORE_VERBS_BY_INF
from app.models import (
    Flashcard,
    LearningGenerated,
    LearningInterference,
    LearningResult,
    LearningState,
    LearningTest,
    LearningVocab,
)

EMA_ALPHA = 0.3
KNOWN_THRESHOLD = 0.75
PRODUCTIVE_THRESHOLD = 0.6
VERB_ATTEMPTS = 8
GRAMMAR_ATTEMPTS = 8

# result format → which vocab dimension it evidences
FORMAT_DIM = {
    "fr_to_es": "recognition",
    "cloze": "contextual_use",
    "audio_recognition": "audio_recognition",
    "audio_comprehension": "audio_recognition",
    "dictation": "audio_recognition",
    "es_to_fr": "written_production",
    "srs_recognition": "recognition",
    "srs_production": "written_production",
    "context_choice": "contextual_use",
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_state(db: Session) -> LearningState:
    state = db.get(LearningState, 1)
    if state is None:
        state = LearningState(id=1, active_sprint=1, settings={})
        db.add(state)
        db.commit()
    return state


def ema(old: float, attempts: int, score: float) -> float:
    """First evidence on a dimension sets the level outright: a clean first pass
    clears KNOWN_THRESHOLD, a shaky one does not. Later evidence blends in."""
    if attempts <= 0:
        return round(0.75 * score + 0.1 * (1 if score >= 0.7 else 0), 3)
    return round(old + EMA_ALPHA * (score - old), 3)


# ---------------------------------------------------------------------------
# ingest
# ---------------------------------------------------------------------------


def _vocab_rows_for_targets(db: Session, target_ids: list[str]) -> list[LearningVocab]:
    cids = [t for t in target_ids if t.startswith("fr_")]
    dbids = [int(t[2:]) for t in target_ids if t.startswith("v:") and t[2:].isdigit()]
    rows: list[LearningVocab] = []
    if cids:
        rows += db.execute(select(LearningVocab).where(LearningVocab.curriculum_id.in_(cids))).scalars().all()
    if dbids:
        rows += db.execute(select(LearningVocab).where(LearningVocab.id.in_(dbids))).scalars().all()
    return rows


def apply_vocab_result(row: LearningVocab, dim: str, score: float, when: datetime) -> None:
    current = getattr(row, dim, None)
    if current is None:
        return
    # `attempts` is shared across dimensions; a dimension still at zero has no evidence of its own.
    setattr(row, dim, ema(current, 0 if current == 0 else row.attempts, score))
    row.attempts += 1
    row.last_seen_at = when


def record_results(db: Session, results: list[dict], *, session_id: int | None = None, test_id: int | None = None) -> list[LearningResult]:
    """Persist a batch of graded items and update derived state. `results` are
    dicts matching schemas.learning.ResultIn (already validated)."""
    when = now_utc()
    rows: list[LearningResult] = []
    for r in results:
        row = LearningResult(
            occurred_at=when,
            sprint=r["sprint"],
            activity_id=r.get("activity_id", ""),
            format=r["format"],
            source=r.get("source", "deterministic"),
            skill=r["skill"],
            target_ids=list(r.get("target_ids", [])),
            dims=dict(r.get("dims", {})),
            correct=bool(r["correct"]),
            score=float(r["score"]),
            prompt=r.get("prompt", "")[:1000],
            answer=r.get("answer", "")[:1000],
            expected=r.get("expected", "")[:1000],
            time_ms=int(r.get("time_ms", 0)),
            generated_id=r.get("generated_id"),
            session_id=session_id,
            test_id=test_id,
            meta=dict(r.get("meta", {})),
        )
        db.add(row)
        rows.append(row)

        # vocabulary dimensions
        dim = FORMAT_DIM.get(r["format"]) or r.get("meta", {}).get("dim")
        if dim and r.get("target_ids"):
            for v in _vocab_rows_for_targets(db, list(r["target_ids"])):
                apply_vocab_result(v, dim, float(r["score"]), when)

        # generated-exercise stats
        if r.get("generated_id"):
            g = db.get(LearningGenerated, r["generated_id"])
            if g:
                g.attempts += 1
                g.correct += 1 if r["correct"] else 0

        # interference log: failed repairs recycle; matching patterns get logged
        if r["format"] == "error_repair":
            _touch_interference(db, r, when)
        elif not r["correct"] and r.get("answer") and r["format"] in ("sentence_transform", "translation_ladder", "es_to_fr", "verb_drill"):
            _detect_interference(db, r, when)
    db.commit()
    return rows


def _touch_interference(db: Session, r: dict, when: datetime) -> None:
    meta = r.get("meta", {})
    iid = meta.get("interference_id")
    item = db.get(LearningInterference, iid) if iid else None
    if item is None and meta.get("curated"):
        pattern = (r.get("target_ids") or [""])[0].replace("repair:", "")
        item = db.execute(select(LearningInterference).where(LearningInterference.pattern == pattern)).scalar_one_or_none()
        if item is None and not r["correct"]:
            item = LearningInterference(
                error=r.get("prompt", "").lstrip("✗ ").strip(), correct=r.get("expected", ""), spanish_source=meta.get("es", ""),
                explanation=meta.get("explanation", ""), ref=meta.get("ref", ""), pattern=pattern, source="curated", times_seen=0,
            )
            db.add(item)
    if item is None:
        return
    item.last_seen = when
    if r["correct"]:
        # each success pushes the next visit out and works the counter down; at 0 it's resolved
        item.times_seen = max(0, item.times_seen - 1)
        item.next_review = when + timedelta(days=7 if item.times_seen else 21)
        item.resolved = item.times_seen == 0
    else:
        item.times_seen += 1
        item.resolved = False
        item.next_review = when + timedelta(days=1)


def _detect_interference(db: Session, r: dict, when: datetime) -> None:
    """Auto-log classic Spanish-interference shapes seen in a wrong free answer."""
    from app.curriculum.sentences import REPAIRS

    answer = (r.get("answer") or "").lower()
    for wrong, right, es_src, expl, ref, _s, pattern in REPAIRS:
        try:
            if pattern and re.search(pattern, answer):
                item = db.execute(select(LearningInterference).where(LearningInterference.pattern == pattern)).scalar_one_or_none()
                if item is None:
                    item = LearningInterference(error=r.get("answer", "")[:200], correct=r.get("expected", "")[:200], spanish_source=es_src,
                                                explanation=expl, ref=ref, pattern=pattern, source="auto", times_seen=1,
                                                next_review=when + timedelta(days=1))
                    db.add(item)
                else:
                    item.times_seen += 1
                    item.last_seen = when
                    item.resolved = False
                    item.next_review = min(item.next_review, when + timedelta(days=1)) if item.next_review else when
                return
        except re.error:
            continue


def on_card_review(db: Session, card: Flashcard, rating: int) -> None:
    """SRS grade → vocab mastery (called from the review endpoint)."""
    if not card.source_ref.startswith("vocab:"):
        return
    try:
        vid = int(card.source_ref.split(":", 1)[1])
    except ValueError:
        return
    row = db.get(LearningVocab, vid)
    if row is None:
        return
    score = {1: 0.0, 2: 0.4, 3: 0.85, 4: 1.0}.get(rating, 0.5)
    dim = "written_production" if card.direction.value == "production" else "recognition"
    when = now_utc()
    apply_vocab_result(row, dim, score, when)
    db.add(LearningResult(
        occurred_at=when, sprint=row.sprint, activity_id="srs", format=f"srs_{card.direction.value}", source="srs",
        skill="vocabulary", target_ids=[row.curriculum_id or f"v:{row.id}"], dims={"vocabulary": 1.0},
        correct=rating >= 3, score=score, prompt=card.front[:200], expected=card.back[:200], meta={"card_id": card.id, "rating": rating},
    ))


# ---------------------------------------------------------------------------
# progress
# ---------------------------------------------------------------------------


def _acc(results: list[LearningResult]) -> float:
    if not results:
        return 0.0
    recent = results[-40:]
    return sum(r.score for r in recent) / len(recent)


def _coverage(count: int, needed: int) -> float:
    return min(1.0, count / needed) if needed else 1.0


def sprint_progress(db: Session, sprint: int) -> dict:
    cfg = SPRINT_BY_NUMBER[sprint]
    since = now_utc() - timedelta(days=240)
    results = db.execute(
        select(LearningResult).where(LearningResult.occurred_at >= since).order_by(LearningResult.occurred_at)
    ).scalars().all()

    by_target: dict[str, list[LearningResult]] = defaultdict(list)
    by_skill: dict[str, list[LearningResult]] = defaultdict(list)
    completions: dict[str, list[LearningResult]] = defaultdict(list)  # skill → successful activity completions
    for r in results:
        if r.format == "activity":
            if (r.sprint == sprint or r.meta.get("sprint") == sprint) and r.correct:
                completions[r.skill].append(r)
            continue
        for t in r.target_ids:
            by_target[t].append(r)
        by_skill[r.skill].append(r)

    # vocabulary
    vocab_rows = db.execute(
        select(LearningVocab).where(LearningVocab.sprint == sprint, LearningVocab.status == "core")
    ).scalars().all()
    known = [v for v in vocab_rows if v.recognition >= KNOWN_THRESHOLD]
    productive = [v for v in vocab_rows if v.written_production >= PRODUCTIVE_THRESHOLD]

    # verbs
    verb_detail = []
    for v in cfg.verbs:
        rs = by_target.get(f"verb:{v.infinitive}", [])
        acc = _acc(rs)
        verb_detail.append({"id": v.infinitive, "label": v.infinitive, "accuracy": round(acc, 2), "attempts": len(rs),
                            "met": len(rs) >= VERB_ATTEMPTS and acc >= 0.8,
                            "progress": round(_coverage(len(rs), VERB_ATTEMPTS) * acc, 2)})

    # pronunciation
    pron_detail = []
    for t in cfg.pronunciation:
        rs = by_target.get(f"pron:{t.id}", [])
        acc = _acc(rs)
        met = len(rs) >= t.min_attempts and acc >= t.threshold
        pron_detail.append({"id": t.id, "label": t.label, "accuracy": round(acc, 2), "attempts": len(rs), "met": met,
                            "progress": round(min(1.0, _coverage(len(rs), t.min_attempts) * acc / t.threshold), 2), "ref": t.ref,
                            "kind": t.kind})

    # grammar
    grammar_detail = []
    for g in cfg.grammar:
        if g.recognition_only:
            continue
        rs = by_target.get(g.id, [])
        acc = _acc(rs)
        grammar_detail.append({"id": g.id, "label": g.label, "accuracy": round(acc, 2), "attempts": len(rs),
                               "met": len(rs) >= GRAMMAR_ATTEMPTS and acc >= 0.8,
                               "progress": round(_coverage(len(rs), GRAMMAR_ATTEMPTS) * acc, 2), "ref": g.ref})

    # Trackable practice is finite curriculum work. Resources, free text work,
    # SRS queues, and the sprint test are useful but do not inflate completion.
    trackable_kinds = {"drill", "llm", "self"}
    practice_bank: dict[str, list[str]] = defaultdict(list)
    for activity in cfg.activities:
        if activity.kind in trackable_kinds:
            practice_bank[activity.skill].append(activity.id)
    completed_activity_ids = {r.activity_id for rows in completions.values() for r in rows}
    practice = {
        skill: {
            "done": len(set(ids) & completed_activity_ids),
            "total": len(ids),
        }
        for skill, ids in practice_bank.items()
    }

    def combined_progress(skill: str, learned: int, targets: int) -> float:
        work = practice.get(skill, {"done": 0, "total": 0})
        total = targets + work["total"]
        return round((learned + work["done"]) / total, 3) if total else 0.0

    verbs_learned = sum(d["met"] for d in verb_detail)
    pron_learned = sum(d["met"] for d in pron_detail)
    grammar_learned = sum(d["met"] for d in grammar_detail)
    listening_done = len({r.activity_id for r in completions.get("listening", [])})
    speaking_done = len({r.activity_id for r in completions.get("speaking", [])})
    reading_done = len({r.activity_id for r in completions.get("reading", [])})
    writing_done = len({r.activity_id for r in completions.get("writing", [])})

    dims = {
        "vocabulary": combined_progress("vocabulary", len(known), len(vocab_rows)),
        "verbs": combined_progress("verbs", verbs_learned, len(verb_detail)),
        "pronunciation": combined_progress("pronunciation", pron_learned, len(pron_detail)),
        "grammar": combined_progress("grammar", grammar_learned, len(grammar_detail)),
        "listening": round(min(1.0, listening_done / cfg.listening_target), 3) if cfg.listening_target else 0.0,
        "speaking": round(min(1.0, speaking_done / cfg.output_target), 3) if cfg.output_target else 0.0,
        "reading": round(min(1.0, reading_done / 3), 3),
        "writing": round(min(1.0, writing_done / 2), 3),
    }
    weights = cfg.weights
    visible_dims = [d for d in DIMENSIONS if weights.get(d, 0) > 0]
    readiness = sum(dims[d] for d in visible_dims) / len(visible_dims) if visible_dims else 0.0

    targets = [
        {"id": "vocab", "label": f"{len(vocab_rows)} core words", "done": len(known), "total": len(vocab_rows), "detail": f"{len(productive)} productive",
         "dimension": "vocabulary"},
        {"id": "verbs", "label": f"{len(cfg.verbs)} core verbs", "done": verbs_learned, "total": len(verb_detail), "dimension": "verbs"},
        {"id": "pronunciation", "label": f"{len(pron_detail)} pronunciation targets", "done": pron_learned, "total": len(pron_detail),
         "dimension": "pronunciation"},
        {"id": "grammar", "label": f"{len(grammar_detail)} grammar patterns", "done": grammar_learned, "total": len(grammar_detail),
         "dimension": "grammar"},
        {"id": "listening", "label": f"{cfg.listening_target} listening exercises", "done": listening_done, "total": cfg.listening_target,
         "dimension": "listening"},
        {"id": "output", "label": f"{cfg.output_target} output checks", "done": speaking_done, "total": cfg.output_target, "dimension": "speaking"},
    ]

    return {
        "sprint": sprint,
        "dims": dims,
        "weights": weights,
        "readiness": round(readiness, 3),
        "targets": targets,
        "verbs": verb_detail,
        "pronunciation": pron_detail,
        "grammar": grammar_detail,
        "vocab": {"total": len(vocab_rows), "known": len(known), "productive": len(productive)},
        "completions": {k: len(v) for k, v in completions.items()},
        "completed_activity_ids": sorted(completed_activity_ids),
        "practice": practice,
    }


def profile_label(value: float) -> str:
    if value >= 0.8:
        return "strong"
    if value >= 0.6:
        return "adequate"
    return "weak"


def carryover(db: Session, active_sprint: int) -> list[dict]:
    """Weak dimensions from earlier sprints that stay visible and keep getting recommended."""
    out = []
    for s in range(1, active_sprint):
        test = db.execute(
            select(LearningTest).where(LearningTest.sprint == s, LearningTest.completed_at.is_not(None)).order_by(LearningTest.completed_at.desc())
        ).scalars().first()
        if test and test.weak:
            for d in test.weak:
                out.append({"sprint": s, "dimension": d, "source": "test"})
            continue
        progress = sprint_progress(db, s)
        for d, v in progress["dims"].items():
            if SPRINT_BY_NUMBER[s].weights.get(d, 0) > 0 and v < 0.6:
                out.append({"sprint": s, "dimension": d, "source": "progress"})
    return out


def weakest_dimensions(progress: dict, n: int = 3) -> list[str]:
    weights = progress["weights"]
    scored = [(d, progress["dims"][d]) for d in DIMENSIONS if weights.get(d, 0) > 0]
    scored.sort(key=lambda x: x[1])
    return [d for d, _ in scored[:n]]


def recent_activity(db: Session, limit: int = 8) -> list[dict]:
    rows = db.execute(
        select(LearningResult).where(LearningResult.format == "activity").order_by(LearningResult.occurred_at.desc()).limit(limit)
    ).scalars().all()
    out = []
    for r in rows:
        act = ALL_ACTIVITIES.get(r.activity_id)
        out.append({
            "activity_id": r.activity_id, "name": (act.name if act else r.meta.get("name", r.activity_id)), "skill": r.skill,
            "score": r.score, "correct": r.correct, "occurred_at": r.occurred_at.isoformat(),
            "summary": r.meta.get("summary", ""),
        })
    return out


def verb_mastery_map(db: Session) -> dict[str, float]:
    since = now_utc() - timedelta(days=240)
    rows = db.execute(select(LearningResult).where(LearningResult.occurred_at >= since)).scalars().all()
    acc: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        for t in r.target_ids:
            if t.startswith("verb:"):
                acc[t[5:]].append(r.score)
    return {k: (sum(v[-20:]) / len(v[-20:])) * min(1.0, len(v) / VERB_ATTEMPTS) for k, v in acc.items()}
