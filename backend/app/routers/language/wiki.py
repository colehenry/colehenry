"""Wiki — look up any word."""

from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FalseFriend, Language, Verb, VerbRelation, WikiEntry
from app.routers.language.shared import (
    INFINITIVE_ENDINGS,
    WIKI_STRIP,
    lexique_gender,
    lexique_row,
    now_utc,
    router,
)
from app.schemas.language import (
    WikiConjugationOut,
    WikiDictEntry,
    WikiEquivalentOut,
    WikiOut,
)
from app.services import conjugator, dictionary, lexemes, llm, translate


def _wiki_payload(
    db: Session, language: Language, term: str, refresh: bool, use_llm: bool = True
) -> dict | None:
    """Dictionary payload for `term`, cached in wiki_entries after first fetch.

    Terms the dictionary doesn't know (phrases, slang) fall back to the
    configured LLM; the payload carries source="llm" so the UI can label it.
    """
    cached = db.execute(
        select(WikiEntry).where(WikiEntry.language == language, WikiEntry.word == term)
    ).scalar_one_or_none()
    if cached and cached.payload_version >= 2 and not refresh:
        return cached.payload

    payload = dictionary.lookup_full(language.value, term)
    if payload is None and use_llm:
        payload = llm.define(language.value, term)
    if payload:
        if cached:
            cached.payload = payload
            cached.fetched_at = now_utc()
            cached.payload_version = 2
        else:
            db.add(
                WikiEntry(
                    language=language,
                    word=term,
                    payload=payload,
                    payload_version=2,
                )
            )
        db.commit()
        return payload
    return cached.payload if cached else None


# Leading articles/particles MyMemory tends to prepend to single-word answers.
_TRANSLATION_PREFIXES = (
    "le ", "la ", "les ", "l'", "un ", "une ", "des ",
    "el ", "los ", "las ", "una ", "unos ", "unas ",
    "to ", "the ", "se ",
)


def _reverse_lookup_term(db: Session, language: Language, term: str) -> str:
    """If `term` is an English word, return its FR/ES translation ("" if not).

    Lets "week" with French selected resolve to the "semaine" page.
    """
    if not dictionary.lookup_full("en", term):
        return ""
    translated = translate.translate(db, term, language.value)
    db.commit()  # persist the translation cache row
    cleaned = translated.strip().lower().strip(WIKI_STRIP)
    for prefix in _TRANSLATION_PREFIXES:
        if cleaned.startswith(prefix) and len(cleaned) > len(prefix):
            cleaned = cleaned[len(prefix):]
            break
    return "" if not cleaned or cleaned == term else cleaned


@router.get("/wiki/{language}/{word}", response_model=WikiOut)
def wiki_lookup(
    language: Language,
    word: str,
    refresh: bool = False,
    defs: str = Query(default="en", pattern="^(en|fr|es)$"),
    db: Session = Depends(get_db),
):
    term = word.strip().lower().strip(WIKI_STRIP)
    if not term:
        raise HTTPException(status_code=400, detail="Word is required")

    # Try the target language first ("chat" is valid French AND English —
    # the selected language wins). On a miss, treat the input as English and
    # redirect to its FR/ES translation's page.
    translated_from = ""
    payload = _wiki_payload(db, language, term, refresh, use_llm=False)
    if payload is None:
        target = _reverse_lookup_term(db, language, term)
        if target:
            target_payload = _wiki_payload(db, language, target, refresh)
            if target_payload:
                translated_from = term
                term = target
                payload = target_payload
    if payload is None:
        payload = _wiki_payload(db, language, term, refresh)

    entries = []
    for raw in (payload or {}).get("entries", []):
        senses = raw.get("senses", [])
        if defs in translate.TARGETS:
            senses = [
                {**s, "translation": translate.translate(db, s["definition"], defs)}
                for s in senses
            ]
        entries.append(WikiDictEntry(**{**raw, "senses": senses}))
    if defs in translate.TARGETS:
        db.commit()  # persist any translations fetched above

    gender = next((e.gender for e in entries if e.gender), "")
    if not gender:
        gender = lexique_gender(db, language, term)
    ipa = next((e.ipa for e in entries if e.ipa), "")

    lexique = lexique_row(db, term) if language == Language.fr else None
    display_lemma = (
        lexique.lemma
        if lexique and lexique.lemma and lexique.lemma.lower() != term
        else ""
    )

    first_entry = entries[0] if entries else None
    first_sense = first_entry.senses[0] if first_entry and first_entry.senses else None
    lookup_hint = (
        {
            "ipa": first_entry.ipa,
            "part_of_speech": first_entry.part_of_speech,
            "gender": first_entry.gender,
            "translation": first_sense.definition if first_sense else "",
            "example": first_sense.examples[0]
            if first_sense and first_sense.examples
            else "",
        }
        if first_entry
        else None
    )
    resolution = lexemes.resolve(
        db,
        language.value,
        term,
        found=lookup_hint,
        hinted_lemma=(payload or {}).get("lemma", "") or display_lemma,
    )
    headword = resolution.headword
    lemma = headword if headword != term else display_lemma
    lexeme = lexemes.get_or_create(db, language.value, headword)

    column = FalseFriend.fr if language == Language.fr else FalseFriend.es
    false_friend = db.execute(
        select(FalseFriend).where(func.lower(column) == term)
    ).scalar_one_or_none()

    saved_verb = None
    saved_verb = db.execute(
        select(Verb).where(
            Verb.language == language.value,
            Verb.normalized_infinitive == lexemes.normalize_headword(headword),
        )
    ).scalar_one_or_none()
    is_verb = saved_verb is not None or resolution.is_verb or any(
        e.part_of_speech == "verb" for e in entries
    )

    # Conjugate on the fly for unsaved infinitives (saved verbs already
    # have their conjugations in the DB — the client reuses those).
    conjugations: list[WikiConjugationOut] = []
    predicted = False
    if (
        is_verb
        and saved_verb is None
        and headword.endswith(INFINITIVE_ENDINGS[language])
    ):
        conjugated = conjugator.conjugate(headword, language.value)
        if conjugated:
            conjugations = [WikiConjugationOut(**f) for f in conjugated["forms"]]
            predicted = conjugated["predicted"]

    equivalent = None
    if saved_verb:
        related = db.execute(
            select(Verb)
            .join(VerbRelation, VerbRelation.target_verb_id == Verb.id)
            .where(
                VerbRelation.source_verb_id == saved_verb.id,
                VerbRelation.relation_type == "translation",
            )
            .order_by(Verb.language)
        ).scalars().first()
        if related:
            equivalent = WikiEquivalentOut(
                language=related.language,
                word=related.infinitive,
                verb_id=related.id,
            )

    result = WikiOut(
        word=term,
        language=language,
        found=bool(entries) or false_friend is not None or saved_verb is not None,
        source=(payload or {}).get("source", "dictionary" if entries else ""),
        translated_from=translated_from,
        entries=entries,
        gender=gender,
        ipa=ipa,
        frequency=lexique.frequency if lexique else None,
        lemma=lemma,
        headword=headword,
        is_inflected=resolution.is_inflected,
        form_note=resolution.form_note,
        lexeme_id=lexeme.id,
        existing_cards=lexemes.card_locations(db, lexeme),
        cognate_note=false_friend.note if false_friend else "",
        is_false_friend=false_friend is not None,
        is_verb=is_verb,
        verb_id=saved_verb.id if saved_verb else None,
        conjugations=conjugations,
        can_conjugate=conjugator.available(),
        predicted=predicted,
        equivalent=equivalent,
    )
    db.commit()
    return result
