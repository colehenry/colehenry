from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_owner
from app.models import ChallengeCompletion, ChallengeState, User
from app.schemas.challenge import (
    CHALLENGE_COUNT,
    ChallengeDashboard,
    CompletionIn,
    OrderUpdate,
    VideoIdeasIn,
    WindowOut,
)

router = APIRouter(prefix="/challenges", tags=["challenges"])

# Milestone deadlines, preserved to the day from the original plan. Window n
# runs from the day after milestone n-1 through milestone n, inclusive. A
# completion counts only toward the window its date falls in — no banking.
MILESTONES = [
    date(2026, 7, 14),
    date(2026, 8, 4),
    date(2026, 8, 25),
    date(2026, 9, 15),
    date(2026, 10, 6),
    date(2026, 10, 27),
    date(2026, 11, 17),
    date(2026, 12, 8),
    date(2026, 12, 29),
    date(2027, 1, 19),
    date(2027, 2, 9),
]
FINISH = date(2027, 2, 15)


def _window_index(d: date) -> int | None:
    """Window a completion date falls in; None for the post-M11 tail."""
    for i, m in enumerate(MILESTONES):
        if d <= m:
            return i + 1
    return None


def _get_state(db: Session) -> ChallengeState:
    state = db.get(ChallengeState, 1)
    if state is None:
        state = ChallengeState(id=1, ordering=list(range(1, CHALLENGE_COUNT + 1)))
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def _build_dashboard(db: Session, today: date) -> ChallengeDashboard:
    state = _get_state(db)
    rows = db.execute(select(ChallengeCompletion)).scalars().all()
    completions = {r.challenge_id: r.completed_at for r in rows}

    counts = [0] * len(MILESTONES)
    for d in completions.values():
        idx = _window_index(d)
        if idx is not None:
            counts[idx - 1] += 1

    current_window = _window_index(today) if today <= MILESTONES[-1] else None

    windows: list[WindowOut] = []
    any_missed = False
    for i, m in enumerate(MILESTONES):
        start = MILESTONES[i - 1] + timedelta(days=1) if i else m - timedelta(days=20)
        count = counts[i]
        if count > 0:
            status = "met"
        elif m < today:
            # An empty ended window is only a miss if challenges were still
            # unfinished when it closed — once all 25 are done, later empty
            # windows carry no obligation.
            done_by_end = sum(1 for d in completions.values() if d <= m)
            status = "missed" if done_by_end < CHALLENGE_COUNT else "met"
            any_missed = any_missed or status == "missed"
        elif current_window == i + 1:
            status = "current"
        else:
            status = "upcoming"
        windows.append(WindowOut(index=i + 1, start=start, end=m, status=status, count=count))

    completed_count = len(completions)
    if any_missed or (today > FINISH and completed_count < CHALLENGE_COUNT):
        run_status = "failed"
    elif completed_count == CHALLENGE_COUNT:
        run_status = "won"
    elif current_window is not None and counts[current_window - 1] == 0:
        run_status = "due"
    elif current_window is None:
        # Post-M11 tail: every window met, finish the stragglers by FINISH.
        run_status = "due"
    else:
        run_status = "on_track"

    return ChallengeDashboard(
        ordering=state.ordering,
        completions=completions,
        windows=windows,
        run_status=run_status,
        completed_count=completed_count,
        current_window=current_window,
        finish=FINISH,
        video_ideas=state.video_ideas,
    )


@router.get("/dashboard", response_model=ChallengeDashboard)
def dashboard(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    return _build_dashboard(db, date.today())


@router.put("/order", response_model=ChallengeDashboard)
def set_order(
    payload: OrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    state = _get_state(db)
    state.ordering = payload.ordering
    db.commit()
    return _build_dashboard(db, date.today())


@router.put("/video-ideas", response_model=ChallengeDashboard)
def set_video_ideas(
    payload: VideoIdeasIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    state = _get_state(db)
    state.video_ideas = payload.text
    db.commit()
    return _build_dashboard(db, date.today())


@router.post("/completions/{challenge_id}", response_model=ChallengeDashboard)
def complete(
    challenge_id: int,
    payload: CompletionIn | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    if not 1 <= challenge_id <= CHALLENGE_COUNT:
        raise HTTPException(status_code=404, detail="No such challenge")
    completed_at = (payload.completed_at if payload else None) or date.today()
    row = db.execute(
        select(ChallengeCompletion).where(
            ChallengeCompletion.challenge_id == challenge_id
        )
    ).scalar_one_or_none()
    if row is None:
        db.add(ChallengeCompletion(challenge_id=challenge_id, completed_at=completed_at))
    else:
        row.completed_at = completed_at
    db.commit()
    return _build_dashboard(db, date.today())


@router.delete("/completions/{challenge_id}", response_model=ChallengeDashboard)
def uncomplete(
    challenge_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    db.execute(
        delete(ChallengeCompletion).where(
            ChallengeCompletion.challenge_id == challenge_id
        )
    )
    db.commit()
    return _build_dashboard(db, date.today())


@router.post("/reset", response_model=ChallengeDashboard)
def reset(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    """Clear all completions. The calendar stays fixed; order is kept."""
    db.execute(delete(ChallengeCompletion))
    db.commit()
    return _build_dashboard(db, date.today())
