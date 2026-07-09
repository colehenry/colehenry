"""EN→FR/ES translation for wiki definitions, via MyMemory.

MyMemory (https://mymemory.translated.net) is free and keyless with a daily
character quota — plenty for dictionary glosses, since every translation is
cached in translation_cache and only ever fetched once. On any failure the
caller gets "" and the UI falls back to the English definition.
"""

import hashlib
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TranslationCache

log = logging.getLogger(__name__)

URL = "https://api.mymemory.translated.net/get"
TARGETS = {"fr", "es"}


def translate(db: Session, text: str, target: str) -> str:
    """Translate English `text` to `target` ("fr"/"es"); "" on failure.

    Adds a cache row to the session on success — the caller commits.
    """
    return translate_pair(db, text, "en", target)


def translate_pair(
    db: Session, text: str, source_language: str, target: str
) -> str:
    """Translate between supported languages, using the same durable cache."""
    text = text.strip()
    if not text or not source_language or not target or source_language == target:
        return ""

    digest = hashlib.sha1(
        f"{source_language}:{target}:{text}".encode()
    ).hexdigest()[:40]
    cached = db.execute(
        select(TranslationCache).where(TranslationCache.digest == digest)
    ).scalar_one_or_none()
    if cached:
        return cached.translated

    try:
        res = httpx.get(
            URL,
            params={"q": text, "langpair": f"{source_language}|{target}"},
            timeout=8,
        )
        res.raise_for_status()
        translated = (res.json().get("responseData") or {}).get(
            "translatedText"
        ) or ""
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("mymemory translation failed: %s", exc)
        return ""

    translated = translated.strip()
    # MyMemory sometimes echoes quota errors as the "translation".
    if not translated or "MYMEMORY WARNING" in translated.upper():
        return ""

    db.add(
        TranslationCache(
            digest=digest, target_lang=target, source=text, translated=translated
        )
    )
    return translated
