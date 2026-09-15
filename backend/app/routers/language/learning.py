"""/language/learning — the French learning hub: dashboard, exercises, results,
sessions, mastery tests, vocabulary state, interference log, explain."""

from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.curriculum.articles import noun_display
from app.curriculum.pronunciation import PRON_TARGETS
from app.curriculum.sprints import ALL_ACTIVITIES, SPRINT_BY_NUMBER, SPRINTS
from app.curriculum.verbs import CORE_VERBS
from app.db import get_db
from app.models import (
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
    LearningAttempt,
    LearningInterference,
    LearningResult,
    LearningSession,
    LearningTest,
    LearningVocab,
    ReviewStateName,
)
from app.routers.language.shared import router
from app.schemas.learning import (
    AttemptIn,
    AttemptOut,
    AttemptProgressIn,
    CompletionIn,
    EncounterIn,
    ExercisesIn,
    ExplainIn,
    InterferenceIn,
    InterferenceOut,
    InterferenceUpdate,
    ResultsIn,
    SessionIn,
    SessionOut,
    StateIn,
    TestOut,
    TestStartIn,
    TestSubmitIn,
    TestSummary,
    VocabImportIn,
    VocabOut,
    VocabStatusIn,
)
from app.services.learning import drills, llm_learning, sessions, sync, tests
from app.services.learning.drills import PoolItem
from app.services.learning.mastery import (
    carryover,
    get_state,
    recent_activity,
    record_results,
    sprint_progress,
    verb_mastery_map,
)

PREFIX = "/learning"


def _sprint(db: Session, requested: int | None) -> int:
    if requested:
        return requested
    return get_state(db).active_sprint


def _vocab_out(v: LearningVocab) -> VocabOut:
    return VocabOut(
        id=v.id, curriculum_id=v.curriculum_id, french=v.french, display=noun_display(v.french, v.gender, v.part_of_speech),
        spanish=v.spanish, english=v.english, part_of_speech=v.part_of_speech,
        gender=v.gender, ipa=v.ipa, sprint=v.sprint, priority=v.priority, status=v.status, frequency_band=v.frequency_band,
        example_fr=v.example_fr, example_es=v.example_es, pattern=v.pattern, spanish_connection=v.spanish_connection,
        pronunciation_warning=v.pronunciation_warning, cognate_type=v.cognate_type, false_friend=v.false_friend,
        reference_links=list(v.reference_links or []), tags=list(v.tags or []), source=v.source, text_id=v.text_id,
        recognition=v.recognition, audio_recognition=v.audio_recognition, written_production=v.written_production,
        spoken_production=v.spoken_production, contextual_use=v.contextual_use, attempts=v.attempts, last_seen_at=v.last_seen_at,
    )


def _pool(db: Session, sprint: int, *, statuses: tuple[str, ...] = ("core",), only_sprint: bool = False) -> list[PoolItem]:
    query = select(LearningVocab).where(LearningVocab.status.in_(statuses))
    query = query.where(LearningVocab.sprint == sprint) if only_sprint else query.where(LearningVocab.sprint <= sprint)
    rows = db.execute(query).scalars().all()
    if not rows:
        return drills.pool_from_curriculum(sprint, statuses=statuses, only_sprint=only_sprint)
    out = []
    for r in rows:
        item = PoolItem(
            id=r.curriculum_id or f"v:{r.id}", french=r.french, spanish=r.spanish, english=r.english, pos=r.part_of_speech, gender=r.gender,
            ipa=r.ipa, sprint=r.sprint, status=r.status, example_fr=r.example_fr, example_es=r.example_es,
            spanish_connection=r.spanish_connection, pronunciation_warning=r.pronunciation_warning, refs=list(r.reference_links or []),
            mastery={"recognition": r.recognition, "audio_recognition": r.audio_recognition, "written_production": r.written_production,
                     "spoken_production": r.spoken_production, "contextual_use": r.contextual_use},
            attempts=r.attempts, priority=r.priority if r.sprint == sprint else max(r.priority, 2),
        )
        out.append(item)
    return out


