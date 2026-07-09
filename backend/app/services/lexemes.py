"""Canonical vocabulary identity and inflected-form resolution.

Lookup surfaces (Texts, Wiki, future importers) keep the form the learner saw
while linking it to a stable headword used for cards and duplicate detection.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import (
    Flashcard,
    FlashcardDeck,
    LanguageLexeme,
    LexiqueEntry,
)
from app.services import dictionary


INFINITIVE_ENDINGS = {
    "fr": ("er", "ir", "re", "oir"),
    "es": ("ar", "er", "ir"),
}
VERB_POS = {"verb", "VER", "AUX"}


def normalize_headword(value: str) -> str:
    normalized = unicodedata.normalize("NFC", value).strip().casefold()
    return re.sub(r"\s+", " ", normalized)


def get_or_create(db: Session, language: str, headword: str) -> LanguageLexeme:
    language = str(getattr(language, "value", language))
    headword = unicodedata.normalize("NFC", headword).strip().lower()
    normalized = normalize_headword(headword)
    existing = db.execute(
        select(LanguageLexeme).where(
            LanguageLexeme.language == language,
            LanguageLexeme.normalized_headword == normalized,
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    lexeme = LanguageLexeme(
        language=language,
        headword=headword,
        normalized_headword=normalized,
    )
    db.add(lexeme)
    db.flush()
    return lexeme


def maybe_get_or_create(
    db: Session, language: str, headword: str
) -> LanguageLexeme | None:
    if not headword.strip() or len(normalize_headword(headword)) > 160:
        return None
    return get_or_create(db, language, headword)


def _lexique_verb(db: Session, term: str) -> LexiqueEntry | None:
    return db.execute(
        select(LexiqueEntry)
        .where(
            func.lower(LexiqueEntry.word) == term.lower(),
            LexiqueEntry.pos.in_(("VER", "AUX")),
        )
        .order_by(LexiqueEntry.frequency.desc())
        .limit(1)
    ).scalar_one_or_none()


def _simplemma(language: str, term: str) -> str:
    try:
        import simplemma

        return str(simplemma.lemmatize(term, lang=language) or "").strip().lower()
    except (ImportError, KeyError, ValueError, TypeError):
        return ""


def _looks_infinitive(language: str, value: str) -> bool:
    endings = INFINITIVE_ENDINGS.get(language, ())
    return bool(value and endings and value.endswith(endings))


@dataclass(frozen=True)
class Resolution:
    surface_form: str
    headword: str
    is_verb: bool
    is_inflected: bool
    form_note: str
    provider: str
    lookup: dict | None


def resolve(
    db: Session,
    language: str,
    term: str,
    found: dict | None = None,
    hinted_lemma: str = "",
) -> Resolution:
    """Resolve a single conjugated verb to an infinitive when confident."""
    language = str(getattr(language, "value", language))
    surface = unicodedata.normalize("NFC", term).strip().lower()
    found = found if found is not None else dictionary.lookup(language, surface)
    if not surface or " " in surface:
        return Resolution(surface, surface, False, False, "", "surface", found)

    lexique = _lexique_verb(db, surface) if language == "fr" else None
    is_verb = bool(
        lexique
        or (found and str(found.get("part_of_speech", "")).lower() == "verb")
    )
    if not is_verb:
        return Resolution(surface, surface, False, False, "", "surface", found)

    candidates: list[tuple[str, str]] = []
    if lexique and lexique.lemma:
        candidates.append((lexique.lemma.strip().lower(), "lexique"))
    if hinted_lemma:
        candidates.append((hinted_lemma.strip().lower(), "provider"))
    lemma = _simplemma(language, surface)
    if lemma:
        candidates.append((lemma, "simplemma"))

    headword = surface
    provider = "surface"
    for candidate, source in candidates:
        if (
            candidate
            and candidate != surface
            and _looks_infinitive(language, candidate)
        ):
            headword = candidate
            provider = source
            break

    if headword == surface:
        return Resolution(surface, surface, True, False, "", provider, found)

    canonical = dictionary.lookup(language, headword) or found
    return Resolution(
        surface_form=surface,
        headword=headword,
        is_verb=True,
        is_inflected=True,
        form_note=(found or {}).get("translation", ""),
        provider=provider,
        lookup=canonical,
    )


def card_locations(db: Session, lexeme: LanguageLexeme) -> list[dict]:
    """Cards already representing this lexeme, grouped by their actual deck."""
    rows = db.execute(
        select(Flashcard.id, FlashcardDeck.id, FlashcardDeck.name)
        .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
        .where(
            FlashcardDeck.language == lexeme.language,
            or_(
                Flashcard.lexeme_id == lexeme.id,
                func.lower(func.trim(Flashcard.front)) == lexeme.normalized_headword,
            ),
        )
        .order_by(FlashcardDeck.name, Flashcard.id)
    ).all()
    return [
        {"card_id": card_id, "deck_id": deck_id, "deck_name": deck_name}
        for card_id, deck_id, deck_name in rows
    ]
