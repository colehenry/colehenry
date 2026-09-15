"""Sprint mastery tests: built from the deterministic engine with held-back
(unseen) pronunciation banks, scored into a *profile* — never a single gate.

The learner can always advance; weak dimensions are stored on the attempt and
carried forward by `mastery.carryover`.
"""

from __future__ import annotations

import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.curriculum.sprints import DIMENSIONS, SPRINT_BY_NUMBER
from app.models import LearningTest, LearningVocab
from app.services.learning import drills
from app.services.learning.drills import PoolItem
from app.services.learning.mastery import profile_label, record_results

SELF_TASK_BY_SPRINT = {1: "self_intro", 2: "self_description", 3: "yesterday_story", 4: "five_minutes"}


def _pool(db: Session, sprint: int) -> list[PoolItem]:
    rows = db.execute(select(LearningVocab).where(LearningVocab.sprint == sprint, LearningVocab.status == "core")).scalars().all()
    if not rows:
        return drills.pool_from_curriculum(sprint, only_sprint=True)
    out = []
    for r in rows:
        out.append(PoolItem(
            id=r.curriculum_id or f"v:{r.id}", french=r.french, spanish=r.spanish, english=r.english, pos=r.part_of_speech, gender=r.gender,
            ipa=r.ipa, sprint=r.sprint, status=r.status, example_fr=r.example_fr, example_es=r.example_es,
            spanish_connection=r.spanish_connection, pronunciation_warning=r.pronunciation_warning, refs=list(r.reference_links or []),
            mastery={}, attempts=0, priority=r.priority,
        ))
    return out


def build_test(db: Session, sprint: int) -> dict:
    cfg = SPRINT_BY_NUMBER[sprint]
    rng = random.Random()
    pool = _pool(db, sprint)
    prio = [p for p in pool if p.priority == 1] or pool
    sections: list[dict] = []

    def section(sid: str, dimension: str, title: str, exercises: list[dict], weight: float = 1.0) -> None:
        for ex in exercises:
            ex["source"] = "test"
        if exercises:
            sections.append({"id": sid, "dimension": dimension, "title": title, "exercises": exercises, "weight": weight})

    section("vocab_recognition", "vocabulary", "Recognition · FR → ES", drills.fr_to_es(rng, pool, sprint, 20))
    section("vocab_production", "vocabulary", "Production · ES → FR", drills.es_to_fr(rng, prio, sprint, 12), weight=1.2)
    section("verbs", "verbs", "Verbs in context",
            drills.verb_drill(rng, sprint, 12, only_sprint=True, tense="passe_compose" if sprint == 3 else None, mixed=sprint == 4))
    pron: list[dict] = []
    for t in cfg.pronunciation:
        n = 3 if t.kind == "self" else 4
        pron += drills.pronunciation_for(rng, t.id, sprint, n, unseen=True)
    section("pronunciation", "pronunciation", "Sound discrimination · unseen words", pron[:24])
    grammar = drills.sentence_transform(rng, sprint, 8)
    if sprint >= 2:
        grammar += drills.translation_ladder(rng, sprint, 1)
    section("grammar", "grammar", "Transformations", grammar)
    listening = drills.dictation(rng, pool, sprint, 4, level=min(sprint, 4)) + drills.audio_comprehension(rng, pool, sprint, 4)
    section("listening", "listening", "Listening", listening)
    speaking = drills.timed_fluency(rng, sprint, 8) + drills.self_task(SELF_TASK_BY_SPRINT[sprint], sprint)
    section("speaking", "speaking", "Speaking", speaking)
    if sprint >= 3:
        section("reading", "reading", "Reading", drills.reading(sprint))
    if sprint == 4:
        section("writing", "writing", "Writing", drills.self_task("writing_150", sprint))

    return {"sprint": sprint, "title": f"Sprint {sprint} · {cfg.title} · mastery test", "sections": sections,
            "criteria": [{"dimension": c.dimension, "label": c.label} for c in cfg.criteria]}


def start_test(db: Session, sprint: int) -> LearningTest:
    payload = build_test(db, sprint)
    test = LearningTest(sprint=sprint, payload=payload)
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


def score_test(db: Session, test: LearningTest, results: list[dict]) -> LearningTest:
    """results: graded items (same shape as ResultIn) tagged with meta.section."""
    cfg = SPRINT_BY_NUMBER[test.sprint]
    for r in results:
        r["source"] = "test"
    record_results(db, results, test_id=test.id)

    by_section: dict[str, list[float]] = {}
    for r in results:
        sid = (r.get("meta") or {}).get("section", "")
        by_section.setdefault(sid, []).append(float(r["score"]))
    section_scores = {sid: (sum(v) / len(v)) for sid, v in by_section.items() if v}

    dim_scores: dict[str, list[tuple[float, float]]] = {}
    for sec in test.payload["sections"]:
        if sec["id"] in section_scores:
            dim_scores.setdefault(sec["dimension"], []).append((section_scores[sec["id"]], sec.get("weight", 1.0)))
    scores = {}
    for d, pairs in dim_scores.items():
        total_w = sum(w for _, w in pairs)
        scores[d] = round(sum(s * w for s, w in pairs) / total_w, 3) if total_w else 0.0

    weights = cfg.weights
    covered = [d for d in DIMENSIONS if d in scores and weights.get(d, 0) > 0]
    readiness = sum(weights[d] * scores[d] for d in covered) / max(sum(weights[d] for d in covered), 1e-9) if covered else 0.0
    profile = {d: profile_label(v) for d, v in scores.items()}
    weak = [d for d, v in scores.items() if v < 0.6]
    passed = readiness >= 0.7 and all(v >= 0.45 for v in scores.values())

    test.scores = {**scores, "sections": section_scores}
    test.profile = profile
    test.readiness = round(readiness, 3)
    test.weak = weak
    test.passed = passed
    test.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(test)
    return test
