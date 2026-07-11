import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.project import Visibility

TOKEN_RE = re.compile(r"\{([a-z0-9-]+)\}")

KEY_RE = re.compile(r"^[a-z0-9-]+$")


class Ingredient(BaseModel):
    """One ingredient row. `key` is what steps reference as {key}."""

    key: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=160)
    qty: float | None = Field(default=None, ge=0)  # null = "to taste" etc.
    unit: str = Field(default="", max_length=40)
    note: str = Field(default="", max_length=200)

    @field_validator("key")
    @classmethod
    def key_is_tokenable(cls, value: str) -> str:
        if not KEY_RE.fullmatch(value):
            raise ValueError("key must be lowercase letters/digits/hyphens")
        return value


class Step(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class RecipeBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    rating: float = Field(default=0, ge=0, le=5)  # out of 5, half steps
    ingredients: list[Ingredient] = []
    steps: list[Step] = []
    photo_urls: list[str] = []
    tags: list[str] = []
    servings: int | None = Field(default=None, ge=1)
    cook_minutes: int | None = Field(default=None, ge=1)
    source_name: str = ""
    source_url: str = ""
    language: str = "en"
    visibility: Visibility = Visibility.public

    @field_validator("language")
    @classmethod
    def language_supported(cls, value: str) -> str:
        if value not in ("en", "es"):
            raise ValueError("language must be 'en' or 'es'")
        return value

    @model_validator(mode="after")
    def steps_reference_known_ingredients(self):
        """The format rule: every {token} must be a real ingredient key.

        This is what guarantees an ingredient is never mentioned in a step
        without its amount — the renderer expands tokens to qty + name.
        """
        keys = {ing.key for ing in self.ingredients}
        if len(keys) != len(self.ingredients):
            raise ValueError("duplicate ingredient keys")
        for i, step in enumerate(self.steps, start=1):
            unknown = [t for t in TOKEN_RE.findall(step.text) if t not in keys]
            if unknown:
                raise ValueError(
                    f"step {i} references unknown ingredient(s): {', '.join(unknown)}"
                )
        return self


class RecipeCreate(RecipeBase):
    pass


class RecipeUpdate(BaseModel):
    """PATCH body — every field optional. Content changes reset translations."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    ingredients: list[Ingredient] | None = None
    steps: list[Step] | None = None
    photo_urls: list[str] | None = None
    tags: list[str] | None = None
    servings: int | None = Field(default=None, ge=1)
    cook_minutes: int | None = Field(default=None, ge=1)
    source_name: str | None = None
    source_url: str | None = None
    language: str | None = None
    visibility: Visibility | None = None

    @field_validator("language")
    @classmethod
    def language_supported(cls, value: str | None) -> str | None:
        if value is not None and value not in ("en", "es"):
            raise ValueError("language must be 'en' or 'es'")
        return value


class RecipeOut(RecipeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    translations: dict = {}
    created_at: datetime
    updated_at: datetime


class RecipeListItem(BaseModel):
    """Box view — no steps, first photo only."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    description: str
    rating: float
    photo_urls: list[str]
    tags: list[str]
    servings: int | None
    cook_minutes: int | None
    language: str
    translations: dict = {}
    visibility: Visibility
    created_at: datetime


class PhotoSignature(BaseModel):
    cloud_name: str
    api_key: str
    timestamp: int
    signature: str
    folder: str
