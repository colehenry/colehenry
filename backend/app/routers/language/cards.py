"""Flashcards: CRUD, enrichment, and the shared card serializer."""

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import CardSource, Flashcard, FlashcardDeck, FlashcardReview
from app.routers.language.shared import lang_code, public, router
from app.schemas.language import CardCreate, CardOut, CardUpdate
from app.services import enrich, lexemes


def card_out(card: Flashcard) -> CardOut:
    r = card.review
    return CardOut(
        id=card.id,
        deck_id=card.deck_id,
        card_type=card.card_type,
        direction=card.direction,
        front=card.front,
        back=card.back,
        ipa=card.ipa,
        gender=card.gender,
        part_of_speech=card.part_of_speech,
        audio_url=card.audio_url,
        example=card.example,
        example_translation=card.example_translation,
        cognate_note=card.cognate_note,
        is_false_friend=card.is_false_friend,
        source=card.source,
        source_ref=card.source_ref,
        lexeme_id=card.lexeme_id,
        conjugation_id=card.conjugation_id,
        tags=card.tags,
        created_at=card.created_at,
        state=r.state,
        due=r.due,
        reps=r.reps,
        lapses=r.lapses,
        stability=r.stability,
    )


def assign_card_lexeme(db: Session, card: Flashcard, language: str) -> None:
    target = enrich.target_word(card, language).strip()
    if target and len(target) <= 160 and card.source != CardSource.conjugation:
        card.lexeme = lexemes.maybe_get_or_create(db, language, target)


@public.get("/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(deck_id: int, db: Session = Depends(get_db)):
    if db.get(FlashcardDeck, deck_id) is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    cards = (
        db.execute(
            select(Flashcard)
            .options(selectinload(Flashcard.review))
            .where(Flashcard.deck_id == deck_id)
            .order_by(Flashcard.id.desc())
        )
        .scalars()
        .all()
    )
    return [card_out(c) for c in cards]


@router.post("/cards", response_model=CardOut, status_code=201)
def create_card(body: CardCreate, db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, body.deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    card = Flashcard(
        deck_id=deck.id,
        card_type=body.card_type,
        direction=body.direction,
        front=body.front,
        back=body.back.strip(),
        ipa=body.ipa.strip(),
        gender=body.gender.strip(),
        part_of_speech=body.part_of_speech.strip(),
        example=body.example.strip(),
        example_translation=body.example_translation.strip(),
        cognate_note=body.cognate_note.strip(),
        tags=body.tags,
        source=CardSource.manual,
    )
    if body.enrich:
        enrich.enrich_card(db, card, lang_code(deck.language))
    assign_card_lexeme(db, card, lang_code(deck.language))
    if "wiki" in body.tags and card.lexeme:
        duplicate = next(
            (
                location
                for location in lexemes.card_locations(db, card.lexeme)
                if location["deck_id"] == deck.id
            ),
            None,
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail=f"{card.lexeme.headword} is already in {duplicate['deck_name']}",
            )
    card.review = FlashcardReview()
    db.add(card)
    db.commit()
    db.refresh(card)
    return card_out(card)


@router.patch("/cards/{card_id}", response_model=CardOut)
def update_card(card_id: int, body: CardUpdate, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    data = body.model_dump(exclude_unset=True)
    if "deck_id" in data and data["deck_id"] is not None:
        if db.get(FlashcardDeck, data["deck_id"]) is None:
            raise HTTPException(status_code=404, detail="Target deck not found")
    content_changed = any(k in data for k in ("front", "back", "card_type"))
    for key, value in data.items():
        if value is not None:
            setattr(card, key, value.strip() if isinstance(value, str) else value)
    if content_changed:
        card.audio_url = ""  # regenerate below — the word changed
        enrich.enrich_card(db, card, lang_code(card.deck.language))
        assign_card_lexeme(db, card, lang_code(card.deck.language))
    db.commit()
    db.refresh(card)
    return card_out(card)


@router.post("/cards/{card_id}/enrich", response_model=CardOut)
def reenrich_card(card_id: int, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    card.audio_url = ""
    enrich.enrich_card(db, card, lang_code(card.deck.language))
    assign_card_lexeme(db, card, lang_code(card.deck.language))
    db.commit()
    db.refresh(card)
    return card_out(card)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
