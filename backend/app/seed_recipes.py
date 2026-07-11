"""Seed one starter recipe (idempotent): python -m app.seed_recipes

The Toll House chocolate chip cookie — doubles as the reference for the
recipe format: every step mentions ingredients only via {key} tokens, so
amounts always render inline.
"""

from app.db import SessionLocal
from app.models import Recipe
from sqlalchemy import select

COOKIES = {
    "slug": "chocolate-chip-cookies",
    "title": "Chocolate Chip Cookies",
    "description": "The classic Toll House cookie — crisp edges, chewy middle. "
    "The one every other cookie gets measured against.",
    "rating": 4.5,
    "servings": 48,
    "cook_minutes": 25,
    "source_name": "Nestlé Toll House",
    "source_url": "https://www.verybestbaking.com/toll-house/recipes/original-nestle-toll-house-chocolate-chip-cookies/",
    "tags": ["dessert"],
    "language": "en",
    "ingredients": [
        {"key": "flour", "name": "all-purpose flour", "qty": 2.25, "unit": "cup", "note": ""},
        {"key": "baking-soda", "name": "baking soda", "qty": 1, "unit": "tsp", "note": ""},
        {"key": "salt", "name": "salt", "qty": 1, "unit": "tsp", "note": ""},
        {"key": "butter", "name": "butter", "qty": 1, "unit": "cup", "note": "softened"},
        {"key": "sugar", "name": "granulated sugar", "qty": 0.75, "unit": "cup", "note": ""},
        {"key": "brown-sugar", "name": "packed brown sugar", "qty": 0.75, "unit": "cup", "note": ""},
        {"key": "vanilla", "name": "vanilla extract", "qty": 1, "unit": "tsp", "note": ""},
        {"key": "eggs", "name": "large eggs", "qty": 2, "unit": "", "note": ""},
        {"key": "chips", "name": "semi-sweet chocolate chips", "qty": 2, "unit": "cup", "note": ""},
        {"key": "nuts", "name": "chopped nuts", "qty": 1, "unit": "cup", "note": "optional"},
    ],
    "steps": [
        {"text": "Preheat the oven to 375°F."},
        {"text": "Whisk together {flour}, {baking-soda}, and {salt} in a small bowl."},
        {
            "text": "Beat {butter}, {sugar}, {brown-sugar}, and {vanilla} in a "
            "large mixer bowl until creamy."
        },
        {"text": "Add {eggs} one at a time, beating well after each addition."},
        {"text": "Gradually beat in the flour mixture, then stir in {chips} and {nuts}."},
        {"text": "Drop by rounded tablespoon onto ungreased baking sheets."},
        {
            "text": "Bake for 9 to 11 minutes or until golden brown. Cool on the "
            "sheets for 2 minutes, then move to wire racks to cool completely."
        },
    ],
}


def main() -> None:
    db = SessionLocal()
    try:
        exists = db.execute(
            select(Recipe.id).where(Recipe.slug == COOKIES["slug"])
        ).scalar_one_or_none()
        if exists:
            print(f"recipe '{COOKIES['slug']}' already seeded — nothing to do")
            return
        db.add(Recipe(**COOKIES))
        db.commit()
        print(f"seeded recipe '{COOKIES['slug']}'")
    finally:
        db.close()


if __name__ == "__main__":
    main()
