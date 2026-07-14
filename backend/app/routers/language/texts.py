"""Text library: texts, annotations, and dictionary/LLM selection lookup."""

from fastapi import Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import (
    CardSource,
    FalseFriend,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
    LanguageText,
    LanguageTextAnnotation,
)
from app.routers.language.cards import card_out
from app.routers.language.shared import lang_code, lexique_gender, public, router
from app.schemas.language import (
    AnnotationCardCreate,
    CardOut,
    LanguageTextCreate,
    LanguageTextDetail,
    LanguageTextOut,
    LanguageTextUpdate,
    TextAnnotationCreate,
    TextAnnotationOut,
    TextAnnotationUpdate,
    TextLookupIn,
    TextLookupOut,
)
from app.services import dictionary, enrich, lexemes, llm


def _text_summary(text: LanguageText, annotation_count: int) -> LanguageTextOut:
    return LanguageTextOut(
        id=text.id,
        title=text.title,
        language=text.language,
        source_type=text.source_type,
        source_ref=text.source_ref,
        tags=text.tags,
        created_at=text.created_at,
        updated_at=text.updated_at,
        annotation_count=annotation_count,
    )


def _annotation_out(annotation: LanguageTextAnnotation) -> TextAnnotationOut:
    return TextAnnotationOut(
        id=annotation.id,
        text_id=annotation.text_id,
        start_offset=annotation.start_offset,
        end_offset=annotation.end_offset,
        selected_text=annotation.selected_text,
        kind=annotation.kind,
        color=annotation.color,
        note=annotation.note,
        translation=annotation.translation,
        ipa=annotation.ipa,
        gender=annotation.gender,
        part_of_speech=annotation.part_of_speech,
        cognate_note=annotation.cognate_note,
        is_false_friend=annotation.is_false_friend,
        lexeme_id=annotation.lexeme_id,
        headword=annotation.lexeme.headword if annotation.lexeme else "",
        form_note=annotation.form_note,
        deck_id=annotation.deck_id,
        flashcard_id=annotation.flashcard_id,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )


def _text_detail(text: LanguageText) -> LanguageTextDetail:
    return LanguageTextDetail(
        **_text_summary(text, len(text.annotations)).model_dump(),
        content=text.content,
        annotations=[_annotation_out(a) for a in text.annotations],
    )


def _validate_span(content: str, start: int, end: int) -> str:
    if start < 0 or end <= start or end > len(content):
        raise HTTPException(status_code=400, detail="Annotation span is out of range")
    selected = content[start:end]
    if not selected.strip():
        raise HTTPException(status_code=400, detail="Selection cannot be blank")
    return selected


def _lookup_terms(selected_text: str) -> list[str]:
    raw = selected_text.strip()
    stripped = raw.strip(".,;:!?¡¿()[]{}\"'“”‘’«»")
    terms = [stripped or raw]
    terms.extend(
        token.strip(".,;:!?¡¿()[]{}\"'“”‘’«»")
        for token in raw.split()
        if token.strip(".,;:!?¡¿()[]{}\"'“”‘’«»")
    )
    seen: set[str] = set()
    result: list[str] = []
    for term in terms:
        key = term.lower()
        if key and key not in seen:
            seen.add(key)
            result.append(term)
    return result


def lookup_annotation_text(
    db: Session, language: str | Language, selected_text: str
) -> TextLookupOut:
    language_code = lang_code(language)
    selected = selected_text.strip()
    found = None
    provider = "manual_needed"
    matched_term = ""

    # Multi-word phrases: the dictionary never has them, so go straight to LLM.
    if " " in selected:
        found = llm.enrich_lookup(language_code, selected)
        if found:
            provider = "llm"
            matched_term = selected

    if not found:
        for term in _lookup_terms(selected):
            found = dictionary.lookup(language_code, term)
            if found:
                provider = "dictionary"
                matched_term = term
                break

    false_friend = None
    column = FalseFriend.fr if language_code == "fr" else FalseFriend.es
    for term in _lookup_terms(selected):
        false_friend = db.execute(
            select(FalseFriend).where(func.lower(column) == term.lower())
        ).scalar_one_or_none()
        if false_friend:
            provider = (
                "dictionary+faux_ami" if provider == "dictionary" else "faux_ami"
            )
            break

    resolution = lexemes.resolve(
        db, language_code, matched_term or selected, found=found
    )
    canonical_found = resolution.lookup or found
    lexeme = lexemes.maybe_get_or_create(db, language_code, resolution.headword)
    translation = canonical_found["translation"] if canonical_found else ""
    if false_friend and not translation:
        translation = false_friend.es if language_code == "fr" else false_friend.fr

    gender = canonical_found["gender"] if canonical_found else ""
    if not gender:
        gender = lexique_gender(db, Language(language_code), resolution.headword)

    return TextLookupOut(
        selected_text=selected,
        translation=translation,
        ipa=canonical_found["ipa"] if canonical_found else "",
        gender=gender,
        part_of_speech=canonical_found["part_of_speech"] if canonical_found else "",
        cognate_note=false_friend.note if false_friend else "",
        is_false_friend=false_friend is not None,
        provider=(
            f"{provider}+{resolution.provider}"
            if resolution.is_inflected
            else provider
        ),
        headword=resolution.headword,
        is_inflected=resolution.is_inflected,
        form_note=resolution.form_note,
        lexeme_id=lexeme.id if lexeme else None,
        existing_cards=lexemes.card_locations(db, lexeme) if lexeme else [],
    )