def _due_counts(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    base = (
        select(func.count(FlashcardReview.id))
        .join(Flashcard, Flashcard.id == FlashcardReview.card_id)
        .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
        .where(FlashcardDeck.language == Language.fr)
    )
    due = db.execute(base.where(FlashcardReview.state != ReviewStateName.new, FlashcardReview.due <= now)).scalar_one()
    new = db.execute(base.where(FlashcardReview.state == ReviewStateName.new)).scalar_one()
    return {"due": int(due), "new": int(new)}


# ---------------------------------------------------------------------------
# dashboard + state + curriculum
# ---------------------------------------------------------------------------


@router.get(f"{PREFIX}/dashboard")
def dashboard(sprint: int | None = Query(default=None, ge=1, le=4), db: Session = Depends(get_db)):
    state = get_state(db)
    n = sprint or state.active_sprint
    cfg = SPRINT_BY_NUMBER[n]
    # first run: materialize the curriculum
    if db.execute(select(func.count(LearningVocab.id))).scalar_one() == 0:
        sync.sync_curriculum(db)
    progress = sprint_progress(db, n)
    last_test = db.execute(
        select(LearningTest).where(LearningTest.sprint == n, LearningTest.completed_at.is_not(None)).order_by(LearningTest.completed_at.desc())
    ).scalars().first()
    tests_count = db.execute(select(func.count(LearningTest.id)).where(LearningTest.sprint == n)).scalar_one()
    suggestion = sessions.recommend_next(db, sprint=n, progress=progress)
    interference_due = db.execute(
        select(func.count(LearningInterference.id)).where(LearningInterference.resolved.is_(False), LearningInterference.next_review <= datetime.now(timezone.utc))
    ).scalar_one()
    return {
        "state": {"active_sprint": state.active_sprint, "settings": state.settings},
        "sprints": [{"number": s.number, "title": s.title, "mission": s.mission} for s in SPRINTS],
        "sprint": cfg.as_dict(),
        "progress": progress,
        "carryover": carryover(db, n) if n == state.active_sprint else [],
        "cards": _due_counts(db),
        "recent": recent_activity(db),
        "last_test": _test_summary(last_test).model_dump() if last_test else None,
        "tests_count": int(tests_count),
        "llm": {"available": llm_learning.available(), "models": llm_learning.model_chain()},
        "suggestion": suggestion[:3],
        "interference_due": int(interference_due),
    }


@router.post(f"{PREFIX}/state")
def set_state(body: StateIn, db: Session = Depends(get_db)):
    state = get_state(db)
    state.active_sprint = body.active_sprint
    db.commit()
    return {"active_sprint": state.active_sprint}


@router.post(f"{PREFIX}/sync")
def sync_curriculum(db: Session = Depends(get_db)):
    return sync.sync_curriculum(db)


@router.get(f"{PREFIX}/curriculum")
def curriculum():
    return {
        "sprints": [s.as_dict() for s in SPRINTS],
        "verbs": [v.as_dict() for v in CORE_VERBS],
        "pronunciation": [t.as_dict() for t in PRON_TARGETS],
    }


# ---------------------------------------------------------------------------
# vocabulary
# ---------------------------------------------------------------------------


@router.get(f"{PREFIX}/vocab", response_model=list[VocabOut])
def list_vocab(
    sprint: int | None = Query(default=None, ge=1, le=4),
    status: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    if db.execute(select(func.count(LearningVocab.id))).scalar_one() == 0:
        sync.sync_curriculum(db)
    query = select(LearningVocab)
    if sprint:
        query = query.where(LearningVocab.sprint == sprint)
    if status:
        query = query.where(LearningVocab.status == status)
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.where(or_(func.lower(LearningVocab.french).like(like), func.lower(LearningVocab.spanish).like(like),
                                func.lower(LearningVocab.english).like(like)))
    rows = db.execute(query.order_by(LearningVocab.sprint, LearningVocab.priority, LearningVocab.id)).scalars().all()
    return [_vocab_out(v) for v in rows]


@router.patch(f"{PREFIX}/vocab/{{vocab_id}}", response_model=VocabOut)
def set_vocab_status(vocab_id: int, body: VocabStatusIn, db: Session = Depends(get_db)):
    row = db.get(LearningVocab, vocab_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Vocab item not found")
    sync.set_status(db, row, body.status)
    db.refresh(row)
    return _vocab_out(row)


@router.post(f"{PREFIX}/vocab/import")
def import_vocab(body: VocabImportIn, db: Session = Depends(get_db)):
    if not body.items:
        raise HTTPException(status_code=400, detail="No items")
    return sync.import_items(db, body.items)


@router.post(f"{PREFIX}/vocab/encounter", response_model=VocabOut, status_code=201)
def encounter(body: EncounterIn, db: Session = Depends(get_db)):
    if not body.french.strip():
        raise HTTPException(status_code=400, detail="french is required")
    row = sync.add_encountered(
        db, french=body.french, spanish=body.spanish, english=body.english, part_of_speech=body.part_of_speech, gender=body.gender,
        ipa=body.ipa, example_fr=body.example_fr, example_es=body.example_es, text_id=body.text_id, lexeme_id=body.lexeme_id,
        sprint=get_state(db).active_sprint, status=body.status,
    )
    if row.status != body.status:
        sync.set_status(db, row, body.status)
    return _vocab_out(row)


# ---------------------------------------------------------------------------
# exercises
# ---------------------------------------------------------------------------

DETERMINISTIC_FALLBACK = {"context_choice": "cloze"}


def build_exercises(db: Session, body: ExercisesIn) -> dict:
    act = ALL_ACTIVITIES.get(body.activity_id) if body.activity_id else None
    fmt = body.format or (act.format if act else None)
    params = {**(act.params if act else {}), **body.params}
    sprint = body.sprint or params.get("sprint") or get_state(db).active_sprint
    sprint = int(sprint)
    count = body.count or int(params.get("count") or 10)
    rng = random.Random()
    wants_llm = body.source == "llm" or (body.source == "auto" and act is not None and act.kind == "llm")
    meta = {"activity": act.as_dict() if act else None, "format": fmt, "sprint": sprint, "source": "deterministic", "model": "", "rejected": []}

    if act and act.kind == "self":
        return {**meta, "exercises": drills.self_task(params.get("task", "self_intro"), sprint)}
    if act and act.kind == "external":
        return {**meta, "exercises": []}
    if not fmt:
        raise HTTPException(status_code=400, detail="format or activity_id required")

    if wants_llm and fmt in llm_learning.LLM_FORMATS:
        try:
            out = llm_learning.generate_drill(db, fmt=fmt, sprint=sprint, count=count, targets=body.targets or list(params.get("targets") or []),
                                              difficulty=body.difficulty, fresh=body.fresh, extra=params.get("extra"))
        except Exception as exc:  # noqa: BLE001 — the app must stay usable without the model
            out = {"exercises": [], "source": "none", "model": "", "rejected": [str(exc)[:120]]}
        if out["exercises"] and (len(out["exercises"]) >= max(1, count // 2) or fmt in ("reading", "cognate_mining")):
            return {**meta, **out}
        meta["rejected"] = out.get("rejected", [])
        if body.source == "llm":
            return {**meta, **out}
        fmt = DETERMINISTIC_FALLBACK.get(fmt, fmt)
        meta["source"] = "deterministic (fallback)"

    fmt = DETERMINISTIC_FALLBACK.get(fmt, fmt)
    statuses = ("core", "recognition") if fmt in ("fr_to_es", "audio_recognition", "cloze") else ("core",)
    pool = _pool(db, sprint, statuses=statuses, only_sprint=bool(params.get("only_sprint_vocab")) or fmt == "vocab_lesson")
    if fmt == "fr_to_es":
        ex = drills.fr_to_es(rng, pool, sprint, count, timed=bool(params.get("timed")))
    elif fmt == "es_to_fr":
        ex = drills.es_to_fr(rng, pool, sprint, count)
    elif fmt == "audio_recognition":
        ex = drills.audio_recognition(rng, pool, sprint, count, timed=bool(params.get("timed")))
    elif fmt == "cloze":
        ex = drills.cloze(rng, pool, sprint, count)
    elif fmt == "vocab_lesson":
        ex = drills.vocabulary_lesson(rng, pool, sprint, count)
    elif fmt == "audio_comprehension":
        ex = drills.audio_comprehension(rng, pool, sprint, count)
    elif fmt == "dictation":
        ex = drills.dictation(rng, pool, sprint, count, level=int(params.get("level") or 1))
    elif fmt == "sentence_transform":
        ex = drills.sentence_transform(rng, sprint, count, transformations=params.get("transformations"), timed=bool(params.get("timed")))
    elif fmt == "translation_ladder":
        ex = drills.translation_ladder(rng, sprint, count, family=params.get("family"))
    elif fmt == "verb_drill":
        ex = drills.verb_drill(rng, sprint, count, tense=params.get("tense"), group=params.get("group"), only_sprint=bool(params.get("only_sprint")),
                               mixed=bool(params.get("mixed")), verbs=params.get("verbs") or body.targets or None, verb_mastery=verb_mastery_map(db))
    elif fmt in ("pronunciation_ab", "pronunciation_odd", "grapheme", "liaison", "read_aloud"):
        target = params.get("target") or (body.targets[0] if body.targets else None)
        if not target:
            raise HTTPException(status_code=400, detail="pronunciation target required")
        ex = drills.pronunciation_for(rng, target, sprint, count, unseen=bool(params.get("unseen")), extra=params.get("extra"))
    elif fmt == "timed_fluency":
        ex = drills.timed_fluency(rng, sprint, count, timed=bool(params.get("timed")))
    elif fmt == "self_task":
        ex = drills.self_task(params.get("task", "self_intro"), sprint)
    elif fmt == "error_repair":
        due = db.execute(
            select(LearningInterference).where(LearningInterference.resolved.is_(False)).order_by(LearningInterference.next_review).limit(count)
        ).scalars().all()
        log_items = [{"id": i.id, "error": i.error, "correct": i.correct, "spanish_source": i.spanish_source, "explanation": i.explanation,
                      "ref": i.ref, "pattern": i.pattern} for i in due]
        ex = drills.error_repair(rng, sprint, count, log_items)
    elif fmt == "reading":
        ex = drills.reading(sprint)
    elif fmt == "micro_dialogue":
        ex = drills.micro_dialogue(rng, sprint, count)
    elif fmt == "cognate_mining":
        ex = drills.cognate_mining(sprint)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown format {fmt}")
    return {**meta, "exercises": ex}


@router.post(f"{PREFIX}/exercises")
def exercises(body: ExercisesIn, db: Session = Depends(get_db)):
    return build_exercises(db, body)


# ---------------------------------------------------------------------------
# results + sessions
# ---------------------------------------------------------------------------


@router.post(f"{PREFIX}/results")
def submit_results(body: ResultsIn, db: Session = Depends(get_db)):
    rows = record_results(db, [r.model_dump() for r in body.results], session_id=body.session_id)
    if body.completion:
        c = body.completion
        db.add(LearningResult(
            occurred_at=datetime.now(timezone.utc), sprint=c.sprint, activity_id=c.activity_id, format="activity", source="activity",
            skill=c.skill, target_ids=[c.activity_id], dims={c.skill: 1.0}, correct=c.score >= 0.6, score=c.score,
            session_id=body.session_id, meta={"name": c.name, "summary": c.summary, "minutes": c.minutes, "sprint": c.sprint},
        ))
        if body.session_id:
            session = db.get(LearningSession, body.session_id)
            if session:
                done = list(session.completed or [])
                if c.activity_id not in done:
                    done.append(c.activity_id)
                session.completed = done
                if all(item.get("activity_id") in done for item in session.plan):
                    session.completed_at = datetime.now(timezone.utc)
        db.commit()
    return {"recorded": len(rows)}


# ---------------------------------------------------------------------------
# attempts: a practice run in progress
# ---------------------------------------------------------------------------


def _attempt_out(a: LearningAttempt) -> AttemptOut:
    return AttemptOut(
        id=a.id, activity_id=a.activity_id, title=a.title, format=a.format, skill=a.skill, sprint=a.sprint, session_id=a.session_id,
        payload=a.payload, index=a.index, total=len((a.payload or {}).get("exercises") or []), graded=list(a.graded or []),
        started_at=a.started_at, updated_at=a.updated_at, finished_at=a.finished_at,
    )


def _open_attempt(db: Session, attempt_id: int) -> LearningAttempt:
    row = db.get(LearningAttempt, attempt_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return row


@router.get(f"{PREFIX}/attempts", response_model=list[AttemptOut])
def list_attempts(db: Session = Depends(get_db)):
    """Unfinished runs, newest first - what the dashboard offers to resume."""
    rows = db.execute(
        select(LearningAttempt).where(LearningAttempt.finished_at.is_(None)).order_by(LearningAttempt.updated_at.desc()).limit(10)
    ).scalars().all()
    return [_attempt_out(a) for a in rows]


@router.post(f"{PREFIX}/attempts", response_model=AttemptOut, status_code=201)
def create_attempt(body: AttemptIn, db: Session = Depends(get_db)):
    """Starting an activity replaces any unfinished run of the same activity."""
    stale = db.execute(
        select(LearningAttempt).where(LearningAttempt.finished_at.is_(None), LearningAttempt.activity_id == body.activity_id)
    ).scalars().all()
    for row in stale:
        db.delete(row)
    attempt = LearningAttempt(
        activity_id=body.activity_id, title=body.title, format=body.format, skill=body.skill, sprint=body.sprint,
        session_id=body.session_id, payload=body.payload, index=0, graded=[],
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return _attempt_out(attempt)


@router.get(f"{PREFIX}/attempts/{{attempt_id}}", response_model=AttemptOut)
def get_attempt(attempt_id: int, db: Session = Depends(get_db)):
    return _attempt_out(_open_attempt(db, attempt_id))


@router.put(f"{PREFIX}/attempts/{{attempt_id}}", response_model=AttemptOut)
def update_attempt(attempt_id: int, body: AttemptProgressIn, db: Session = Depends(get_db)):
    attempt = _open_attempt(db, attempt_id)
    attempt.index = body.index
    attempt.graded = body.graded
    if body.payload is not None:
        attempt.payload = body.payload
    attempt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(attempt)
    return _attempt_out(attempt)


@router.post(f"{PREFIX}/attempts/{{attempt_id}}/finish", response_model=AttemptOut)
def finish_attempt(attempt_id: int, db: Session = Depends(get_db)):
    attempt = _open_attempt(db, attempt_id)
    attempt.finished_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(attempt)
    return _attempt_out(attempt)


@router.delete(f"{PREFIX}/attempts/{{attempt_id}}", status_code=204)
def discard_attempt(attempt_id: int, db: Session = Depends(get_db)):
    db.delete(_open_attempt(db, attempt_id))
    db.commit()


@router.post(f"{PREFIX}/sessions", response_model=SessionOut)
def create_session(body: SessionIn, db: Session = Depends(get_db)):
    sprint = body.sprint or get_state(db).active_sprint
    return sessions.build_session(db, sprint=sprint, minutes=body.minutes, use_llm=body.use_llm)


@router.get(f"{PREFIX}/sessions/{{session_id}}", response_model=SessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(LearningSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get(f"{PREFIX}/sessions", response_model=list[SessionOut])
def list_sessions(limit: int = Query(default=5, ge=1, le=50), db: Session = Depends(get_db)):
    return db.execute(select(LearningSession).order_by(LearningSession.created_at.desc()).limit(limit)).scalars().all()


# ---------------------------------------------------------------------------
# mastery tests
# ---------------------------------------------------------------------------


def _test_summary(t: LearningTest) -> TestSummary:
    return TestSummary(id=t.id, sprint=t.sprint, started_at=t.started_at, completed_at=t.completed_at, scores=t.scores, profile=t.profile,
                       readiness=t.readiness, passed=t.passed, weak=list(t.weak or []))


@router.post(f"{PREFIX}/tests", response_model=TestOut, status_code=201)
def start_test(body: TestStartIn, db: Session = Depends(get_db)):
    if db.execute(select(func.count(LearningVocab.id))).scalar_one() == 0:
        sync.sync_curriculum(db)
    return tests.start_test(db, body.sprint)


@router.get(f"{PREFIX}/tests", response_model=list[TestSummary])
def list_tests(sprint: int | None = Query(default=None, ge=1, le=4), db: Session = Depends(get_db)):
    query = select(LearningTest).order_by(LearningTest.started_at.desc())
    if sprint:
        query = query.where(LearningTest.sprint == sprint)
    return [_test_summary(t) for t in db.execute(query.limit(20)).scalars().all()]


@router.get(f"{PREFIX}/tests/{{test_id}}", response_model=TestOut)
def get_test(test_id: int, db: Session = Depends(get_db)):
    test = db.get(LearningTest, test_id)
    if test is None:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@router.post(f"{PREFIX}/tests/{{test_id}}/submit", response_model=TestOut)
def submit_test(test_id: int, body: TestSubmitIn, db: Session = Depends(get_db)):
    test = db.get(LearningTest, test_id)
    if test is None:
        raise HTTPException(status_code=404, detail="Test not found")
    return tests.score_test(db, test, [r.model_dump() for r in body.results])


# ---------------------------------------------------------------------------
# interference log
# ---------------------------------------------------------------------------


@router.get(f"{PREFIX}/interference", response_model=list[InterferenceOut])
def list_interference(include_resolved: bool = False, db: Session = Depends(get_db)):
    query = select(LearningInterference)
    if not include_resolved:
        query = query.where(LearningInterference.resolved.is_(False))
    return db.execute(query.order_by(LearningInterference.next_review)).scalars().all()


@router.post(f"{PREFIX}/interference", response_model=InterferenceOut, status_code=201)
def add_interference(body: InterferenceIn, db: Session = Depends(get_db)):
    row = LearningInterference(error=body.error.strip(), correct=body.correct.strip(), spanish_source=body.spanish_source.strip(),
                               explanation=body.explanation.strip(), ref=body.ref.strip(), source="manual")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch(f"{PREFIX}/interference/{{item_id}}", response_model=InterferenceOut)
def update_interference(item_id: int, body: InterferenceUpdate, db: Session = Depends(get_db)):
    row = db.get(LearningInterference, item_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete(f"{PREFIX}/interference/{{item_id}}", status_code=204)
def delete_interference(item_id: int, db: Session = Depends(get_db)):
    row = db.get(LearningInterference, item_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()


# ---------------------------------------------------------------------------
# explain
# ---------------------------------------------------------------------------


@router.post(f"{PREFIX}/explain")
def explain(body: ExplainIn, db: Session = Depends(get_db)):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    sprint = body.sprint or get_state(db).active_sprint
    out = llm_learning.explain_french(db, text=body.text, mode=body.mode, sprint=sprint, context_sentence=body.context)
    if out is None:
        raise HTTPException(status_code=503, detail="LLM unavailable")
    return out
