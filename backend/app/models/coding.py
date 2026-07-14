from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import PortableJSONB


class CodingDevice(Base):
    """A locally-running coding agent paired to the owner account."""

    __tablename__ = "coding_devices"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    capabilities: Mapped[dict] = mapped_column(PortableJSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tasks: Mapped[list["CodingTask"]] = relationship(back_populates="device")


class CodingPairingCode(Base):
    """Short-lived, one-time code used to pair a local agent."""

    __tablename__ = "coding_pairing_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code_hash: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CodingTask(Base):
    """One durable coding-agent conversation and execution context."""

    __tablename__ = "coding_tasks"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    device_id: Mapped[str] = mapped_column(
        ForeignKey("coding_devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    workspace_id: Mapped[str] = mapped_column(Text, nullable=False)
    workspace_name: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    branch: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="queued")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    device: Mapped["CodingDevice"] = relationship(back_populates="tasks")
    events: Mapped[list["CodingEvent"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="CodingEvent.seq",
    )


class CodingEvent(Base):
    """Append-only task event used for replay, multi-window sync, and audit."""

    __tablename__ = "coding_events"
    __table_args__ = (UniqueConstraint("task_id", "seq", name="uq_coding_events_task_seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[str] = mapped_column(
        ForeignKey("coding_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(PortableJSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    task: Mapped["CodingTask"] = relationship(back_populates="events")
