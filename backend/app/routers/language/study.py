"""Study queue and FSRS review grading."""

from datetime import timedelta
from typing import Literal

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import (
    Conjugation,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
    ReviewLog,
    ReviewLog,
    ReviewStateName,
    VerbSetMember,
)
from app.routers.language.cards import card_out
from app.routers.language.shared import now_utc, public, router
from app.schemas.language import ReviewIn, ReviewOut, StudyQueue
from app.services.fsrs_engine import grade
from app.services.learning.mastery import on_card_review


@public.get("/study/queue", response_model=StudyQueue)
def study_queue(
    deck_id: int | None = None,
    verb_set_id: int | None = None,
    language: Language | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    new_limit: int = Query(default=10, ge=0, le=50),
    mode: Literal["mixed", "review", "learn"] = "mixed",
    db: Session = Depends(get_db),
):
    """Serve due reviews or eligible new cards without adjacent siblings."""
    now = now_utc()

    def card_query():
        query = (
            select(Flashcard)
            .options(selectinload(Flashcard.review))
            .select_from(Flashcard)
            .join(FlashcardReview, FlashcardReview.card_id == Flashcard.id)
        )
        if deck_id is not None:
            query = query.where(Flashcard.deck_id == deck_id)
        if language is not None:
            query = query.join(
                FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id
            ).where(FlashcardDeck.language == language)
        if verb_set_id is not None:
            query = (
                query.join(
                    Conjugation, Conjugation.id == Flashcard.conjugation_id
                )
                .join(VerbSetMember, VerbSetMember.verb_id == Conjugation.verb_id)
                .where(VerbSetMember.set_id == verb_set_id)
            )
        return query

    def count_query():
        query = (
            select(func.count(FlashcardReview.id))
            .select_from(FlashcardReview)
            .join(Flashcard, Flashcard.id == FlashcardReview.card_id)
        )
        if deck_id is not None:
            query = query.where(Flashcard.deck_id == deck_id)
        if language is not None:
            query = query.join(
                FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id
            ).where(FlashcardDeck.language == language)
        if verb_set_id is not None:
            query = (
                query.join(
                    Conjugation, Conjugation.id == Flashcard.conjugation_id
                )
                .join(VerbSetMember, VerbSetMember.verb_id == Conjugation.verb_id)
                .where(VerbSetMember.set_id == verb_set_id)
            )
        return query

    due_rows = [] if mode == "learn" else (
        db.execute(
            card_query()
            .where(FlashcardReview.state != ReviewStateName.new)
            .where(FlashcardReview.due <= now)
            .order_by(FlashcardReview.due)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    # A Core word has recognition and production siblings. Production stays
    # buried until recognition has been reviewed at least once, which prevents
    # an immediate reverse-card echo on first exposure.
    learned_recognition_refs = set(
        db.execute(
            select(Flashcard.source_ref)
            .join(ReviewLog, ReviewLog.card_id == Flashcard.id)
            .where(
                Flashcard.direction == "recognition",
                ReviewLog.rating >= 3,
                Flashcard.source_ref != "",
            )
            .distinct()
        ).scalars().all()
    )
    new_candidates = [] if mode == "review" else (
        db.execute(
            card_query()
            .where(FlashcardReview.state == ReviewStateName.new)
            .order_by(Flashcard.id)
        )
        .scalars()
        .all()
    )
    new_rows = [
        card for card in new_candidates
        if card.direction != "production" or not card.source_ref or card.source_ref in learned_recognition_refs
    ][:new_limit]

    def space_siblings(cards: list[Flashcard], gap: int = 10) -> list[Flashcard]:
        pending = list(cards)
        ordered: list[Flashcard] = []
        while pending:
            recent_refs = {card.source_ref for card in ordered[-gap:] if card.source_ref}
            index = next((i for i, card in enumerate(pending) if not card.source_ref or card.source_ref not in recent_refs), 0)
            ordered.append(pending.pop(index))
        return ordered

    due_rows = space_siblings(due_rows)
    new_rows = space_siblings(new_rows)
    due_count = count_query().where(
        FlashcardReview.state != ReviewStateName.new, FlashcardReview.due <= now
    )
    new_count = count_query().where(
        FlashcardReview.state == ReviewStateName.new
    )
    return StudyQueue(
        cards=[card_out(c) for c in [*due_rows, *new_rows]],
        due_count=db.execute(due_count).scalar_one(),
        new_count=db.execute(new_count).scalar_one(),
    )


@router.post("/study/review", response_model=ReviewOut)
def review_card(body: ReviewIn, db: Session = Depends(get_db)):
    card = db.get(Flashcard, body.card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    review = card.review
    state_before = review.state
    now = now_utc()
    grade(review, body.rating, now)
    on_card_review(db, card, body.rating)  # curriculum cards feed vocab mastery
    db.add(
        ReviewLog(
            card_id=card.id,
            language=card.deck.language,
            rating=body.rating,
            state=state_before,
            reviewed_at=now,
        )
    )
    db.commit()
    return ReviewOut(
        card_id=card.id,
        state=review.state,
        due=review.due,
        again_soon=review.due - now < timedelta(minutes=20),
    )
