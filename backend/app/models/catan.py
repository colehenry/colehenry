from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CatanPlayer(Base):
    __tablename__ = "catan_players"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Only these players count toward leaderboard/aggregate stats. Guests
    # (one-off players) still appear inside individual game summaries.
    show_in_dashboard: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    results: Mapped[list["CatanResult"]] = relationship(back_populates="player")


class CatanGame(Base):
    __tablename__ = "catan_games"

    id: Mapped[int] = mapped_column(primary_key=True)
    played_at: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    results: Mapped[list["CatanResult"]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )


class CatanResult(Base):
    __tablename__ = "catan_results"
    __table_args__ = (UniqueConstraint("game_id", "player_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(
        ForeignKey("catan_games.id", ondelete="CASCADE"), nullable=False
    )
    player_id: Mapped[int] = mapped_column(
        ForeignKey("catan_players.id"), nullable=False
    )
    starting_pips: Mapped[int | None] = mapped_column(Integer)
    victory_points: Mapped[int | None] = mapped_column(Integer)
    largest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    longest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    won: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    game: Mapped[CatanGame] = relationship(back_populates="results")
    player: Mapped[CatanPlayer] = relationship(back_populates="results")
