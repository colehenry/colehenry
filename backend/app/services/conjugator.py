"""On-demand French/Spanish conjugation for the wiki, via verbecc.

verbecc is an optional dependency (it pulls in ML libraries) — when it isn't
installed, `available()` is False and callers degrade gracefully: the wiki
still shows dictionary entries, just without a conjugation table.

French tense keys and persons match scripts/seed_verbs.py so on-the-fly
tables and saved-verb tables render identically. Spanish keeps verbecc's
native mood/tense keys; the frontend maps them to labels.
"""

import logging
from functools import lru_cache

log = logging.getLogger(__name__)

PERSONS_6 = ["1s", "2s", "3s", "1p", "2p", "3p"]
# fr impératif: tu/nous/vous · es imperativo: tú/usted/nosotros/vosotros/ustedes
IMPERATIVE_PERSONS = {
    "fr": ["2s", "1p", "2p"],
    "es": ["2s", "3s", "1p", "2p", "3p"],
}

# (verbecc mood, verbecc tense, our tense) — our mood == verbecc mood.
TENSE_MAPS = {
    "fr": [
        ("indicatif", "présent", "présent"),
        ("indicatif", "passé-composé", "passé-composé"),
        ("indicatif", "imparfait", "imparfait"),
        ("indicatif", "futur-simple", "futur-simple"),
        ("indicatif", "passé-simple", "passé-simple"),
        ("conditionnel", "présent", "présent"),
        ("subjonctif", "présent", "présent"),
        ("imperatif", "imperatif-présent", "présent"),
    ],
    "es": [
        ("indicativo", "presente", "presente"),
        ("indicativo", "pretérito-perfecto-compuesto", "pretérito-perfecto-compuesto"),
        ("indicativo", "pretérito-imperfecto", "pretérito-imperfecto"),
        ("indicativo", "futuro", "futuro"),
        ("indicativo", "pretérito-perfecto-simple", "pretérito-perfecto-simple"),
        ("condicional", "presente", "presente"),
        ("subjuntivo", "presente", "presente"),
        ("imperativo", "afirmativo", "afirmativo"),
    ],
}

# "going to" future — stable helper-verb forms, not worth a verbecc round-trip.
_NEAR_FUTURE = {
    # aller (présent) + infinitive → futur proche
    "fr": ("indicatif", "futur-proche", ["vais", "vas", "va", "allons", "allez", "vont"], ""),
    # ir (presente) + a + infinitive → futuro próximo
    "es": ("indicativo", "futuro-próximo", ["voy", "vas", "va", "vamos", "vais", "van"], "a "),
}

_REGULAR_TEMPLATES = {
    "fr": {"aim:er", "fin:ir", "vend:re"},
    "es": {"cort:ar", "deb:er", "viv:ir"},
}

_GROUPS = {"fr": ("-er", "-ir", "-re"), "es": ("-ar", "-er", "-ir")}

SLOT_KEYS = {
    "fr": {
        ("indicatif", "présent"): ("indicative", "present"),
        ("indicatif", "passé-composé"): ("indicative", "compound-past"),
        ("indicatif", "imparfait"): ("indicative", "imperfect"),
        ("indicatif", "futur-simple"): ("indicative", "future"),
        ("indicatif", "passé-simple"): ("indicative", "simple-past"),
        ("conditionnel", "présent"): ("conditional", "present"),
        ("subjonctif", "présent"): ("subjunctive", "present"),
        ("imperatif", "présent"): ("imperative", "present"),
        ("indicatif", "futur-proche"): ("indicative", "near-future"),
    },
    "es": {
        ("indicativo", "presente"): ("indicative", "present"),
        ("indicativo", "pretérito-perfecto-compuesto"): ("indicative", "compound-past"),
        ("indicativo", "pretérito-imperfecto"): ("indicative", "imperfect"),
        ("indicativo", "futuro"): ("indicative", "future"),
        ("indicativo", "pretérito-perfecto-simple"): ("indicative", "simple-past"),
        ("condicional", "presente"): ("conditional", "present"),
        ("subjuntivo", "presente"): ("subjunctive", "present"),
        ("imperativo", "afirmativo"): ("imperative", "present"),
        ("indicativo", "futuro-próximo"): ("indicative", "near-future"),
    },
}


