"""/language — split by section; each submodule registers its routes on the
shared `router` (owner-only by default) and `public` (showcase reads) routers
defined in `shared`. `main.py` includes both, same as before the split."""

from app.routers.language.shared import public, router

# Imported for their route-registration side effects. Order mirrors the
# original single-module layout, so route precedence is unchanged.
from app.routers.language import (  # noqa: E402
    speech,
    decks,
    cards,
    study,
    texts,
    imports,
    wiki,
    verbs,
)

__all__ = [
    "router",
    "public",
    "speech",
    "decks",
    "cards",
    "study",
    "texts",
    "imports",
    "wiki",
    "verbs",
]
