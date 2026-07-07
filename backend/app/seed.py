"""Seed the owner user and the lapwise project.

Run after migrations: `python -m app.seed`
Idempotent — safe to run more than once.
"""

from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models import Project, User, Visibility

LAPWISE = dict(
    slug="lapwise",
    title="lapwise.dev",
    summary="Full-stack F1 analytics — 76 seasons of race and telemetry data, interactive visualizations, an AI analyst chatbot, and a discussion forum.",
    description_md=(
        "Full-stack analytics platform built with Next.js, React, FastAPI, and "
        "PostgreSQL, modeling 76 seasons of Formula 1 race and telemetry data with "
        "interactive visualizations, an AI analyst chatbot, and a discussion forum. "
        "Backend APIs and data models support scalable historical analytics queries."
    ),
    tech=["Next.js", "FastAPI", "PostgreSQL", "TypeScript", "Python"],
    live_url="https://lapwise.dev",
    embed_url="https://lapwise.dev",
    sort_order=0,
    featured=True,
    visibility=Visibility.public,
)


def seed() -> None:
    settings = get_settings()
    with SessionLocal() as db:
        owner = db.execute(
            select(User).where(User.email == settings.owner_email.lower())
        ).scalar_one_or_none()
        if owner is None:
            db.add(User(email=settings.owner_email.lower()))
            print(f"created owner user {settings.owner_email}")

        project = db.execute(
            select(Project).where(Project.slug == LAPWISE["slug"])
        ).scalar_one_or_none()
        if project is None:
            db.add(Project(**LAPWISE))
            print("created project lapwise")

        db.commit()
    print("seed complete")


if __name__ == "__main__":
    seed()
