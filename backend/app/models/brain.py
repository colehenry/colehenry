from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import PortableJSONB


class BrainNote(Base):
    """One row per markdown file in the vault repo.

    Git is the source of truth; this table is a derived, rebuildable index.
    The full-text ``tsv`` column + GIN index are created in migration 0013
    (a Postgres generated column), so they're not declared on the ORM — the
    search query references them directly.  Notes under ``_private/`` are stored
    in full and readable by the owner in the UI, but are excluded from every
    LLM-facing path (search, read_note, vault map) and from the graph, so their
    content never leaves the box via model egress.
    """

    __tablename__ = "brain_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    frontmatter: Mapped[dict] = mapped_column(PortableJSONB, nullable=False, default=dict)
    content_hash: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    links: Mapped[list["BrainLink"]] = relationship(
        back_populates="src",
        foreign_keys="BrainLink.src_note_id",
        cascade="all, delete-orphan",
    )


class BrainLink(Base):
    """A ``[[wikilink]]`` edge, derived on ingest. Powers the graph view.

    ``dst_note_id`` is resolved to the target note when one exists (matched by
    path or basename); it stays null for links to not-yet-created notes.
    """

    __tablename__ = "brain_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    src_note_id: Mapped[int] = mapped_column(
        ForeignKey("brain_notes.id", ondelete="CASCADE"), nullable=False
    )
    dst_path: Mapped[str] = mapped_column(Text, nullable=False)
    dst_note_id: Mapped[int | None] = mapped_column(
        ForeignKey("brain_notes.id", ondelete="SET NULL"), nullable=True
    )

    src: Mapped["BrainNote"] = relationship(
        back_populates="links", foreign_keys=[src_note_id]
    )


class BrainConversation(Base):
    """A chat thread with the brain agent. Persisted so the chat-first `/brain`
    page has history."""

    __tablename__ = "brain_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    messages: Mapped[list["BrainMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="BrainMessage.id",
    )


class BrainMessage(Base):
    """One turn in a conversation. Only role+content are replayed as history;
    `tool_calls` is a display record of what the agent did that turn."""

    __tablename__ = "brain_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("brain_conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tool_calls: Mapped[list | None] = mapped_column(PortableJSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped["BrainConversation"] = relationship(back_populates="messages")
