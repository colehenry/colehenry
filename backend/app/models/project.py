import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import PortableStringArray


class Visibility(str, enum.Enum):
    """Every content item site-wide carries one of these.

    Only owner-only writes / public reads are enforced in this build;
    passcode gating and share links come in a later build.
    """

    public = "public"
    passcode = "passcode"
    private = "private"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    description_md: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tech: Mapped[list[str]] = mapped_column(PortableStringArray, default=list, nullable=False)
    repo_url: Mapped[str | None] = mapped_column(String(500))
    live_url: Mapped[str | None] = mapped_column(String(500))
    embed_url: Mapped[str | None] = mapped_column(String(500))
    screenshot_url: Mapped[str | None] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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
