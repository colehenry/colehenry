"""Sync the curated Month-1 French curriculum into Postgres (idempotent).

    python -m app.seed_french

Upserts learning_vocab rows and materializes FSRS cards in the per-sprint
system decks. Safe to re-run after editing app/curriculum/*.
"""

from app.db import SessionLocal
from app.services.learning.sync import sync_curriculum


def seed() -> None:
    db = SessionLocal()
    try:
        out = sync_curriculum(db)
        print(f"french curriculum synced: {out}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
