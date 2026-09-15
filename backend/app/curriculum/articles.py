"""French noun articles: every noun the learner sees or types carries one.

`noun_display` is the single presentation form ("la maison", "un ami"); the
frontend mirror lives in frontend/lib/french/articles.ts. Elided nouns use the
indefinite article so gender stays visible; uncountables and plural-only
nouns are spelled out in `DISPLAY_OVERRIDES`.
"""

from __future__ import annotations

import re

VOWEL_START = re.compile(r"^[aeiouyàâäéèêëîïôöùûüœæh]", re.IGNORECASE)

ARTICLES = ("le", "la", "les", "l'", "un", "une", "des", "de l'", "du", "de la")
ARTICLE_GENDER = {"le": "m", "un": "m", "du": "m", "la": "f", "une": "f", "de la": "f"}

# french headword → display form, for nouns the rule cannot derive.
DISPLAY_OVERRIDES: dict[str, str] = {
    "ami / amie": "un ami / une amie",
    "copain / copine": "un copain / une copine",
    "an / ans": "un an / des ans",
    "gens": "les gens",
    "vacances": "les vacances",
    "eau": "l'eau",
    "argent": "l'argent",
}

# french headword → accepted typed forms (article required).
ACCEPTED_OVERRIDES: dict[str, list[str]] = {
    "ami / amie": ["un ami", "une amie"],
    "copain / copine": ["un copain", "une copine"],
    "an / ans": ["un an", "des ans"],
    "gens": ["les gens", "des gens"],
    "vacances": ["les vacances", "des vacances"],
    "eau": ["l'eau", "de l'eau"],
    "argent": ["l'argent", "de l'argent"],
    # uncountables the indefinite article would mangle
    "faim": ["la faim"],
    "soif": ["la soif"],
    "santé": ["la santé"],
    "monde": ["le monde"],
    "temps": ["le temps"],
}

_ARTICLE_RE = re.compile(r"^(de l'|de la|du|des|les|le|la|l'|une|un)\s*", re.IGNORECASE)


def split_forms(french: str) -> list[str]:
    return [f.strip() for f in re.split(r"\s*/\s*", french) if f.strip()]


def article_for(word: str, gender: str) -> str:
    """Definite article, or the indefinite one when the definite would elide."""
    if VOWEL_START.match(word):
        return "une" if gender == "f" else "un"
    return "la" if gender == "f" else "le"


def with_article(word: str, gender: str) -> str:
    return f"{article_for(word, gender)} {word}"


def noun_display(french: str, gender: str, pos: str) -> str:
    """Display form for any headword; non-nouns come back unchanged."""
    if pos != "noun" or not gender:
        return french
    if french in DISPLAY_OVERRIDES:
        return DISPLAY_OVERRIDES[french]
    return " / ".join(with_article(form, gender) for form in split_forms(french))


def noun_accepted(french: str, gender: str, pos: str) -> list[str]:
    """Typed answers that count: definite and indefinite of the right gender, per form."""
    if pos != "noun" or not gender:
        return []
    if french in ACCEPTED_OVERRIDES:
        return list(ACCEPTED_OVERRIDES[french])
    out: list[str] = []
    for form in split_forms(french):
        if VOWEL_START.match(form):
            out.append(f"{'une' if gender == 'f' else 'un'} {form}")
        else:
            out.append(f"{'la' if gender == 'f' else 'le'} {form}")
            out.append(f"{'une' if gender == 'f' else 'un'} {form}")
    return out


def strip_article(text: str) -> tuple[str, str]:
    """("la", "maison") for "la maison"; ("", text) when no article leads."""
    m = _ARTICLE_RE.match(text.strip())
    if not m:
        return "", text.strip()
    return m.group(1).lower(), text.strip()[m.end():]


def wrong_article(expected: str, given: str) -> str:
    """Why an article-bearing answer missed: "missing", "genre", or ""."""
    exp_article, exp_word = strip_article(expected)
    if not exp_article:
        return ""
    got_article, got_word = strip_article(given)
    if got_word.strip().lower() != exp_word.strip().lower():
        return ""
    if not got_article:
        return "missing"
    exp_gender = ARTICLE_GENDER.get(exp_article)
    got_gender = ARTICLE_GENDER.get(got_article)
    if exp_gender and got_gender and exp_gender != got_gender:
        return "genre"
    return ""
