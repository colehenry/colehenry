from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.project import Visibility


class ProjectBase(BaseModel):
    slug: str
    title: str
    summary: str = ""
    description_md: str = ""
    tech: list[str] = []
    repo_url: str | None = None
    live_url: str | None = None
    embed_url: str | None = None
    screenshot_url: str | None = None
    sort_order: int = 0
    featured: bool = False
    visibility: Visibility = Visibility.public


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    """PATCH body — every field optional."""

    slug: str | None = None
    title: str | None = None
    summary: str | None = None
    description_md: str | None = None
    tech: list[str] | None = None
    repo_url: str | None = None
    live_url: str | None = None
    embed_url: str | None = None
    screenshot_url: str | None = None
    sort_order: int | None = None
    featured: bool | None = None
    visibility: Visibility | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
