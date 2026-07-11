import re
import time
import unicodedata
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal, get_db
from app.deps import get_current_email, require_owner
from app.models import Recipe, User, Visibility
from app.schemas.recipe import (
    PhotoSignature,
    RecipeCreate,
    RecipeListItem,
    RecipeOut,
    RecipeUpdate,
)
from app.services import recipe_i18n

router = APIRouter(prefix="/recipes", tags=["recipes"])

# Editing any of these invalidates stored translations.
CONTENT_FIELDS = {"title", "description", "ingredients", "steps", "language"}


def _is_owner(request: Request) -> bool:
    email = get_current_email(request)
    return email is not None and email.lower() == get_settings().owner_email.lower()


def _slugify(title: str) -> str:
    ascii_title = (
        unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    )
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")
    return slug[:140] or "recipe"


def _unique_slug(db: Session, title: str) -> str:
    base = _slugify(title)
    slug = base
    n = 2
    while db.execute(
        select(Recipe.id).where(Recipe.slug == slug)
    ).scalar_one_or_none():
        slug = f"{base}-{n}"
        n += 1
    return slug


def _translate_in_background(recipe_id: int) -> None:
    """Own session — the request's session is closed by the time this runs."""
    db = SessionLocal()
    try:
        recipe_i18n.translate_recipe(db, recipe_id)
    finally:
        db.close()


def _schedule_translation(tasks: BackgroundTasks, recipe: Recipe) -> None:
    if recipe_i18n.available():
        tasks.add_task(_translate_in_background, recipe.id)


@router.get("", response_model=list[RecipeListItem])
def list_recipes(request: Request, db: Session = Depends(get_db)):
    """Public reads. Non-owners only see public recipes."""
    query = select(Recipe).order_by(Recipe.created_at.desc(), Recipe.id.desc())
    if not _is_owner(request):
        query = query.where(Recipe.visibility == Visibility.public)
    return db.execute(query).scalars().all()


@router.get("/{slug}", response_model=RecipeOut)
def get_recipe(slug: str, request: Request, db: Session = Depends(get_db)):
    recipe = db.execute(
        select(Recipe).where(Recipe.slug == slug)
    ).scalar_one_or_none()
    if recipe is None or (
        recipe.visibility != Visibility.public and not _is_owner(request)
    ):
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.post("", response_model=RecipeOut, status_code=201)
def create_recipe(
    body: RecipeCreate,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    recipe = Recipe(slug=_unique_slug(db, body.title), **body.model_dump())
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    _schedule_translation(tasks, recipe)
    return recipe


@router.patch("/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    changes = body.model_dump(exclude_unset=True)
    if changes.get("ingredients") is not None or changes.get("steps") is not None:
        # Cross-field token validation needs the merged document.
        merged = RecipeCreate.model_validate(
            {**RecipeOut.model_validate(recipe).model_dump(), **changes}
        )
        changes["ingredients"] = [i.model_dump() for i in merged.ingredients]
        changes["steps"] = [s.model_dump() for s in merged.steps]

    content_changed = any(
        field in CONTENT_FIELDS and getattr(recipe, field) != value
        for field, value in changes.items()
    )
    for field, value in changes.items():
        setattr(recipe, field, value)
    if content_changed:
        recipe.translations = {}
    db.commit()
    db.refresh(recipe)
    if content_changed:
        _schedule_translation(tasks, recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    db.delete(recipe)
    db.commit()


@router.post("/{recipe_id}/translate", response_model=RecipeOut)
def retranslate_recipe(
    recipe_id: int,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    """Force a fresh translation (e.g. after a failed background run)."""
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not recipe_i18n.available():
        raise HTTPException(status_code=503, detail="Translation not configured")
    recipe.translations = {}
    db.commit()
    db.refresh(recipe)
    _schedule_translation(tasks, recipe)
    return recipe


@router.post("/photo-signature", response_model=PhotoSignature)
def photo_signature(_: User = Depends(require_owner)):
    """Signed params for a direct browser → Cloudinary image upload."""
    settings = get_settings()
    if not settings.cloudinary_url:
        raise HTTPException(status_code=503, detail="Cloudinary not configured")

    from cloudinary.utils import api_sign_request

    parsed = urlparse(settings.cloudinary_url)
    timestamp = int(time.time())
    folder = "recipes"
    signature = api_sign_request(
        {"timestamp": timestamp, "folder": folder}, parsed.password
    )
    return PhotoSignature(
        cloud_name=parsed.hostname or "",
        api_key=parsed.username or "",
        timestamp=timestamp,
        signature=signature,
        folder=folder,
    )
