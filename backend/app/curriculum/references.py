"""Reference sheets, server-side. The source of truth is
`frontend/lib/french/references.ts`; `npm run export:references` dumps it to
`references.json` next to this file so the tutor can search, read, and validate
`sheet#section` links. Dynamic sheets (core-verbs, interference) carry no rows."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

_PATH = Path(__file__).with_name("references.json")


@lru_cache(maxsize=1)
def sheets() -> list[dict]:
    if not _PATH.exists():
        return []
    return json.loads(_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _by_id() -> dict[str, dict]:
    return {s["id"]: s for s in sheets()}


def sheet_index() -> list[dict]:
    """Compact map for the system prompt: every sheet with its section ids + titles."""
    return [
        {"id": s["id"], "title": s["title"], "sections": [{"id": x["id"], "title": x["title"]} for x in s["sections"]]}
        for s in sheets()
    ]


def valid_ref(ref: str) -> bool:
    sheet, _, section = ref.partition("#")
    s = _by_id().get(sheet)
    if s is None:
        return False
    return not section or any(x["id"] == section for x in s["sections"])


def read_section(sheet: str, section: str = "") -> dict | None:
    s = _by_id().get(sheet)
    if s is None:
        return None
    if not section:
        return {"sheet": s["id"], "title": s["title"], "blurb": s["blurb"],
                "sections": [{"id": x["id"], "title": x["title"], "note": x["note"]} for x in s["sections"]]}
    for x in s["sections"]:
        if x["id"] == section:
            return {"sheet": s["id"], "ref": f"{sheet}#{section}", "title": x["title"], "note": x["note"],
                    "columns": x["columns"], "rows": x["rows"][:40]}
    return None


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-zàâäéèêëîïôöùûüçœ/ɛəøœɑ̃ɔ̃ɛ̃ʁʃʒɥ]+", text.lower()))


def search(query: str, limit: int = 6) -> list[dict]:
    """Cheap token-overlap search over section titles, notes, and rows."""
    q = _tokens(query)
    if not q:
        return []
    hits: list[tuple[float, dict]] = []
    for s in sheets():
        for x in s["sections"]:
            head = _tokens(f"{s['title']} {x['title']} {x['note']}")
            body = _tokens(" ".join(" ".join(r) for r in x["rows"]))
            score = 3 * len(q & head) + len(q & body)
            if score:
                hits.append((score, {"ref": f"{s['id']}#{x['id']}", "title": f"{s['title']} · {x['title']}", "note": x["note"][:160]}))
    hits.sort(key=lambda h: -h[0])
    return [h for _, h in hits[:limit]]