def available() -> bool:
    try:
        import verbecc  # noqa: F401

        return True
    except ImportError:
        return False


@lru_cache(maxsize=2)
def _conjugator(lang: str):
    from verbecc import CompleteConjugator

    return CompleteConjugator(lang=lang)


def _value(raw) -> str:
    """verbecc 2.x returns enums in row dicts; older versions returned strings."""
    return getattr(raw, "value", raw or "")


def _row_person(row: dict) -> str:
    return f"{_value(row.get('p'))}{_value(row.get('n'))}"


def _row_form(row: dict) -> str:
    forms = row.get("c") or []
    return (forms[0] if forms else "").strip()


def _forms_for(data: dict, mood: str, tense: str, persons: list[str]) -> list[str]:
    try:
        rows = data["moods"][mood][tense]
    except (KeyError, TypeError):
        return []
    if not rows:
        return []
    if not isinstance(rows[0], dict):
        return [str(form).strip() for form in rows]
    out: list[str] = []
    for person in persons:
        match = next((row for row in rows if _row_person(row) == person), None)
        out.append(_row_form(match) if match else "")
    return out


def _usable(form: str) -> bool:
    return bool(form) and form != "-" and not form.startswith("-")


def conjugate(infinitive: str, language: str = "fr") -> dict | None:
    """Return {infinitive, group, is_irregular, predicted, forms} or None.

    forms: [{mood, tense, person, form}], same shape as saved Conjugation rows.
    """
    infinitive = infinitive.strip().lower()
    if not infinitive or language not in TENSE_MAPS or not available():
        return None
    try:
        conj = _conjugator(language).conjugate(infinitive, conjugate_pronouns=False)
        data = conj.get_data() if hasattr(conj, "get_data") else conj
    except Exception as exc:
        log.info("verbecc could not conjugate %r (%s): %s", infinitive, language, exc)
        return None

    verb_info = data.get("verb") or {}
    template = _value(verb_info.get("template"))
    group = next(
        (g for g in _GROUPS[language] if infinitive.endswith(g[1:])),
        "irregular",
    )
    is_irregular = template not in _REGULAR_TEMPLATES[language]
    if is_irregular and group != "irregular":
        group = "irregular"

    forms: list[dict] = []
    for mood, verbecc_tense, our_tense in TENSE_MAPS[language]:
        persons = (
            IMPERATIVE_PERSONS[language]
            if mood in ("imperatif", "imperativo")
            else PERSONS_6
        )
        for person, form in zip(persons, _forms_for(data, mood, verbecc_tense, persons)):
            form = form.strip()
            if _usable(form):
                slot_mood, slot_tense = SLOT_KEYS[language][(mood, our_tense)]
                forms.append(
                    {
                        "mood": mood,
                        "tense": our_tense,
                        "person": person,
                        "form": form,
                        "slot_key": f"{slot_mood}:{slot_tense}:{person}",
                    }
                )
    if not forms:
        return None

    near_mood, near_tense, helpers, particle = _NEAR_FUTURE[language]
    for person, helper in zip(PERSONS_6, helpers):
        slot_mood, slot_tense = SLOT_KEYS[language][(near_mood, near_tense)]
        forms.append(
            {
                "mood": near_mood,
                "tense": near_tense,
                "person": person,
                "form": f"{helper} {particle}{infinitive}",
                "slot_key": f"{slot_mood}:{slot_tense}:{person}",
            }
        )

    return {
        "infinitive": infinitive,
        "group": group,
        "is_irregular": is_irregular,
        "predicted": bool(verb_info.get("predicted")),
        "forms": forms,
    }
