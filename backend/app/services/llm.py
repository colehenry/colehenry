"""LLM fallback for wiki lookups the dictionary misses (phrases, slang).

Model-agnostic: posts to any OpenAI-compatible /chat/completions endpoint —
OpenAI, Anthropic (https://api.anthropic.com/v1/), OpenRouter, Groq, Mistral,
or a local Ollama (http://localhost:11434/v1). Configure LLM_BASE_URL,
LLM_API_KEY, LLM_MODEL; unset = no fallback, the wiki just reports not-found.

Output is normalized to the exact shape dictionary.lookup_full returns, so
the wiki page renders LLM definitions identically (plus a "source" marker).
The caller caches results in wiki_entries — each phrase costs one call ever.
"""

import json
import logging

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

LANGUAGE_NAMES = {"fr": "French", "es": "Spanish"}

PROMPT = """You are a {language_name} dictionary. Define the {language_name} word or phrase: "{term}"

Reply with ONLY a JSON object, no prose and no code fences, in exactly this shape:
{{"lemma": "", "entries": [{{"part_of_speech": "phrase", "ipa": "", "gender": "", "senses": [{{"definition": "", "examples": [], "tags": []}}], "synonyms": []}}]}}

Rules:
- definitions in English, concise dictionary register
- when literal and idiomatic meanings differ, give both as separate senses
- 1-3 senses; each with 1-2 natural example sentences in {language_name}
- part_of_speech: standard POS for single words, "phrase" for expressions
- gender: "m" or "f" for nouns, otherwise ""
- lemma: for a conjugated verb, the infinitive only; otherwise the original term
- never use a grammatical description such as "third-person imperfect" as lemma
- ipa: IPA for the whole term if confident, otherwise ""
- tags: register labels like "informal", "idiom", "slang" when relevant
- if the term is not real {language_name}, reply {{"entries": []}}"""


def available() -> bool:
    s = get_settings()
    return bool(s.llm_api_key and s.llm_model)


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


def define(language: str, term: str) -> dict | None:
    """Dictionary-shaped payload for `term` from the configured LLM, or None."""
    term = term.strip()
    if not term or language not in LANGUAGE_NAMES or not available():
        return None
    settings = get_settings()

    try:
        res = httpx.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            json={
                "model": settings.llm_model,
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
        log.warning("llm define failed for %r: %s", term, exc)
        return None

    # Models occasionally fence the JSON despite instructions.
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
