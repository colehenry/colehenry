from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import PortableJSONB


class CambioGame(Base):
    __tablename__ = "cambio_games"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[str] = mapped_column(String(12), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)  # vs_human | vs_bot
    config: Mapped[dict] = mapped_column(PortableJSONB, default=dict, nullable=False)
    # Owner user when the room was created while authenticated; guests play
    # under ephemeral names only, so this is the sole durable identity.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    players: Mapped[list["CambioPlayer"]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )
    rounds: Mapped[list["CambioRound"]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )


class CambioPlayer(Base):
    __tablename__ = "cambio_players"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(
        ForeignKey("cambio_games.id", ondelete="CASCADE"), nullable=False
    )
    seat: Mapped[int] = mapped_column(Integer, nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    guest_name: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    game: Mapped[CambioGame] = relationship(back_populates="players")


class CambioRound(Base):
    __tablename__ = "cambio_rounds"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(
        ForeignKey("cambio_games.id", ondelete="CASCADE"), nullable=False
    )
    round_no: Mapped[int] = mapped_column(Integer, nullable=False)
    cambio_caller_seat: Mapped[int | None] = mapped_column(Integer)
    # Per-seat final totals, e.g. [3, 17]; winner seats, e.g. [0].
    scores: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    winner_seats: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    was_caller_penalized: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    game: Mapped[CambioGame] = relationship(back_populates="rounds")


class CambioMove(Base):
    """Full move log — training/analysis gold for tuning the sim heuristics
    against real games later."""

    __tablename__ = "cambio_moves"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(
        ForeignKey("cambio_games.id", ondelete="CASCADE"), nullable=False
    )
    round_no: Mapped[int] = mapped_column(Integer, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    seat: Mapped[int] = mapped_column(Integer, nullable=False)  # -1 = server
    move: Mapped[dict] = mapped_column(PortableJSONB, default=dict, nullable=False)
    # Filled only for snap attempts, so snap accuracy is one GROUP BY away.
    snap_correct: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
