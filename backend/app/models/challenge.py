from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ChallengeCompletion(Base):
    """One row per completed challenge. Unchecking deletes the row.

    The 25 challenge texts live in code (frontend lib/challenges.ts and the
    router's CHALLENGE_IDS bounds) — the DB only stores state.
    """

    __tablename__ = "challenge_completions"

    id: Mapped[int] = mapped_column(primary_key=True)
    challenge_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    completed_at: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ChallengeState(Base):
    """Singleton row (id=1) holding the owner's preferred display order."""

    __tablename__ = "challenge_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    ordering: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    video_ideas: Mapped[str] = mapped_column(Text, default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
