"""Curriculum → database sync (idempotent).

Upserts every curated vocab item into `learning_vocab` (descriptive fields
refresh; the learner's own `status` is preserved) and materializes FSRS
cards for it in one system deck per sprint: recognition (FR → ES) for every
item, plus production (ES → FR) for Core items. Cards link back through
`source_ref = "vocab:<row id>"`, which is how SRS grades feed mastery.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.curriculum.vocab import VOCAB, VocabItem
from app.models import (
    CardDirection,
    CardSource,
    CardType,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
    LearningVocab,
)
from app.services.learning.mastery import get_state

DECK_NAMES = {1: "FR · Sprint 1 · Foundation", 2: "FR · Sprint 2 · Generate", 3: "FR · Sprint 3 · Past & speech", 4: "FR · Sprint 4 · Consolidate"}
MINED_DECK = "FR · Mined from texts"


def sprint_deck(db: Session, sprint: int) -> FlashcardDeck:
    name = DECK_NAMES[sprint]
    deck = db.execute(select(FlashcardDeck).where(FlashcardDeck.name == name)).scalar_one_or_none()
    if deck is None:
        deck = FlashcardDeck(name=name, language=Language.fr, description=f"Month 1 curriculum · sprint {sprint} Core + Recognition items.",
                             tags=["curriculum", f"sprint{sprint}"], is_system=True)
        db.add(deck)
        db.flush()
    return deck


def mined_deck(db: Session) -> FlashcardDeck:
    deck = db.execute(select(FlashcardDeck).where(FlashcardDeck.name == MINED_DECK)).scalar_one_or_none()
    if deck is None:
        deck = FlashcardDeck(name=MINED_DECK, language=Language.fr, description="Encountered words promoted from Texts.",
                             tags=["mined"], is_system=True)
        db.add(deck)
        db.flush()
    return deck


def upsert_vocab(db: Session, item: VocabItem) -> LearningVocab:
    row = db.execute(select(LearningVocab).where(LearningVocab.curriculum_id == item.id)).scalar_one_or_none()
    fields = dict(
        french=item.french, spanish=item.spanish, english=item.english, part_of_speech=item.part_of_speech, gender=item.gender,
        ipa=item.ipa, sprint=item.sprint, priority=item.priority, frequency_band=item.frequency_band, example_fr=item.example_fr,
        example_es=item.example_es, pattern=item.pattern, spanish_connection=item.spanish_connection,
        pronunciation_warning=item.pronunciation_warning, cognate_type=item.cognate_type, false_friend=item.false_friend,
        reference_links=list(item.reference_links), tags=list(item.tags), source="curriculum",
    )
    if row is None:
        row = LearningVocab(curriculum_id=item.id, status=item.status, **fields)
        db.add(row)
        db.flush()
    else:
        for k, v in fields.items():
            setattr(row, k, v)
    return row


def _card_fields(row: LearningVocab, direction: CardDirection) -> dict:
    back_es = row.spanish + (f" · {row.english}" if row.english else "")
    if direction == CardDirection.recognition:
        front, back = row.french, back_es
    else:
        front, back = row.spanish, row.french
    return dict(
        front=front, back=back, ipa=row.ipa, gender=row.gender, part_of_speech=row.part_of_speech, example=row.example_fr,
        example_translation=row.example_es, cognate_note=row.spanish_connection or row.pronunciation_warning,
        is_false_friend=row.false_friend, tags=[f"sprint{row.sprint}", row.status, *[t for t in row.tags if t not in ("month1",)]][:8],
    )


def ensure_cards(db: Session, row: LearningVocab, deck: FlashcardDeck, *, production: bool) -> int:
    ref = f"vocab:{row.id}"
    existing = {
        c.direction: c
        for c in db.execute(select(Flashcard).where(Flashcard.source_ref == ref, Flashcard.source == CardSource.system)).scalars().all()
    }
    created = 0
    wanted = [CardDirection.recognition] + ([CardDirection.production] if production else [])
    for direction in wanted:
        fields = _card_fields(row, direction)
        card = existing.get(direction)
        if card is None:
            card = Flashcard(deck_id=deck.id, card_type=CardType.basic, direction=direction, source=CardSource.system, source_ref=ref, **fields)
            card.review = FlashcardReview()
            db.add(card)
            created += 1
        else:
            for k, v in fields.items():
                if k in ("front", "back") and getattr(card, k) != v and card.review is not None and card.review.reps > 0:
                    continue  # don't rewrite a card the learner is already reviewing
                setattr(card, k, v)
    return created


def sync_curriculum(db: Session) -> dict:
    get_state(db)
    created_cards = 0
    for item in VOCAB:
        row = upsert_vocab(db, item)
        deck = sprint_deck(db, item.sprint)
        created_cards += ensure_cards(db, row, deck, production=row.status == "core")
    db.commit()
    total = db.execute(select(LearningVocab).where(LearningVocab.source == "curriculum")).scalars().all()
    return {"vocab": len(total), "cards_created": created_cards}


def add_encountered(db: Session, *, french: str, spanish: str = "", english: str = "", part_of_speech: str = "", gender: str = "",
                    ipa: str = "", example_fr: str = "", example_es: str = "", text_id: int | None = None, lexeme_id: int | None = None,
                    sprint: int = 1, status: str = "encountered") -> LearningVocab:
    """Capture a word from a text as Encountered (no cards until promoted)."""
    existing = None
    if lexeme_id:
        existing = db.execute(select(LearningVocab).where(LearningVocab.lexeme_id == lexeme_id)).scalar_one_or_none()
    if existing is None:
        existing = db.execute(select(LearningVocab).where(LearningVocab.french == french.strip(), LearningVocab.source != "curriculum")).scalar_one_or_none()
    if existing:
        return existing
    row = LearningVocab(
        curriculum_id=None, french=french.strip(), spanish=spanish.strip(), english=english.strip(), part_of_speech=part_of_speech,
        gender=gender, ipa=ipa, sprint=sprint, priority=3, status=status, source="text", text_id=text_id, lexeme_id=lexeme_id,
        example_fr=example_fr, example_es=example_es, tags=["encountered"],
    )
    db.add(row)
    db.flush()
    if status != "encountered":
        ensure_cards(db, row, mined_deck(db), production=status == "core")
    db.commit()
    return row


def set_status(db: Session, row: LearningVocab, status: str) -> None:
    row.status = status
    if status == "encountered":
        db.commit()
        return
    deck = sprint_deck(db, row.sprint) if row.source == "curriculum" else mined_deck(db)
    ensure_cards(db, row, deck, production=status == "core")
    db.commit()


def import_items(db: Session, items: list[dict]) -> dict:
    """Bulk structured import (JSON) — same shape as the curriculum item."""
    created = updated = cards = 0
    for raw in items:
        cid = raw.get("id") or None
        french = (raw.get("french") or "").strip()
        if not french:
            continue
        row = None
        if cid:
            row = db.execute(select(LearningVocab).where(LearningVocab.curriculum_id == cid)).scalar_one_or_none()
        if row is None:
            row = db.execute(select(LearningVocab).where(LearningVocab.french == french)).scalar_one_or_none()
        fields = dict(
            french=french, spanish=raw.get("spanish", "") or "", english=raw.get("english", "") or "", part_of_speech=raw.get("part_of_speech", "") or "",
            gender=raw.get("gender") or "", ipa=raw.get("ipa", "") or "", sprint=int(raw.get("sprint") or 1), priority=int(raw.get("priority") or 2),
            frequency_band=raw.get("frequency_band", "") or "", example_fr=raw.get("example_fr", "") or "", example_es=raw.get("example_es", "") or "",
            pattern=raw.get("pattern", "") or "", spanish_connection=raw.get("spanish_connection", "") or "",
            pronunciation_warning=raw.get("pronunciation_warning") or "", cognate_type=raw.get("cognate_type", "none") or "none",
            false_friend=bool(raw.get("false_friend", False)), reference_links=list(raw.get("reference_links") or []),
            tags=list(raw.get("tags") or []),
        )
        status = raw.get("status") or "core"
        if row is None:
            row = LearningVocab(curriculum_id=cid, status=status, source="import", **fields)
            db.add(row)
            db.flush()
            created += 1
        else:
            for k, v in fields.items():
                setattr(row, k, v)
            row.status = status
            updated += 1
        deck = sprint_deck(db, row.sprint)
        cards += ensure_cards(db, row, deck, production=row.status == "core")
    db.commit()
    return {"created": created, "updated": updated, "cards_created": cards}
