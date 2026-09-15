"""/language/tutor — the embedded French tutor: threads + streaming messages (SSE)."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import LearningTutorMessage, LearningTutorThread
from app.routers.language.shared import router
from app.schemas.learning import TutorMessageIn, TutorMessageOut, TutorThreadDetail, TutorThreadIn, TutorThreadOut
from app.services.learning import tutor

PREFIX = "/tutor"
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.get(f"{PREFIX}/status")
def status():
    return {"available": tutor.available(), "models": tutor.model_chain()}


@router.get(f"{PREFIX}/threads", response_model=list[TutorThreadOut])
def list_threads(limit: int = Query(30, ge=1, le=200), surface: str | None = None, db: Session = Depends(get_db)):
    q = select(LearningTutorThread).order_by(LearningTutorThread.updated_at.desc())
    rows = db.execute(q.limit(limit if not surface else 200)).scalars().all()
    if surface:
        rows = [r for r in rows if (r.focus or {}).get("surface") == surface][:limit]
    return rows


@router.post(f"{PREFIX}/threads", response_model=TutorThreadOut, status_code=201)
def create_thread(body: TutorThreadIn, db: Session = Depends(get_db)):
    row = LearningTutorThread(title=body.title.strip()[:160], focus=body.focus or {})
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get(f"{PREFIX}/threads/{{thread_id}}", response_model=TutorThreadDetail)
def get_thread(thread_id: int, db: Session = Depends(get_db)):
    row = db.get(LearningTutorThread, thread_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    msgs = db.execute(
        select(LearningTutorMessage).where(LearningTutorMessage.thread_id == row.id).order_by(LearningTutorMessage.id)
    ).scalars().all()
    return TutorThreadDetail(id=row.id, title=row.title, focus=row.focus, created_at=row.created_at, updated_at=row.updated_at,
                             messages=[TutorMessageOut.model_validate(m) for m in msgs])


@router.delete(f"{PREFIX}/threads/{{thread_id}}", status_code=204)
def delete_thread(thread_id: int, db: Session = Depends(get_db)):
    row = db.get(LearningTutorThread, thread_id)
    if row is not None:
        db.delete(row)
        db.commit()


@router.post(f"{PREFIX}/threads/{{thread_id}}/messages")
def post_message(thread_id: int, body: TutorMessageIn):
    """Streams SSE: token · reset · tool · error · done ({model, content, dropped})."""
    return StreamingResponse(tutor.converse(thread_id, body.content.strip(), body.focus, body.lang), media_type="text/event-stream", headers=SSE_HEADERS)
