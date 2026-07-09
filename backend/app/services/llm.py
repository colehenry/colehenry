"""LLM fallback for wiki lookups + card enrichment.

Posts to any OpenAI-compatible /chat/completions endpoint (currently
hardcoded to OpenRouter).  Uses MULTILINGUAL_MODEL as the primary and
FALLBACK_MODEL on failure.  All results are cached in wiki_entries by
the caller — each phrase costs one call ever.
"""

import json
import logging

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

LANGUAGE_NAMES = {"fr": "French", "es": "Spanish"}

PROMPT = """Define the {language_name} word or phrase: "{term}"

Return a JSON object with its dictionary definition. Output ONLY valid JSON — no prose, no markdown, no code fences.

{{
  "lemma": "<canonical form: infinitive for verbs, singular for nouns, original for phrases>",
  "entries": [
    {{
      "part_of_speech": "<noun | verb | adjective | adverb | phrase | ...>",
      "ipa": "<IPA if confident, else empty string>",
      "gender": "<'m' or 'f' for nouns, else empty string>",
      "senses": [
        {{
          "definition": "<English definition — include literal translation first for phrases/idioms>",
          "examples": ["<1-2 natural sentences in {language_name}>"],
          "tags": ["<informal | idiom | slang | archaic | ...>"]
        }}
      ],
      "synonyms": ["<0-3 related terms>"]
    }}
  ]
}}

RULES:
- Definitions in English. For single words: concise definition. For phrases and idioms: start with the literal word-for-word English translation, then explain the idiomatic meaning. Example: "Fuck them. An expression of disregard or contempt used to dismiss someone or something."
- 1-3 senses max per entry. Each sense: 1-2 example sentences in {language_name}.
- "phrase" for multi-word expressions, idioms, and fixed expressions.
- gender: required only for nouns ("m" or "f"); empty string for all other POS.
- lemma: infinitive for conjugated verbs; singular for plural nouns; original for phrases.
- ipa: include only if confident (>80%); empty string otherwise.
- tags: register labels useful to a learner. Empty array if none apply.
- synonyms: 0-3. Empty array if none.
- If the input is not a real {language_name} word or phrase, return {{"lemma": "", "entries": []}}.
- Never use grammatical descriptions (e.g. "third-person singular imperfect") as the lemma.
- Example sentences must be in {language_name}, never English.

EXAMPLE for "comer" (Spanish):
{{"lemma": "comer", "entries": [{{"part_of_speech": "verb", "ipa": "/koˈmeɾ/", "gender": "", "senses": [{{"definition": "To consume food, to eat.", "examples": ["Voy a comer una manzana.", "Comemos juntos los domingos."], "tags": []}}, {{"definition": "To eat a meal.", "examples": ["Ya comimos al mediodía."], "tags": []}}], "synonyms": ["alimentarse", "ingerir"]}}]}}

EXAMPLE for "allons-y" (French):
{{"lemma": "allons-y", "entries": [{{"part_of_speech": "phrase", "ipa": "/alɔ̃zi/", "gender": "", "senses": [{{"definition": "Let us go there. Used to express readiness to begin or encourage action.", "examples": ["Allons-y, on va être en retard !"], "tags": ["informal"]}}], "synonyms": ["on y va", "c'est parti"]}}]}}"""


def available() -> bool:
    s = get_settings()
    return bool(s.open_router_api_key and s.multilingual_model)


def _clean_senses(raw_senses) -> list[dict]:
    senses = []
    for sense in raw_senses if isinstance(raw_senses, list) else []:
        if not isinstance(sense, dict):
            continue
        definition = str(sense.get("definition") or "").strip()
        if not definition:
            continue
        senses.append(
            {
                "definition": definition[:500],
                "examples": [
                    str(ex).strip()[:300]
                    for ex in (sense.get("examples") or [])
                    if str(ex).strip()
                ][:3],
                "tags": [
                    str(tag).strip()[:40]
                    for tag in (sense.get("tags") or [])
                    if str(tag).strip()
                ][:5],
            }
        )
    return senses[:4]


def _call_model(settings, model: str, language: str, term: str) -> dict | None:
    """Single LLM call with the given model slug.  Returns wiki-shaped dict or None."""
    try:
        res = httpx.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.open_router_api_key}"},
            json={
                "model": model,
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": PROMPT.format(
                            language_name=LANGUAGE_NAMES[language], term=term
                        ),
                    }
                ],
            },
            timeout=45,
        )
        res.raise_for_status()
        text = res.json()["choices"][0]["message"]["content"] or ""
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        log.warning("llm define failed for %r with model %s: %s", term, model, exc)
        return None

    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    try:
        data = json.loads(text.strip())
    except ValueError:
        log.warning("llm returned unparseable JSON for %r", term)
        return None

    entries = []
    for raw in data.get("entries") or []:
        if not isinstance(raw, dict):
            continue
        senses = _clean_senses(raw.get("senses"))
        if not senses:
            continue
        gender = str(raw.get("gender") or "").strip().lower()
        entries.append(
            {
                "part_of_speech": str(raw.get("part_of_speech") or "").strip()[:40],
                "ipa": str(raw.get("ipa") or "").strip()[:200],
                "gender": gender if gender in ("m", "f") else "",
                "senses": senses,
                "synonyms": [
                    str(s).strip()[:80]
                    for s in (raw.get("synonyms") or [])
                    if str(s).strip()
                ][:8],
            }
        )
    if not entries:
        return None
    lemma = str(data.get("lemma") or "").strip().lower()[:160]
    return {
        "word": term.lower(),
        "lemma": lemma,
        "entries": entries,
        "source": "llm",
    }


def define(language: str, term: str) -> dict | None:
    """Try primary model, then fallback on failure.  Returns wiki-shaped dict or None."""
    term = term.strip()
    if not term or language not in LANGUAGE_NAMES or not available():
        return None
    settings = get_settings()

    result = _call_model(settings, settings.multilingual_model, language, term)
    if result is not None:
        return result

    if settings.fallback_model:
        result = _call_model(settings, settings.fallback_model, language, term)
        if result is not None:
            return result
    return None


def enrich_lookup(language: str, term: str) -> dict | None:
    """Flat {ipa, part_of_speech, gender, translation, example} for enrichment.

    Matches the return shape of dictionary.lookup() so callers can use it
    as a drop-in fallback.
    """
    payload = define(language, term)
    if not payload:
        return None
    entry = payload["entries"][0]
    sense = (entry["senses"] or [{}])[0]
    return {
        "ipa": entry.get("ipa", ""),
        "part_of_speech": entry.get("part_of_speech", ""),
        "gender": entry.get("gender", ""),
        "translation": sense.get("definition", ""),
        "example": (sense.get("examples") or [""])[0],
    }
