"""Routers and cross-section helpers shared by the /language submodules."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import require_owner
from app.models import Language, LexiqueEntry

# Owner-only by default — one dependency gates every route, so anything new
# is private unless deliberately moved to `public` below.
router = APIRouter(
    prefix="/language", tags=["language"], dependencies=[Depends(require_owner)]
)

# Pure reads exposed for the public read-only showcase (/quenoseteolvide/
# showcase). Nothing here may write, call an LLM, or trigger TTS.
public = APIRouter(prefix="/language", tags=["language"])


PERSON_LABELS = {
    "1s": "je",
    "2s": "tu",
    "3s": "il/elle",
    "1p": "nous",
    "2p": "vous",
    "3p": "ils/elles",
}

PERSON_LABELS_ES = {
    "1s": "yo",
    "2s": "tú",
    "3s": "él/ella",
    "1p": "nosotros",
    "2p": "vosotros",
    "3p": "ellos/ellas",
}

WIKI_STRIP = ".,;:!?¡¿()[]{}\"'“”‘’«» "

INFINITIVE_ENDINGS = {
    Language.fr: ("er", "ir", "re", "oir"),
    Language.es: ("ar", "er", "ir"),
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def lang_code(value: str | Language) -> str:
    return str(getattr(value, "value", value))


def lexique_row(db: Session, word: str) -> LexiqueEntry | None:
    return db.execute(
        select(LexiqueEntry)
        .where(func.lower(LexiqueEntry.word) == word.lower())
        .order_by(LexiqueEntry.frequency.desc())
        .limit(1)
    ).scalar_one_or_none()


def lexique_gender(db: Session, language: Language, word: str) -> str:
    """Offline gender fallback (French only — Lexique is a French database)."""
    if language != Language.fr:
        return ""
    row = lexique_row(db, word)
    return row.gender if row else ""
