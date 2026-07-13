"""Conjugation center: saved verbs, verb sets, and drill generation."""

from fastapi import Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    CardDirection,
    CardSource,
    CardType,
    Conjugation,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
    Verb,
    VerbRelation,
    VerbSet,
    VerbSetMember,
)
from app.routers.language.decks import deck_counts, deck_out
from app.routers.language.shared import (
    INFINITIVE_ENDINGS,
    PERSON_LABELS,
    PERSON_LABELS_ES,
    WIKI_STRIP,
    public,
    router,
)
from app.schemas.language import (
    ConjugationOut,
    DeckOut,
    DrillCreate,
    VerbCreate,
    VerbDetail,
    VerbOut,
    VerbSetCreate,
    VerbSetMemberIn,
    VerbSetOut,
    VerbSetUpdate,
)
from app.services import conjugator, dictionary, lexemes, translate


def _related_verb(db: Session, verb: Verb) -> Verb | None:
    return db.execute(
        select(Verb)
        .join(VerbRelation, VerbRelation.target_verb_id == Verb.id)
        .where(
            VerbRelation.source_verb_id == verb.id,
            VerbRelation.relation_type == "translation",
        )
        .order_by(Verb.language)
    ).scalars().first()


def _verb_set_ids(db: Session, verb_id: int) -> list[int]:
    return list(
        db.execute(
            select(VerbSetMember.set_id)
            .where(VerbSetMember.verb_id == verb_id)
            .order_by(VerbSetMember.set_id)
        ).scalars()
    )


def _related_verb_map(db: Session, verb_ids: list[int]) -> dict[int, Verb]:
    """Batched _related_verb: source verb id -> its translation equivalent."""
    if not verb_ids:
        return {}
    rows = db.execute(
        select(VerbRelation.source_verb_id, Verb)
        .join(Verb, VerbRelation.target_verb_id == Verb.id)
        .where(
            VerbRelation.source_verb_id.in_(verb_ids),
            VerbRelation.relation_type == "translation",
        )
        .order_by(Verb.language)
    ).all()
    mapping: dict[int, Verb] = {}
    for source_id, equivalent in rows:
        mapping.setdefault(source_id, equivalent)  # first by language, as above
    return mapping


def _set_ids_map(db: Session, verb_ids: list[int]) -> dict[int, list[int]]:
    """Batched _verb_set_ids: verb id -> its set ids, ascending."""
    if not verb_ids:
        return {}
    rows = db.execute(
        select(VerbSetMember.verb_id, VerbSetMember.set_id)
        .where(VerbSetMember.verb_id.in_(verb_ids))
        .order_by(VerbSetMember.set_id)
    ).all()
    mapping: dict[int, list[int]] = {}
    for verb_id, set_id in rows:
        mapping.setdefault(verb_id, []).append(set_id)
    return mapping


def _build_verb_out(verb: Verb, equivalent: Verb | None, set_ids: list[int]) -> VerbOut:
    return VerbOut(
        id=verb.id,
        language=verb.language,
        lexeme_id=verb.lexeme_id,
        infinitive=verb.infinitive,
        group=verb.group,
        is_irregular=verb.is_irregular,
        translation=verb.translation,
        frequency_rank=verb.frequency_rank,
        equivalent_verb_id=equivalent.id if equivalent else None,
        equivalent_language=equivalent.language if equivalent else "",
        equivalent_infinitive=equivalent.infinitive if equivalent else "",
        set_ids=set_ids,
    )


def _verb_out(db: Session, verb: Verb) -> VerbOut:
    return _build_verb_out(
        verb, _related_verb(db, verb), _verb_set_ids(db, verb.id)
    )


def _verb_detail(db: Session, verb: Verb) -> VerbDetail:
    equivalent = _related_verb(db, verb)
    equivalent_forms = {}
    if equivalent:
        equivalent_forms = {
            row.slot_key: row.form
            for row in db.execute(
                select(Conjugation).where(Conjugation.verb_id == equivalent.id)
            ).scalars()
        }
    rows = db.execute(
        select(Conjugation)
        .where(Conjugation.verb_id == verb.id)
        .order_by(Conjugation.id)
    ).scalars().all()
    return VerbDetail(
        **_verb_out(db, verb).model_dump(),
        conjugations=[
            ConjugationOut(
                id=row.id,
                mood=row.mood,
                tense=row.tense,
                person=row.person,
                form=row.form,
                slot_key=row.slot_key,
                equivalent_form=equivalent_forms.get(row.slot_key, ""),
                audio_url=row.audio_url,
            )
            for row in rows
        ],
    )


