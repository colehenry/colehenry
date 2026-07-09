"""Bridge between py-fsrs and the flashcard_reviews table.

py-fsrs owns the math; this module only maps its Card object onto our row.
Our extra "new" state means "never graded" — py-fsrs starts at Learning.
"""

from datetime import datetime, timezone

from fsrs import Card, Rating, Scheduler, State

from app.models import FlashcardReview, ReviewStateName

_scheduler = Scheduler(desired_retention=0.9)

_STATE_TO_DB = {
    State.Learning: ReviewStateName.learning,
    State.Review: ReviewStateName.review,
    State.Relearning: ReviewStateName.relearning,
}
_DB_TO_STATE = {v: k for k, v in _STATE_TO_DB.items()}


def _to_card(review: FlashcardReview) -> Card:
    if review.state == ReviewStateName.new:
        return Card(card_id=review.card_id)
    return Card(
        card_id=review.card_id,
        state=_DB_TO_STATE[review.state],
        step=review.step,
        stability=review.stability,
        difficulty=review.difficulty,
        due=review.due,
        last_review=review.last_review,
    )


def grade(review: FlashcardReview, rating: int, now: datetime | None = None) -> None:
    """Apply an FSRS review (rating 1–4) to the stored state, in place."""
    now = now or datetime.now(timezone.utc)
    was_reviewing = review.state in (ReviewStateName.review, ReviewStateName.relearning)
    card, _ = _scheduler.review_card(_to_card(review), Rating(rating), now)
    review.state = _STATE_TO_DB[card.state]
    review.step = card.step
    review.stability = card.stability
    review.difficulty = card.difficulty
    review.due = card.due
    review.last_review = card.last_review
    review.reps += 1
    if rating == 1 and was_reviewing:
        review.lapses += 1
