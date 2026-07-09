"""Seed lexique_entries from Lexique 3.83 — offline French gender + frequency.

Lexique (http://www.lexique.org) is a free French lexical database (~142k
inflected forms) with lemma, part of speech, grammatical gender, and corpus
frequency. The wiki and text-lookup use it as a gender fallback and for the
"how common is this word" signal.

Run locally from /backend (downloads ~40 MB once):

    source .venv/bin/activate
    python scripts/seed_lexique.py

Idempotent: skips when the table is already populated; --force reloads.
"""

import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402
from sqlalchemy import delete, func, select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import LexiqueEntry  # noqa: E402

LEXIQUE_URL = "http://www.lexique.org/databases/Lexique383/Lexique383.tsv"
BATCH = 5000

# cgram values worth keeping — content words the wiki actually looks up.
KEEP_POS = {"NOM", "VER", "ADJ", "ADV", "AUX", "ONO"}


def main(force: bool = False) -> None:
    db = SessionLocal()
    try:
        existing = db.execute(select(func.count(LexiqueEntry.id))).scalar_one()
        if existing and not force:
            print(f"lexique_entries already has {existing} rows — use --force to reload")
            return
        if existing:
            db.execute(delete(LexiqueEntry))
            db.commit()

        print("downloading Lexique383.tsv …")
        res = httpx.get(LEXIQUE_URL, timeout=120, follow_redirects=True)
        res.raise_for_status()

        reader = csv.DictReader(io.StringIO(res.text), delimiter="\t")
        pending: list[LexiqueEntry] = []
        total = 0
        for row in reader:
            word = (row.get("ortho") or "").strip()
            pos = (row.get("cgram") or "").strip()
            if not word or len(word) > 120 or pos not in KEEP_POS:
                continue
            try:
                frequency = float(row.get("freqfilms2") or 0)
            except ValueError:
                frequency = 0.0
            pending.append(
                LexiqueEntry(
                    word=word,
                    lemma=(row.get("lemme") or "").strip()[:120],
                    pos=pos,
                    gender=(row.get("genre") or "").strip()[:4],
                    frequency=frequency,
                )
            )
            if len(pending) >= BATCH:
                db.add_all(pending)
                db.commit()
                total += len(pending)
                print(f"  {total} rows…")
                pending = []
        if pending:
            db.add_all(pending)
            db.commit()
            total += len(pending)
        print(f"lexique seeded: {total} rows")
    finally:
        db.close()


if __name__ == "__main__":
    main(force="--force" in sys.argv)