def _line_context(content: str, start: int, end: int) -> str:
    line_start = content.rfind("\n", 0, start) + 1
    line_end = content.find("\n", end)
    if line_end == -1:
        line_end = len(content)
    return content[line_start:line_end].strip()


def _dedupe_tags(*groups: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for group in groups:
        for tag in group:
            cleaned = tag.strip()
            key = cleaned.lower()
            if cleaned and key not in seen:
                seen.add(key)
                result.append(cleaned)
    return result


@public.get("/texts", response_model=list[LanguageTextOut])
def list_texts(
    language: Language | None = None,
    db: Session = Depends(get_db),
):
    counts = (
        select(
            LanguageTextAnnotation.text_id,
            func.count(LanguageTextAnnotation.id).label("annotation_count"),
        )
        .group_by(LanguageTextAnnotation.text_id)
        .subquery()
    )
    query = (
        select(LanguageText, func.coalesce(counts.c.annotation_count, 0))
        .outerjoin(counts, counts.c.text_id == LanguageText.id)
        .order_by(LanguageText.updated_at.desc(), LanguageText.id.desc())
    )
    if language is not None:
        query = query.where(LanguageText.language == language)
    rows = db.execute(query).all()
    return [_text_summary(text, annotation_count) for text, annotation_count in rows]


@router.post("/texts", response_model=LanguageTextDetail, status_code=201)
def create_text(body: LanguageTextCreate, db: Session = Depends(get_db)):
    text = LanguageText(
        title=body.title.strip(),
        language=body.language,
        source_type=body.source_type.strip() or "other",
        source_ref=body.source_ref.strip(),
        content=body.content,
        tags=body.tags,
    )
    db.add(text)
    db.commit()
    db.refresh(text)
    return _text_detail(text)


@public.get("/texts/{text_id}", response_model=LanguageTextDetail)
def get_text(text_id: int, db: Session = Depends(get_db)):
    text = db.get(
        LanguageText,
        text_id,
        options=[selectinload(LanguageText.annotations)],
    )
    if text is None:
        raise HTTPException(status_code=404, detail="Text not found")
    return _text_detail(text)


@router.patch("/texts/{text_id}", response_model=LanguageTextDetail)
def update_text(
    text_id: int,
    body: LanguageTextUpdate,
    db: Session = Depends(get_db),
):
    text = db.get(
        LanguageText,
        text_id,
        options=[selectinload(LanguageText.annotations)],
    )
    if text is None:
        raise HTTPException(status_code=404, detail="Text not found")
    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        title = data["title"].strip()
        if not title:
            raise HTTPException(status_code=400, detail="Title is required")
        text.title = title
    if "language" in data and data["language"] is not None:
        text.language = data["language"]
    if "content" in data and data["content"] is not None:
        if not data["content"].strip():
            raise HTTPException(status_code=400, detail="Text content is required")
        if text.annotations and data["content"] != text.content:
            raise HTTPException(
                status_code=400,
                detail="Cannot replace content after annotations exist",
            )
        text.content = data["content"]
    if "source_type" in data and data["source_type"] is not None:
        text.source_type = data["source_type"].strip() or "other"
    if "source_ref" in data and data["source_ref"] is not None:
        text.source_ref = data["source_ref"].strip()
    if "tags" in data and data["tags"] is not None:
        text.tags = data["tags"]
    db.commit()
    db.refresh(text)
    return _text_detail(text)


@router.delete("/texts/{text_id}", status_code=204)
def delete_text(text_id: int, db: Session = Depends(get_db)):
    text = db.get(LanguageText, text_id)
    if text is None:
        raise HTTPException(status_code=404, detail="Text not found")
    db.delete(text)
    db.commit()


@router.post("/texts/{text_id}/lookup", response_model=TextLookupOut)
def lookup_text_selection(
    text_id: int,
    body: TextLookupIn,
    db: Session = Depends(get_db),
):
    text = db.get(LanguageText, text_id)
    if text is None:
        raise HTTPException(status_code=404, detail="Text not found")
    result = lookup_annotation_text(db, text.language, body.selected_text)
    db.commit()
    return result


@router.post(
    "/texts/{text_id}/annotations",
    response_model=TextAnnotationOut,
    status_code=201,
)
def create_text_annotation(
    text_id: int,
    body: TextAnnotationCreate,
    db: Session = Depends(get_db),
):
    text = db.get(LanguageText, text_id)
    if text is None:
        raise HTTPException(status_code=404, detail="Text not found")
    selected = _validate_span(text.content, body.start_offset, body.end_offset)
    annotation = LanguageTextAnnotation(
        text_id=text.id,
        start_offset=body.start_offset,
        end_offset=body.end_offset,
        selected_text=selected,
        kind=body.kind.strip() or "highlight",
        color=body.color.strip() or "brand",
        note=body.note.strip(),
        translation=body.translation.strip(),
        ipa=body.ipa.strip(),
        gender=body.gender.strip(),
        part_of_speech=body.part_of_speech.strip(),
        cognate_note=body.cognate_note.strip(),
        is_false_friend=body.is_false_friend,
        lexeme=(
            lexemes.maybe_get_or_create(db, lang_code(text.language), body.headword)
            if body.headword.strip()
            else None
        ),
        form_note=body.form_note.strip(),
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return _annotation_out(annotation)


@router.patch("/annotations/{annotation_id}", response_model=TextAnnotationOut)
def update_text_annotation(
    annotation_id: int,
    body: TextAnnotationUpdate,
    db: Session = Depends(get_db),
):
    annotation = db.get(
        LanguageTextAnnotation,
        annotation_id,
        options=[selectinload(LanguageTextAnnotation.text)],
    )
    if annotation is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    data = body.model_dump(exclude_unset=True)
    start = data.get("start_offset", annotation.start_offset)
    end = data.get("end_offset", annotation.end_offset)
    if "start_offset" in data or "end_offset" in data:
        annotation.selected_text = _validate_span(annotation.text.content, start, end)
        annotation.start_offset = start
        annotation.end_offset = end
    elif "selected_text" in data and data["selected_text"] is not None:
        selected_text = data["selected_text"].strip()
        if selected_text:
            annotation.selected_text = selected_text
    for key in (
        "kind",
        "color",
        "note",
        "translation",
        "ipa",
        "gender",
        "part_of_speech",
        "cognate_note",
        "form_note",
    ):
        if key in data and data[key] is not None:
            value = data[key].strip()
            if key in ("kind", "color") and not value:
                value = "highlight" if key == "kind" else "brand"
            setattr(annotation, key, value)
    if "headword" in data and data["headword"] is not None:
        headword = data["headword"].strip()
        annotation.lexeme = (
            lexemes.maybe_get_or_create(
                db, lang_code(annotation.text.language), headword
            )
            if headword
            else None
        )
    if "is_false_friend" in data and data["is_false_friend"] is not None:
        annotation.is_false_friend = data["is_false_friend"]
    db.commit()
    db.refresh(annotation)
    return _annotation_out(annotation)


@router.delete("/annotations/{annotation_id}", status_code=204)
def delete_text_annotation(annotation_id: int, db: Session = Depends(get_db)):
    annotation = db.get(LanguageTextAnnotation, annotation_id)
    if annotation is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    db.delete(annotation)
    db.commit()


@router.post("/annotations/{annotation_id}/card", response_model=CardOut, status_code=201)
def create_card_from_annotation(
    annotation_id: int,
    body: AnnotationCardCreate,
    db: Session = Depends(get_db),
):
    annotation = db.get(
        LanguageTextAnnotation,
        annotation_id,
        options=[selectinload(LanguageTextAnnotation.text)],
    )
    if annotation is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    deck = db.get(FlashcardDeck, body.deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    if deck.language != annotation.text.language:
        raise HTTPException(
            status_code=400,
            detail="Annotation and deck languages must match",
        )

    front = (
        body.front.strip()
        or (annotation.lexeme.headword if annotation.lexeme else "")
        or annotation.selected_text
    )
    back = body.back.strip() or annotation.translation or annotation.note
    if not front.strip():
        raise HTTPException(status_code=400, detail="Card front is required")

    card_lexeme = lexemes.maybe_get_or_create(db, lang_code(deck.language), front)
    duplicate = next(
        (
            location
            for location in (
                lexemes.card_locations(db, card_lexeme) if card_lexeme else []
            )
            if location["deck_id"] == deck.id
        ),
        None,
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=f"{front} is already in {duplicate['deck_name']}",
        )

    card = Flashcard(
        deck_id=deck.id,
        card_type=body.card_type,
        direction=body.direction,
        front=front,
        back=back,
        ipa=annotation.ipa,
        gender=annotation.gender,
        part_of_speech=annotation.part_of_speech,
        example=_line_context(
            annotation.text.content, annotation.start_offset, annotation.end_offset
        ),
        cognate_note=annotation.cognate_note,
        is_false_friend=annotation.is_false_friend,
        source=CardSource.paste,
        source_ref=f"language_text:{annotation.text_id}:annotation:{annotation.id}",
        tags=_dedupe_tags(annotation.text.tags, body.tags, ["text"]),
        lexeme_id=card_lexeme.id if card_lexeme else None,
    )
    if body.enrich:
        enrich.enrich_card(db, card, lang_code(deck.language))
    card.review = FlashcardReview()
    db.add(card)
    db.flush()
    annotation.deck_id = deck.id
    annotation.flashcard_id = card.id
    db.commit()
    db.refresh(card)
    return card_out(card)
