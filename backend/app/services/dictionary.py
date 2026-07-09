"""Free Dictionary API (Wiktionary-backed) lookups for card enrichment.

https://freedictionaryapi.com/api/v1/entries/{lang}/{word}
Free, CC BY-SA, covers FR + ES with IPA. Deterministic — no LLM.
"""

import httpx

BASE = "https://freedictionaryapi.com/api/v1/entries"

# POS priority when a word has several entries — content words first.
_POS_ORDER = ["verb", "noun", "adjective", "adverb", "interjection"]


def _entry_gender(entry: dict) -> str:
    """Scan sense tags for a grammatical gender ('m'/'f')."""
    for sense in entry.get("senses") or []:
        tags = sense.get("tags") or []
        if "masculine" in tags:
            return "m"
        if "feminine" in tags:
            return "f"
    return ""


def _entry_ipa(entry: dict) -> str:
    ipa = ""
    for p in entry.get("pronunciations") or []:
        if p.get("type") == "ipa" and p.get("text"):
            ipa = p["text"]
            if not p.get("tags"):  # untagged = the general pronunciation
                break
    return ipa


def lookup_full(language: str, word: str) -> dict | None:
    """Every entry/sense for `word`, normalized for the wiki page.

    Returns {word, entries: [{part_of_speech, ipa, gender,
    senses: [{definition, examples, tags}], synonyms}]} or None.
    """
    word = word.strip().lower()
    if not word:
        return None
    try:
        res = httpx.get(f"{BASE}/{language}/{word}", timeout=8)
        if res.status_code != 200:
            return None
        data = res.json()
    except (httpx.HTTPError, ValueError):
        return None

    raw_entries = data.get("entries") or []
    if not raw_entries:
        return None
    raw_entries.sort(
        key=lambda e: _POS_ORDER.index(e.get("partOfSpeech"))
        if e.get("partOfSpeech") in _POS_ORDER
        else len(_POS_ORDER)
    )

    entries = []
    for entry in raw_entries:
        senses = [
            {
                "definition": sense.get("definition", ""),
                "examples": [ex for ex in (sense.get("examples") or []) if ex],
                "tags": sense.get("tags") or [],
            }
            for sense in (entry.get("senses") or [])
            if sense.get("definition")
        ]
        if not senses:
            continue
        entries.append(
            {
                "part_of_speech": entry.get("partOfSpeech") or "",
                "ipa": _entry_ipa(entry),
                "gender": _entry_gender(entry),
                "senses": senses,
                "synonyms": entry.get("synonyms") or [],
            }
        )
    if not entries:
        return None
    return {"word": data.get("word") or word, "entries": entries}


def lookup(language: str, word: str) -> dict | None:
    """Return {ipa, part_of_speech, gender, translation, example} or None."""
    word = word.strip().lower()
    if not word:
        return None
    try:
        res = httpx.get(f"{BASE}/{language}/{word}", timeout=8)
        if res.status_code != 200:
            return None
        data = res.json()
    except (httpx.HTTPError, ValueError):
        return None

    entries = data.get("entries") or []
    if not entries:
        return None
    entries.sort(
        key=lambda e: _POS_ORDER.index(e.get("partOfSpeech"))
        if e.get("partOfSpeech") in _POS_ORDER
        else len(_POS_ORDER)
    )
    entry = entries[0]

    ipa = ""
    for p in entry.get("pronunciations") or []:
        if p.get("type") == "ipa" and p.get("text"):
            ipa = p["text"]
            if not p.get("tags"):  # untagged = the general pronunciation
                break

    senses = entry.get("senses") or []
    definition = senses[0].get("definition", "") if senses else ""
    gender = ""
    example = ""
    for sense in senses:
        tags = sense.get("tags") or []
        if not gender and "masculine" in tags:
            gender = "m"
        if not gender and "feminine" in tags:
            gender = "f"
        if not example and sense.get("examples"):
            example = sense["examples"][0]

    return {
        "ipa": ipa,
        "part_of_speech": entry.get("partOfSpeech") or "",
        "gender": gender,
        "translation": definition,
        "example": example,
    }
