"""Session composer — rules first, LLM optional.

A session is an ordered list of activity-bank entries with minutes. The rules
composer always works (offline); the LLM composer may override it when it
returns a valid plan built only from existing activities.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.curriculum.sprints import SPRINT_BY_NUMBER, Activity
from app.models import FlashcardReview, LearningResult, LearningSession, ReviewStateName
from app.services.learning import llm_learning
from app.services.learning.mastery import carryover, sprint_progress, weakest_dimensions

SPRINT_MAIN_SKILL = {1: "pronunciation", 2: "grammar", 3: "grammar", 4: "speaking"}


def _plan_item(act: Activity, minutes: int, why: str) -> dict:
    return {"activity_id": act.id, "name": act.name, "skill": act.skill, "minutes": minutes, "kind": act.kind, "format": act.format,
            "params": act.params, "target": act.target, "resource": act.resource, "why": why}


def _recent_activity_ids(db: Session, days: int = 2) -> set[str]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.execute(select(LearningResult.activity_id).where(LearningResult.format == "activity", LearningResult.occurred_at >= since)).scalars().all()
    return set(rows)


def compose_rules(db: Session, *, sprint: int, minutes: int, progress: dict | None = None) -> list[dict]:
    cfg = SPRINT_BY_NUMBER[sprint]
    progress = progress or sprint_progress(db, sprint)
    weak = weakest_dimensions(progress, 3)
    recent = _recent_activity_ids(db)
    rng = random.Random()
    due = db.execute(
        select(func.count(FlashcardReview.id)).where(FlashcardReview.state != ReviewStateName.new, FlashcardReview.due <= datetime.now(timezone.utc))
    ).scalar_one()

    bank = [a for a in cfg.activities if a.kind != "test"]
    used: set[str] = set()
    plan: list[dict] = []
    budget = minutes

    def pick(skill: str | None, *, kinds: tuple[str, ...], max_minutes: int, why: str, prefer_unseen: bool = True) -> bool:
        nonlocal budget
        candidates = [a for a in bank if a.id not in used and a.kind in kinds and a.minutes <= max_minutes and (skill is None or a.skill == skill)]
        if not candidates:
            return False
        fresh = [a for a in candidates if a.id not in recent] if prefer_unseen else candidates
        act = rng.choice(fresh or candidates)
        m = min(act.minutes, budget)
        plan.append(_plan_item(act, m, why))
        used.add(act.id)
        budget -= m
        return True

    # 1. due retrieval
    if due > 0:
        srs = next((a for a in bank if a.kind == "srs"), None)
        if srs:
            m = max(3, min(int(minutes * 0.3), 4 + due // 4, 20))
            plan.append(_plan_item(srs, m, f"{due} due"))
            used.add(srs.id)
            budget -= m

    # 2. weakest dimension · 3. sprint skill · 4. input · 5. output — cycle until spent
    carry = [c["dimension"] for c in carryover(db, sprint)]
    order: list[tuple[str | None, tuple[str, ...], str]] = [
        (weak[0], ("drill", "llm"), f"weakest: {weak[0]}"),
        (SPRINT_MAIN_SKILL[sprint], ("drill",), "sprint focus"),
        ("listening", ("drill",) if minutes < 20 else ("drill", "external"), "input"),
        ("speaking", ("drill", "self"), "output"),
    ]
    if carry:
        order.insert(1, (carry[0], ("drill",), f"carry-over: {carry[0]}"))
    if minutes >= 30:
        order.append((weak[1] if len(weak) > 1 else None, ("drill", "llm"), f"weak: {weak[1] if len(weak) > 1 else 'mixed'}"))
        order.append(("reading", ("text", "llm", "drill"), "reading"))
    if minutes >= 60:
        order.append(("grammar", ("external",), "workbook"))
        order.append(("listening", ("external",), "extended input"))
        order.append((None, ("drill",), "mixed review"))

    for skill, kinds, why in order:
        if budget < 3:
            break
        cap = budget if budget < 15 else max(5, int(budget * 0.5))
        pick(skill, kinds=kinds, max_minutes=max(cap, 5), why=why)

    # fill leftovers with short drills
    guard = 0
    while budget >= 4 and guard < 6:
        guard += 1
        if not pick(None, kinds=("drill",), max_minutes=budget, why="fill"):
            break
    return plan


def build_session(db: Session, *, sprint: int, minutes: int, use_llm: bool = True) -> LearningSession:
    plan = None
    source = "rules"
    if use_llm and minutes >= 10:
        try:
            composed = llm_learning.compose_session(db, sprint=sprint, minutes=minutes)
        except Exception:  # noqa: BLE001 — never let the composer break the button
            composed = None
        if composed:
            plan, source = composed["plan"], "llm"
    if plan is None:
        plan = compose_rules(db, sprint=sprint, minutes=minutes)
    session = LearningSession(sprint=sprint, minutes=minutes, source=source, plan=plan, completed=[])
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
