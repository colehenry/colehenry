from datetime import datetime

from sqlalchemy import ARRAY, DateTime, Enum, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.project import Visibility


class Recipe(Base):
    """One recipe card.

    `ingredients` and `steps` are jsonb (see schemas/recipe.py for the
    shapes). Steps reference ingredients by `{key}` tokens, which the
    frontend expands to "amount + name" — so an ingredient can never be
    mentioned without its amount.

    `language` is the language the recipe was written in; `translations`
    holds LLM-generated versions keyed by locale ({"es": {...}}), produced
    in the background on save. Missing translation → the UI falls back to
    the source language.
    """

    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    rating: Mapped[float] = mapped_column(
        Numeric(3, 1), default=0, nullable=False
    )  # 0–5, half steps
    ingredients: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    steps: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    photo_urls: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    servings: Mapped[int | None] = mapped_column(Integer)
    cook_minutes: Mapped[int | None] = mapped_column(Integer)
    source_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    source_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    language: Mapped[str] = mapped_column(String(5), default="en", nullable=False)
    translations: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    visibility: Mapped[Visibility] = mapped_column(
        Enum(Visibility, name="visibility"), default=Visibility.public, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