def _persist_conjugated_verb(
    db: Session,
    language: str,
    data: dict,
    translation_text: str,
) -> Verb:
    infinitive = data["infinitive"]
    lexeme = lexemes.get_or_create(db, language, infinitive)
    max_rank = db.execute(
        select(func.max(Verb.frequency_rank)).where(Verb.language == language)
    ).scalar() or 0
    verb = Verb(
        language=language,
        lexeme_id=lexeme.id,
        infinitive=infinitive,
        normalized_infinitive=lexemes.normalize_headword(infinitive),
        group=data["group"],
        is_irregular=data["is_irregular"],
        translation=translation_text[:120] or infinitive,
        frequency_rank=max_rank + 1,
    )
    db.add(verb)
    db.flush()
    for form in data["forms"]:
        db.add(Conjugation(verb_id=verb.id, **form))
    return verb


def _link_verbs(db: Session, source: Verb, target: Verb) -> None:
    for left, right in ((source, target), (target, source)):
        existing = db.execute(
            select(VerbRelation).where(
                VerbRelation.source_verb_id == left.id,
                VerbRelation.target_verb_id == right.id,
                VerbRelation.relation_type == "translation",
            )
        ).scalar_one_or_none()
        if not existing:
            db.add(
                VerbRelation(
                    source_verb_id=left.id,
                    target_verb_id=right.id,
                    relation_type="translation",
                )
            )


def _try_create_equivalent(db: Session, verb: Verb) -> Verb | None:
    if verb.language not in ("fr", "es"):
        return None
    target_language = "es" if verb.language == "fr" else "fr"
    translated = translate.translate_pair(
        db, verb.infinitive, verb.language, target_language
    ).strip().lower().strip(WIKI_STRIP)
    if not translated or translated == verb.infinitive or "," in translated:
        return None
    for prefix in ("to ", "le ", "la ", "el ", "un ", "une "):
        if translated.startswith(prefix):
            translated = translated[len(prefix):].strip()
            break
    normalized = lexemes.normalize_headword(translated)
    existing = db.execute(
        select(Verb).where(
            Verb.language == target_language,
            Verb.normalized_infinitive == normalized,
        )
    ).scalar_one_or_none()
    if existing:
        _link_verbs(db, verb, existing)
        return existing
    if not translated.endswith(INFINITIVE_ENDINGS[Language(target_language)]):
        return None
    data = conjugator.conjugate(translated, target_language)
    if data is None:
        return None
    equivalent = _persist_conjugated_verb(
        db, target_language, data, verb.translation
    )
    _link_verbs(db, verb, equivalent)
    return equivalent


@router.post("/verbs", response_model=VerbDetail, status_code=201)
def create_verb(body: VerbCreate, db: Session = Depends(get_db)):
    """Save a wiki verb and, when possible, its FR/ES equivalent."""
    language = body.language.value
    normalized = lexemes.normalize_headword(body.infinitive)
    verb = db.execute(
        select(Verb).where(
            Verb.language == language,
            Verb.normalized_infinitive == normalized,
        )
    ).scalar_one_or_none()
    if verb is None:
        if not conjugator.available():
            raise HTTPException(
                status_code=503,
                detail="verbecc is not installed on this server",
            )
        data = conjugator.conjugate(body.infinitive, language)
        if data is None:
            raise HTTPException(status_code=422, detail="Could not conjugate that verb")
        found = dictionary.lookup(language, body.infinitive)
        verb = _persist_conjugated_verb(
            db,
            language,
            data,
            (found or {}).get("translation", "") or body.infinitive,
        )
        _try_create_equivalent(db, verb)

    for set_id in body.set_ids:
        verb_set = db.get(VerbSet, set_id)
        if verb_set is None or verb_set.language != language:
            raise HTTPException(status_code=400, detail="Verb set language mismatch")
        member = db.execute(
            select(VerbSetMember).where(
                VerbSetMember.set_id == set_id,
                VerbSetMember.verb_id == verb.id,
            )
        ).scalar_one_or_none()
        if not member:
            db.add(VerbSetMember(set_id=set_id, verb_id=verb.id))

    db.commit()
    db.refresh(verb)
    return _verb_detail(db, verb)


