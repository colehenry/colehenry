"""Parse a ``KoboReader.sqlite`` export into unique highlighted terms.

Kobo stores highlights in the ``Bookmark`` table (``Text`` is the highlighted
string, ``VolumeID`` the book path); human-readable book titles live in the
``content`` table. We open the uploaded file read-only, dedupe on the
highlighted text, and hand each highlight back for the shared lexeme resolver
(``services/lexemes.py``) to canonicalize. Stateless — nothing is persisted
here; the router turns approved highlights into cards.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass


@dataclass(frozen=True)
class KoboHighlight:
    text: str
    book: str


def _book_titles(con: sqlite3.Connection) -> dict[str, str]:
    """VolumeID/ContentID → Title, best-effort (schema varies across firmware)."""
    try:
        rows = con.execute(
            "SELECT ContentID, Title FROM content WHERE Title IS NOT NULL"
        ).fetchall()
    except sqlite3.Error:
        return {}
    return {cid: title for cid, title in rows if cid and title}


def parse_highlights(path: str, limit: int = 2000) -> list[KoboHighlight]:
    """Unique, non-empty highlights from a KoboReader.sqlite file (read-only).

    Raises ValueError if the file has no ``Bookmark`` table (i.e. not a Kobo DB).
    """
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        titles = _book_titles(con)
        try:
            rows = con.execute(
                "SELECT Text, VolumeID FROM Bookmark "
                "WHERE Text IS NOT NULL AND TRIM(Text) != '' "
                "ORDER BY DateCreated"
            ).fetchall()
        except sqlite3.Error as exc:
            raise ValueError("Not a Kobo database (no Bookmark table)") from exc
    finally:
        con.close()

    seen: set[str] = set()
    out: list[KoboHighlight] = []
    for text, volume in rows:
        cleaned = " ".join((text or "").split())
        key = cleaned.lower()
        if not cleaned or key in seen:
            continue
        seen.add(key)
        book = titles.get(volume) or (volume or "").rsplit("/", 1)[-1]
        out.append(KoboHighlight(text=cleaned, book=book))
        if len(out) >= limit:
            break
    return out
