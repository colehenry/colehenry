"""EN↔ES recipe translation via the OpenRouter chain (translate-on-save).

Runs as a FastAPI background task after create/update: one call translates
the whole recipe (title, description, ingredient names/units/notes, steps)
into the other site language and stores it in `recipes.translations`.
`{key}` tokens in steps are ingredient references and must survive verbatim
— the result is rejected if any step's token multiset changed, so a bad
translation can never break the amounts-in-steps rendering. On any failure
the recipe simply stays untranslated and the UI falls back to the source
language.
"""

import json
import logging
import re

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Recipe

log = logging.getLogger(__name__)

TOKEN_RE = re.compile(r"\{[a-z0-9-]+\}")

LANGUAGE_NAMES = {"en": "English", "es": "Spanish"}

PROMPT = """Translate this recipe from {source_name} to {target_name}.

Return ONLY valid JSON with exactly this shape — no prose, no markdown, no code fences:

{{
  "title": "<translated title>",
  "description": "<translated description>",
  "ingredients": [{{"name": "...", "unit": "...", "note": "..."}}],
  "steps": ["<translated step text>"]
}}

RULES:
- Placeholders like {{flour}} or {{brown-sugar}} in steps are ingredient references. Copy each one through EXACTLY as written, curly braces and all. Never translate, rename, add, or drop a placeholder.
- Translate ingredient names, units, and notes into natural {target_name} cooking vocabulary (e.g. "cup" → "taza", "tsp" → "cdta" when targeting Spanish). Keep units singular.
- Same number of ingredients (same order) and same number of steps as the input.
- Empty strings stay empty strings.
- Use the register of a home cookbook, not a literal word-for-word rendering.

RECIPE:
{payload}"""


def available() -> bool:
    s = get_settings()
    return bool(s.open_router_api_key and s.multilingual_model)


def _call_model(settings, model: str, prompt: str) -> dict | None:
    try:
        res = httpx.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.open_router_api_key}"},
            json={
                "model": model,
                "max_tokens": 4000,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=90,
        )
        res.raise_for_status()
        text = res.json()["choices"][0]["message"]["content"] or ""
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        log.warning("recipe translation call failed with model %s: %s", model, exc)
        return None

    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text.strip())
    except ValueError:
        log.warning("recipe translation returned unparseable JSON")
        return None
    return data if isinstance(data, dict) else None


def _validate(recipe: Recipe, data: dict) -> dict | None:
    """Shape + token check; returns the cleaned translations entry or None."""
    title = str(data.get("title") or "").strip()
    raw_ingredients = data.get("ingredients")
    raw_steps = data.get("steps")
    if (
        not title
        or not isinstance(raw_ingredients, list)
        or not isinstance(raw_steps, list)
        or len(raw_ingredients) != len(recipe.ingredients)
        or len(raw_steps) != len(recipe.steps)
    ):
        return None

    ingredients = []
    for raw in raw_ingredients:
        if not isinstance(raw, dict) or not str(raw.get("name") or "").strip():
            return None
        ingredients.append(
            {
                "name": str(raw.get("name") or "").strip()[:160],
                "unit": str(raw.get("unit") or "").strip()[:40],
                "note": str(raw.get("note") or "").strip()[:200],
            }
        )

    steps = []
    for original, translated in zip(recipe.steps, raw_steps):
        text = str(translated or "").strip()
        # Tokens are load-bearing: reject any step whose references changed.
        if not text or sorted(TOKEN_RE.findall(text)) != sorted(
            TOKEN_RE.findall(original.get("text", ""))
        ):
            return None
        steps.append({"text": text[:2000]})

    return {
        "title": title[:200],
        "description": str(data.get("description") or "").strip(),
        "ingredients": ingredients,
        "steps": steps,
    }


def translate_recipe(db: Session, recipe_id: int) -> None:
    """Background task: fill recipes.translations[target] for the other language."""
    recipe = db.get(Recipe, recipe_id)
    if recipe is None or not available():
        return
    target = "es" if recipe.language == "en" else "en"
    if target in (recipe.translations or {}):
        return
    stamp = recipe.updated_at

    settings = get_settings()
    prompt = PROMPT.format(
        source_name=LANGUAGE_NAMES[recipe.language],
        target_name=LANGUAGE_NAMES[target],
        payload=json.dumps(
            {
                "title": recipe.title,
                "description": recipe.description,
                "ingredients": [
                    {
                        "name": i.get("name", ""),
                        "unit": i.get("unit", ""),
                        "note": i.get("note", ""),
                    }
                    for i in recipe.ingredients
                ],
                "steps": [s.get("text", "") for s in recipe.steps],
            },
            ensure_ascii=False,
        ),
    )

    entry = None
    data = _call_model(settings, settings.multilingual_model, prompt)
    if data is not None:
        entry = _validate(recipe, data)
    if entry is None and settings.fallback_model:
        data = _call_model(settings, settings.fallback_model, prompt)
        if data is not None:
            entry = _validate(recipe, data)
    if entry is None:
        log.warning("recipe %s: translation to %s failed", recipe_id, target)
        return

    # The recipe may have been edited while the model was thinking — a stale
    # translation must not overwrite the reset the router performed.
    db.refresh(recipe)
    if recipe.updated_at != stamp:
        return
    recipe.translations = {**(recipe.translations or {}), target: entry}
    db.commit()
    log.info("recipe %s: translated to %s", recipe_id, target)