@public.get("/verbs", response_model=list[VerbOut])
def list_verbs(
    language: Language = Language.fr,
    db: Session = Depends(get_db),
):
    verbs = db.execute(
        select(Verb)
        .where(Verb.language == language.value)
        .order_by(Verb.frequency_rank, Verb.infinitive)
    ).scalars().all()
    # Three queries total. The per-verb helpers here were an N+1 that took
    # ~17s for 100 verbs against remote Postgres.
    ids = [verb.id for verb in verbs]
    equivalents = _related_verb_map(db, ids)
    set_ids = _set_ids_map(db, ids)
    return [
        _build_verb_out(verb, equivalents.get(verb.id), set_ids.get(verb.id, []))
        for verb in verbs
    ]


@public.get("/verbs/{verb_id}", response_model=VerbDetail)
def get_verb(verb_id: int, db: Session = Depends(get_db)):
    verb = db.get(Verb, verb_id)
    if verb is None:
        raise HTTPException(status_code=404, detail="Verb not found")
    return _verb_detail(db, verb)


def _verb_set_out(db: Session, verb_set: VerbSet) -> VerbSetOut:
    count = db.execute(
        select(func.count(VerbSetMember.id)).where(
            VerbSetMember.set_id == verb_set.id
        )
    ).scalar_one()
    return VerbSetOut(
        id=verb_set.id,
        language=verb_set.language,
        name=verb_set.name,
        description=verb_set.description,
        verb_count=count,
        created_at=verb_set.created_at,
    )


@public.get("/verb-sets", response_model=list[VerbSetOut])
def list_verb_sets(
    language: Language | None = None,
    db: Session = Depends(get_db),
):
    query = select(VerbSet).order_by(VerbSet.language, VerbSet.name)
    if language:
        query = query.where(VerbSet.language == language.value)
    return [_verb_set_out(db, row) for row in db.execute(query).scalars().all()]


