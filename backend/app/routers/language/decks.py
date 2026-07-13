"""Flashcard decks: CRUD plus per-deck due/new counts."""

from fastapi import Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Flashcard, FlashcardDeck, FlashcardReview, ReviewStateName
from app.routers.language.shared import now_utc, public, router
from app.schemas.language import DeckCreate, DeckOut, DeckUpdate


def deck_counts(db: Session) -> dict[int, dict[str, int]]:
    now = now_utc()
    rows = db.execute(
        select(
            Flashcard.deck_id,
            func.count(Flashcard.id),
            func.count(Flashcard.id).filter(
                FlashcardReview.state != ReviewStateName.new, FlashcardReview.due <= now
            ),
            func.count(Flashcard.id).filter(
                FlashcardReview.state == ReviewStateName.new
            ),
        )
        .join(FlashcardReview, FlashcardReview.card_id == Flashcard.id)
        .group_by(Flashcard.deck_id)
    ).all()
    return {
        deck_id: {"card_count": total, "due_count": due, "new_count": new}
        for deck_id, total, due, new in rows
    }


def deck_out(deck: FlashcardDeck, counts: dict[int, dict[str, int]]) -> DeckOut:
    c = counts.get(deck.id, {"card_count": 0, "due_count": 0, "new_count": 0})
    return DeckOut(
        id=deck.id,
        name=deck.name,
        language=deck.language,
        description=deck.description,
        tags=deck.tags,
        is_system=deck.is_system,
        created_at=deck.created_at,
        **c,
    )


def _list_decks(db: Session) -> list[DeckOut]:
    decks = (
        db.execute(select(FlashcardDeck).order_by(FlashcardDeck.is_system, FlashcardDeck.id))
        .scalars()
        .all()
    )
    counts = deck_counts(db)
    return [deck_out(d, counts) for d in decks]


@public.get("/decks", response_model=list[DeckOut])
def list_decks(db: Session = Depends(get_db)):
    return _list_decks(db)


@router.post("/decks", response_model=DeckOut, status_code=201)
def create_deck(body: DeckCreate, db: Session = Depends(get_db)):
    deck = FlashcardDeck(
        name=body.name,
        language=body.language,
        description=body.description.strip(),
        tags=body.tags,
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck_out(deck, {})


@router.patch("/decks/{deck_id}", response_model=DeckOut)
def update_deck(deck_id: int, body: DeckUpdate, db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        deck.name = data["name"].strip()
    if "description" in data and data["description"] is not None:
        deck.description = data["description"].strip()
    if "tags" in data and data["tags"] is not None:
        deck.tags = data["tags"]
    db.commit()
    db.refresh(deck)
    return deck_out(deck, deck_counts(db))


@router.delete("/decks/{deck_id}", status_code=204)
def delete_deck(deck_id: int, db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.delete(deck)
    db.commit()
