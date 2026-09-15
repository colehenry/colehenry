"""Answer normalization and scoring shared by every typed exercise."""

from __future__ import annotations

import difflib
import re
import unicodedata

from app.curriculum.articles import wrong_article

_APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "`": "'", "´": "'"})
_PUNCT = re.compile(r"[.,;:!?¿¡«»\"()\[\]]+")
_SPACES = re.compile(r"\s+")


def normalize(text: str, *, strip_accents: bool = False) -> str:
    """Lowercase, unify apostrophes, drop punctuation, collapse spaces.

    Keeps accents unless asked — accent-insensitive matching is a second
    pass so the learner can be told "right word, wrong accent".
    """
    text = text.translate(_APOSTROPHES).lower().strip()
    text = _PUNCT.sub(" ", text)
    text = text.replace("' ", "'")  # "j' ai" → "j'ai"
    text = _SPACES.sub(" ", text).strip()
    if strip_accents:
        text = "".join(
            c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
        )
    return text


def drop_ne(text: str) -> str:
    """Informal variant: 'je ne veux pas' → 'je veux pas', "je n'ai pas" → "j'ai pas"."""
    out = re.sub(r"\bne\s+", "", text)
    out = re.sub(r"\bn'(?=[aeiouyhéèêàâôûîï])", "", out)
    # "je ai" produced by dropping n' → "j'ai"
    out = re.sub(r"\bje (?=[aeiouyhéèêàâôûîï])", "j'", out)
    return _SPACES.sub(" ", out).strip()


def check_typed(answer: str, accepted: list[str]) -> dict:
    """Grade a typed answer against accepted variants.

    Returns {correct, score, exact, accent_issue, ne_dropped, closest}.
    score: 1 exact · 0.9 accent-only · 0.8 ne dropped · else similarity-based
    (≥0.92 similarity counts as a typo pass at 0.7).
    """
    given = normalize(answer)
    if not given:
        return {"correct": False, "score": 0.0, "exact": False, "accent_issue": False, "ne_dropped": False, "closest": accepted[0] if accepted else ""}
    variants = [normalize(a) for a in accepted if a.strip()]
    if given in variants:
        return {"correct": True, "score": 1.0, "exact": True, "accent_issue": False, "ne_dropped": False, "closest": answer}
    given_flat = normalize(answer, strip_accents=True)
    for original, v in zip(accepted, variants):
        if given_flat == normalize(v, strip_accents=True):
            return {"correct": True, "score": 0.9, "exact": False, "accent_issue": True, "ne_dropped": False, "closest": original}
    for original, v in zip(accepted, variants):
        if "ne " in v or "n'" in v:
            informal = drop_ne(v)
            if given == informal or given_flat == normalize(informal, strip_accents=True):
                return {"correct": True, "score": 0.8, "exact": False, "accent_issue": False, "ne_dropped": True, "closest": original}
    best, best_ratio = accepted[0] if accepted else "", 0.0
    for original, v in zip(accepted, variants):
        ratio = difflib.SequenceMatcher(None, given_flat, normalize(v, strip_accents=True)).ratio()
        if ratio > best_ratio:
            best, best_ratio = original, ratio
    if best_ratio >= 0.92:
        return {"correct": True, "score": 0.7, "exact": False, "accent_issue": False, "ne_dropped": False, "closest": best}
    return {"correct": False, "score": round(best_ratio * 0.5, 2), "exact": False, "accent_issue": False, "ne_dropped": False, "closest": best}


def article_issue(answer: str, accepted: list[str]) -> str:
    """"missing" / "genre" when the noun is right but its article is not, else ""."""
    given = normalize(answer)
    for variant in accepted:
        issue = wrong_article(normalize(variant), given)
        if issue:
            return issue
    return ""


def word_diff(expected: str, given: str) -> list[dict]:
    """Word-level diff for dictation feedback: [{op: equal|missing|extra|wrong, text}]."""
    exp = normalize(expected).split()
    got = normalize(given).split()
    out: list[dict] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, exp, got).get_opcodes():
        if op == "equal":
            out.extend({"op": "equal", "text": w} for w in exp[i1:i2])
        elif op == "delete":
            out.extend({"op": "missing", "text": w} for w in exp[i1:i2])
        elif op == "insert":
            out.extend({"op": "extra", "text": w} for w in got[j1:j2])
        else:
            out.extend({"op": "wrong", "text": w, "expected": " ".join(exp[i1:i2])} for w in got[j1:j2])
    return out


def dictation_score(expected: str, given: str) -> float:
    exp = normalize(expected, strip_accents=True).split()
    got = normalize(given, strip_accents=True).split()
    if not exp:
        return 0.0
    matcher = difflib.SequenceMatcher(None, exp, got)
    matched = sum(block.size for block in matcher.get_matching_blocks())
    return round(matched / max(len(exp), len(got)), 2)