@router.post("/verb-sets", response_model=VerbSetOut, status_code=201)
def create_verb_set(body: VerbSetCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(VerbSet).where(
            VerbSet.language == body.language.value,
            func.lower(VerbSet.name) == body.name.strip().lower(),
        )
    ).scalar_one_or_none()
    if existing:
        return _verb_set_out(db, existing)
    row = VerbSet(
        language=body.language.value,
        name=body.name.strip(),
        description=body.description.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _verb_set_out(db, row)


@router.patch("/verb-sets/{set_id}", response_model=VerbSetOut)
def update_verb_set(
    set_id: int,
    body: VerbSetUpdate,
    db: Session = Depends(get_db),
):
    row = db.get(VerbSet, set_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Verb set not found")
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Set name is required")
        row.name = name
    if body.description is not None:
        row.description = body.description.strip()
    db.commit()
    db.refresh(row)
    return _verb_set_out(db, row)


@router.delete("/verb-sets/{set_id}", status_code=204)
def delete_verb_set(set_id: int, db: Session = Depends(get_db)):
    row = db.get(VerbSet, set_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Verb set not found")
    db.delete(row)
    db.commit()


@router.post("/verb-sets/{set_id}/members", response_model=VerbSetOut)
def add_verb_set_member(
    set_id: int,
    body: VerbSetMemberIn,
    db: Session = Depends(get_db),
):
    row = db.get(VerbSet, set_id)
    verb = db.get(Verb, body.verb_id)
    if row is None or verb is None:
        raise HTTPException(status_code=404, detail="Verb set or verb not found")
    if row.language != verb.language:
        raise HTTPException(status_code=400, detail="Verb set language mismatch")
    existing = db.execute(
        select(VerbSetMember).where(
            VerbSetMember.set_id == row.id,
            VerbSetMember.verb_id == verb.id,
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(VerbSetMember(set_id=row.id, verb_id=verb.id))
        db.commit()
    return _verb_set_out(db, row)


@router.delete("/verb-sets/{set_id}/members/{verb_id}", status_code=204)
def remove_verb_set_member(
    set_id: int,
    verb_id: int,
    db: Session = Depends(get_db),
):
    member = db.execute(
        select(VerbSetMember).where(
            VerbSetMember.set_id == set_id,
            VerbSetMember.verb_id == verb_id,
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Verb set member not found")
    db.delete(member)
    db.commit()


TENSE_LABELS = {
    ("indicatif", "présent"): "Présent",
    ("indicatif", "passé-composé"): "Passé composé",
    ("indicatif", "imparfait"): "Imparfait",
    ("indicatif", "futur-proche"): "Futur proche",
    ("indicatif", "futur-simple"): "Futur simple",
    ("indicatif", "passé-simple"): "Passé simple",
    ("conditionnel", "présent"): "Conditionnel",
    ("subjonctif", "présent"): "Subjonctif",
    ("imperatif", "présent"): "Impératif",
    ("indicativo", "presente"): "Presente",
    ("indicativo", "pretérito-perfecto-compuesto"): "Pretérito perfecto",
    ("indicativo", "pretérito-imperfecto"): "Imperfecto",
    ("indicativo", "futuro-próximo"): "Futuro próximo",
    ("indicativo", "futuro"): "Futuro",
    ("indicativo", "pretérito-perfecto-simple"): "Indefinido",
    ("condicional", "presente"): "Condicional",
    ("subjuntivo", "presente"): "Subjuntivo",
    ("imperativo", "afirmativo"): "Imperativo",
}


@router.post("/drills", response_model=DeckOut, status_code=201)
def create_drills(body: DrillCreate, db: Session = Depends(get_db)):
    """Generate cell-level cloze cards into a per-tense system deck."""
    label = TENSE_LABELS.get((body.mood, body.tense))
    if label is None:
        raise HTTPException(status_code=400, detail="Unknown mood/tense")

    language = body.language.value
    verbs_query = select(Verb).where(Verb.language == language)
    if body.set_id is not None:
        verb_set = db.get(VerbSet, body.set_id)
        if verb_set is None or verb_set.language != language:
            raise HTTPException(status_code=400, detail="Verb set language mismatch")
        verbs_query = verbs_query.join(
            VerbSetMember, VerbSetMember.verb_id == Verb.id
        ).where(VerbSetMember.set_id == body.set_id)
    elif body.verb_ids:
        verbs_query = verbs_query.where(Verb.id.in_(body.verb_ids))
    elif body.irregular_only:
        verbs_query = verbs_query.where(Verb.is_irregular)
    elif body.group:
        verbs_query = verbs_query.where(Verb.group == body.group)
    verbs = db.execute(verbs_query).scalars().all()
    if not verbs:
        raise HTTPException(status_code=400, detail="No verbs match the filter")

    name = f"Drill · {language.upper()} · {label}" + (
        " · audio" if body.audio_first else ""
    )
    legacy_name = f"Drill · {label}" + (
        " · audio" if body.audio_first else ""
    )
    deck = db.execute(
        select(FlashcardDeck).where(
            FlashcardDeck.name.in_((name, legacy_name)),
            FlashcardDeck.language == language,
            FlashcardDeck.is_system,
        ).order_by(FlashcardDeck.name == name).limit(1)
    ).scalar_one_or_none()
    if deck is None:
        deck = FlashcardDeck(
            name=name,
            language=language,
            description=f"Auto-generated conjugation drills — {label}.",
            tags=["conjugation"],
            is_system=True,
        )
        db.add(deck)
        db.flush()

    existing_refs = set(
        db.execute(
            select(Flashcard.source_ref).where(Flashcard.deck_id == deck.id)
        )
        .scalars()
        .all()
    )

    conjugations = db.execute(
        select(Conjugation)
        .where(Conjugation.verb_id.in_([v.id for v in verbs]))
        .where(Conjugation.mood == body.mood, Conjugation.tense == body.tense)
    ).scalars().all()
    by_verb = {v.id: v for v in verbs}

    added = 0
    for conj in conjugations:
        ref = str(conj.id)
        if ref in existing_refs:
            continue
        verb = by_verb[conj.verb_id]
        labels = PERSON_LABELS_ES if language == "es" else PERSON_LABELS
        person = labels.get(conj.person, conj.person)
        equivalent = _related_verb(db, verb)
        equivalent_form = ""
        if equivalent:
            equivalent_form = db.execute(
                select(Conjugation.form).where(
                    Conjugation.verb_id == equivalent.id,
                    Conjugation.slot_key == conj.slot_key,
                )
            ).scalar_one_or_none() or ""
        equivalent_note = (
            f"≈ {equivalent.language.upper()} {equivalent_form}"
            if equivalent and equivalent_form
            else ""
        )
        card = Flashcard(
            deck_id=deck.id,
            card_type=CardType.audio if body.audio_first else CardType.cloze,
            direction=CardDirection.production,
            front=f"{person} · {verb.infinitive} · {label}",
            back=conj.form,
            cognate_note=equivalent_note,
            audio_url=conj.audio_url,
            source=CardSource.conjugation,
            source_ref=ref,
            conjugation_id=conj.id,
            tags=[body.tense, verb.group],
        )
        card.review = FlashcardReview()
        db.add(card)
        added += 1

    db.commit()
    db.refresh(deck)
    return deck_out(deck, deck_counts(db))
