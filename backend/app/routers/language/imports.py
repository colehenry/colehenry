"""Bulk import — paste a word list, or upload a Kobo highlight database."""

import tempfile

from fastapi import Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    CardDirection,
    CardType,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
)
from app.routers.language.cards import assign_card_lexeme
from app.routers.language.shared import lang_code, router
from app.routers.language.texts import lookup_annotation_text
from app.schemas.language import (
    ImportCommitIn,
    ImportCommitOut,
    ImportItem,
    ImportPreviewOut,
    PasteImportIn,
    TextLookupOut,
)
from app.services import enrich, kobo, lexemes


def _import_item(lookup: TextLookupOut, term: str, book: str = "") -> ImportItem:
    return ImportItem(
        selected_text=term,
        book=book,
        front=lookup.headword or term,
        back=lookup.translation,
        ipa=lookup.ipa,
        gender=lookup.gender,
        part_of_speech=lookup.part_of_speech,
        cognate_note=lookup.cognate_note,
        is_false_friend=lookup.is_false_friend,
        is_inflected=lookup.is_inflected,
        form_note=lookup.form_note,
        lexeme_id=lookup.lexeme_id,
        existing_decks=sorted({loc.deck_name for loc in lookup.existing_cards}),
    )


def _split_terms(text: str, limit: int = 500) -> list[str]:
    """Newline- or comma-separated list → unique, trimmed terms (order kept)."""
    seen: set[str] = set()
    terms: list[str] = []
    for chunk in text.replace(",", "\n").splitlines():
        term = " ".join(chunk.split())
        key = term.lower()
        if term and key not in seen:
            seen.add(key)
            terms.append(term)
        if len(terms) >= limit:
            break
    return terms


@router.post("/import/kobo", response_model=ImportPreviewOut)
async def kobo_preview(
    language: Language = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Parse an uploaded KoboReader.sqlite into resolved, deduped card drafts.

    Read-only: nothing is written except the shared lexeme / dictionary caches
    the resolver already populates. The client approves a subset and posts it
    back to /import/commit.
    """
    data = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".sqlite") as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            highlights = kobo.parse_highlights(tmp.name)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    items = [
        _import_item(lookup_annotation_text(db, language, hl.text), hl.text, hl.book)
        for hl in highlights
    ]
    return ImportPreviewOut(
        language=language, total_highlights=len(highlights), items=items
    )


@router.post("/import/paste", response_model=ImportPreviewOut)
def paste_preview(body: PasteImportIn, db: Session = Depends(get_db)):
    """Resolve a pasted word/phrase list into deduped card drafts (loop lookup).

    Each newline/comma-separated entry is one term; single words resolve via the
    dictionary, multi-word phrases fall to the LLM. Same review→/import/commit
    flow as the Kobo importer.
    """
    terms = _split_terms(body.text)
    items = [
        _import_item(lookup_annotation_text(db, body.language, term), term)
        for term in terms
    ]
    return ImportPreviewOut(
        language=body.language, total_highlights=len(terms), items=items
    )


@router.post("/import/commit", response_model=ImportCommitOut)
def import_commit(body: ImportCommitIn, db: Session = Depends(get_db)):
    """Bulk-create the approved terms as cards, skipping deck duplicates."""
    deck = db.get(FlashcardDeck, body.deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    language = lang_code(deck.language)
    created = skipped = 0
    for draft in body.cards:
        card = Flashcard(
            deck_id=deck.id,
            card_type=CardType.basic,
            direction=CardDirection.recognition,
            front=draft.front.strip(),
            back=draft.back.strip(),
            ipa=draft.ipa.strip(),
            gender=draft.gender.strip(),
            part_of_speech=draft.part_of_speech.strip(),
            cognate_note=draft.cognate_note.strip(),
            is_false_friend=draft.is_false_friend,
            tags=[body.source.value],
            source=body.source,
            source_ref=draft.source_ref.strip()[:100],
        )
        enrich.enrich_card(db, card, language)
        assign_card_lexeme(db, card, language)
        if card.lexeme and any(
            loc["deck_id"] == deck.id
            for loc in lexemes.card_locations(db, card.lexeme)
        ):
            skipped += 1
            continue
        card.review = FlashcardReview()
        db.add(card)
        created += 1
    db.commit()
    return ImportCommitOut(created=created, skipped=skipped)
