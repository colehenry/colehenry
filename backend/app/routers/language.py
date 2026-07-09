from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import require_owner
from app.models import (
    CardDirection,
    CardSource,
    CardType,
    Conjugation,
    FalseFriend,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
    LanguageLexeme,
    LanguageTarget,
    LanguageTask,
    LanguageText,
    LanguageTextAnnotation,
    LexiqueEntry,
    ReviewLog,
    ReviewStateName,
    Verb,
    VerbRelation,
    VerbSet,
    VerbSetMember,
    WikiEntry,
)
from app.schemas.language import (
    CardCreate,
    CardOut,
    CardUpdate,
    ConjugationOut,
    ConjugationAudioOut,
    DeckCreate,
    DeckOut,
    DeckUpdate,
    DrillCreate,
    GuardrailOut,
    HeatmapDay,
    AnnotationCardCreate,
    LanguageDashboard,
    LanguageSplit,
    LanguageTextCreate,
    LanguageTextDetail,
    LanguageTextOut,
    LanguageTextUpdate,
    RetentionOut,
    ReviewIn,
    ReviewOut,
    SpeakIn,
    SpeakOut,
    StudyQueue,
    TargetCreate,
    TargetOut,
    TargetUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TextAnnotationCreate,
    TextAnnotationOut,
    TextAnnotationUpdate,
    TextLookupIn,
    TextLookupOut,
    VerbCreate,
    VerbDetail,
    VerbOut,
    VerbSetCreate,
    VerbSetMemberIn,
    VerbSetOut,
    VerbSetUpdate,
    WikiConjugationOut,
    WikiDictEntry,
    WikiEquivalentOut,
    WikiOut,
)
from app.services import conjugator, dictionary, enrich, lexemes, llm, translate, tts
from app.services.fsrs_engine import grade

# The whole tool is owner-only — one dependency gates every route.
router = APIRouter(
    prefix="/language", tags=["language"], dependencies=[Depends(require_owner)]
)

# Cards with stability past this many days count as "mature" (Anki convention).
MATURE_STABILITY_DAYS = 21
# Spanish guardrail fallback when no es_reviews target exists.
DEFAULT_ES_FLOOR = 50

PERSON_LABELS = {
    "1s": "je",
    "2s": "tu",
    "3s": "il/elle",
    "1p": "nous",
    "2p": "vous",
    "3p": "ils/elles",
}

PERSON_LABELS_ES = {
    "1s": "yo",
    "2s": "tú",
    "3s": "él/ella",
    "1p": "nosotros",
    "2p": "vosotros",
    "3p": "ellos/ellas",
}

# What TTS says for each person — one concrete pronoun, not "il/elle".
SPOKEN_SUBJECTS = {
    "fr": {
        "1s": "je",
        "2s": "tu",
        "3s": "il",
        "1p": "nous",
        "2p": "vous",
        "3p": "ils",
    },
    "es": {
        "1s": "yo",
        "2s": "tú",
        "3s": "él",
        "1p": "nosotros",
        "2p": "vosotros",
        "3p": "ellos",
    },
}

_VOWELISH = tuple("aeiouyàâäéèêëîïôöùûüh")


def spoken_conjugation(
    person: str, form: str, mood: str, language: str = "fr"
) -> str:
    """Subject + verb as actually said: "je suis", "j'aime", "que je sois"."""
    if mood in ("imperatif", "imperativo") or not form:
        return form
    subject = SPOKEN_SUBJECTS.get(language, {}).get(person)
    if not subject:
        return form
    if language == "fr" and subject == "je" and form.lower().startswith(_VOWELISH):
        phrase = f"j'{form}"
    else:
        phrase = f"{subject} {form}"
    if mood == "subjonctif":
        return f"qu'{phrase}" if phrase[0] in "iî" else f"que {phrase}"
    if mood == "subjuntivo":
        return f"que {phrase}"
    return phrase


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _lang_code(value: str | Language) -> str:
    return str(getattr(value, "value", value))


def _local_today(tz_offset: int) -> date:
    """tz_offset is JS getTimezoneOffset(): minutes behind UTC (240 for EDT)."""
    return (_now() - timedelta(minutes=tz_offset)).date()


def _local_day(moment: datetime, tz_offset: int) -> date:
    return (moment - timedelta(minutes=tz_offset)).date()


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _week_bounds_utc(tz_offset: int) -> tuple[datetime, datetime]:
    """[start, end) of the current local ISO week, as UTC instants."""
    start_local = _week_start(_local_today(tz_offset))
    start = datetime.combine(start_local, datetime.min.time(), tzinfo=timezone.utc)
    start += timedelta(minutes=tz_offset)
    return start, start + timedelta(days=7)


# ---------------------------------------------------------------------------
# speak — generic tap-to-hear for any FR/ES text
# ---------------------------------------------------------------------------


@router.post("/speak", response_model=SpeakOut)
def speak(body: SpeakIn):
    """Cached TTS for arbitrary text; "" tells the client to use browser speech."""
    return SpeakOut(audio_url=tts.synthesize(body.language.value, body.text))


# ---------------------------------------------------------------------------
# decks
# ---------------------------------------------------------------------------


def _deck_counts(db: Session) -> dict[int, dict[str, int]]:
    now = _now()
    rows = db.execute(
        select(
            Flashcard.deck_id,
            func.count(Flashcard.id),
            func.count(Flashcard.id).filter(
                FlashcardReview.state != ReviewStateName.new, FlashcardReview.due <= now
            ),
            func.count(Flashcard.id).filter(
                FlashcardReview.state == ReviewStateName.new
            ),
        )
        .join(FlashcardReview, FlashcardReview.card_id == Flashcard.id)
        .group_by(Flashcard.deck_id)
    ).all()
    return {
        deck_id: {"card_count": total, "due_count": due, "new_count": new}
        for deck_id, total, due, new in rows
    }


def _deck_out(deck: FlashcardDeck, counts: dict[int, dict[str, int]]) -> DeckOut:
    c = counts.get(deck.id, {"card_count": 0, "due_count": 0, "new_count": 0})
    return DeckOut(
        id=deck.id,
        name=deck.name,
        language=deck.language,
        description=deck.description,
        tags=deck.tags,
        is_system=deck.is_system,
        created_at=deck.created_at,
        **c,
    )


def _list_decks(db: Session) -> list[DeckOut]:
    decks = (
        db.execute(select(FlashcardDeck).order_by(FlashcardDeck.is_system, FlashcardDeck.id))
        .scalars()
        .all()
    )
    counts = _deck_counts(db)
    return [_deck_out(d, counts) for d in decks]


@router.get("/decks", response_model=list[DeckOut])
def list_decks(db: Session = Depends(get_db)):
    return _list_decks(db)


@router.post("/decks", response_model=DeckOut, status_code=201)
def create_deck(body: DeckCreate, db: Session = Depends(get_db)):
    deck = FlashcardDeck(
        name=body.name,
        language=body.language,
        description=body.description.strip(),
        tags=body.tags,
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return _deck_out(deck, {})


@router.patch("/decks/{deck_id}", response_model=DeckOut)
def update_deck(deck_id: int, body: DeckUpdate, db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        deck.name = data["name"].strip()
    if "description" in data and data["description"] is not None:
        deck.description = data["description"].strip()
    if "tags" in data and data["tags"] is not None:
        deck.tags = data["tags"]
    db.commit()
    db.refresh(deck)
    return _deck_out(deck, _deck_counts(db))


@router.delete("/decks/{deck_id}", status_code=204)
def delete_deck(deck_id: int, db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.delete(deck)
    db.commit()


# ---------------------------------------------------------------------------
# cards
# ---------------------------------------------------------------------------


def _card_out(card: Flashcard) -> CardOut:
    r = card.review
    return CardOut(
        id=card.id,
        deck_id=card.deck_id,
        card_type=card.card_type,
        direction=card.direction,
        front=card.front,
        back=card.back,
        ipa=card.ipa,
        gender=card.gender,
        part_of_speech=card.part_of_speech,
        audio_url=card.audio_url,
        example=card.example,
        example_translation=card.example_translation,
        cognate_note=card.cognate_note,
        is_false_friend=card.is_false_friend,
        source=card.source,
        source_ref=card.source_ref,
        lexeme_id=card.lexeme_id,
        conjugation_id=card.conjugation_id,
        tags=card.tags,
        created_at=card.created_at,
        state=r.state,
        due=r.due,
        reps=r.reps,
        lapses=r.lapses,
        stability=r.stability,
    )


def _assign_card_lexeme(db: Session, card: Flashcard, language: str) -> None:
    target = enrich.target_word(card, language).strip()
    if target and len(target) <= 160 and card.source != CardSource.conjugation:
        card.lexeme = lexemes.maybe_get_or_create(db, language, target)


@router.get("/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(deck_id: int, db: Session = Depends(get_db)):
    if db.get(FlashcardDeck, deck_id) is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    cards = (
        db.execute(
            select(Flashcard)
            .options(selectinload(Flashcard.review))
            .where(Flashcard.deck_id == deck_id)
            .order_by(Flashcard.id.desc())
        )
        .scalars()
        .all()
    )
    return [_card_out(c) for c in cards]


@router.post("/cards", response_model=CardOut, status_code=201)
def create_card(body: CardCreate, db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, body.deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    card = Flashcard(
        deck_id=deck.id,
        card_type=body.card_type,
        direction=body.direction,
        front=body.front,
        back=body.back.strip(),
        ipa=body.ipa.strip(),
        gender=body.gender.strip(),
        part_of_speech=body.part_of_speech.strip(),
        example=body.example.strip(),
        example_translation=body.example_translation.strip(),
        cognate_note=body.cognate_note.strip(),
        tags=body.tags,
        source=CardSource.manual,
    )
    if body.enrich:
        enrich.enrich_card(db, card, _lang_code(deck.language))
    _assign_card_lexeme(db, card, _lang_code(deck.language))
    if "wiki" in body.tags and card.lexeme:
        duplicate = next(
            (
                location
                for location in lexemes.card_locations(db, card.lexeme)
                if location["deck_id"] == deck.id
            ),
            None,
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail=f"{card.lexeme.headword} is already in {duplicate['deck_name']}",
            )
    card.review = FlashcardReview()
    db.add(card)
    db.commit()
    db.refresh(card)
    return _card_out(card)


@router.patch("/cards/{card_id}", response_model=CardOut)
def update_card(card_id: int, body: CardUpdate, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    data = body.model_dump(exclude_unset=True)
    if "deck_id" in data and data["deck_id"] is not None:
        if db.get(FlashcardDeck, data["deck_id"]) is None:
            raise HTTPException(status_code=404, detail="Target deck not found")
    content_changed = any(k in data for k in ("front", "back", "card_type"))
    for key, value in data.items():
        if value is not None:
            setattr(card, key, value.strip() if isinstance(value, str) else value)
    if content_changed:
        card.audio_url = ""  # regenerate below — the word changed
        enrich.enrich_card(db, card, _lang_code(card.deck.language))
        _assign_card_lexeme(db, card, _lang_code(card.deck.language))
    db.commit()
    db.refresh(card)
    return _card_out(card)


@router.post("/cards/{card_id}/enrich", response_model=CardOut)
def reenrich_card(card_id: int, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    card.audio_url = ""
    enrich.enrich_card(db, card, _lang_code(card.deck.language))
    _assign_card_lexeme(db, card, _lang_code(card.deck.language))
    db.commit()
    db.refresh(card)
    return _card_out(card)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()


# ---------------------------------------------------------------------------
# study
# ---------------------------------------------------------------------------


@router.get("/study/queue", response_model=StudyQueue)
def study_queue(
    deck_id: int | None = None,
    verb_set_id: int | None = None,
    language: Language | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    new_limit: int = Query(default=10, ge=0, le=50),
    db: Session = Depends(get_db),
):
    """Due cards first (oldest due first), then up to `new_limit` new cards."""
    now = _now()

    def card_query():
        query = (
            select(Flashcard)
            .options(selectinload(Flashcard.review))
            .select_from(Flashcard)
            .join(FlashcardReview, FlashcardReview.card_id == Flashcard.id)
        )
        if deck_id is not None:
            query = query.where(Flashcard.deck_id == deck_id)
        if language is not None:
            query = query.join(
                FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id
            ).where(FlashcardDeck.language == language)
        if verb_set_id is not None:
            query = (
                query.join(
                    Conjugation, Conjugation.id == Flashcard.conjugation_id
                )
                .join(VerbSetMember, VerbSetMember.verb_id == Conjugation.verb_id)
                .where(VerbSetMember.set_id == verb_set_id)
            )
        return query

    def count_query():
        query = (
            select(func.count(FlashcardReview.id))
            .select_from(FlashcardReview)
            .join(Flashcard, Flashcard.id == FlashcardReview.card_id)
        )
        if deck_id is not None:
            query = query.where(Flashcard.deck_id == deck_id)
        if language is not None:
            query = query.join(
                FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id
            ).where(FlashcardDeck.language == language)
        if verb_set_id is not None:
            query = (
                query.join(
                    Conjugation, Conjugation.id == Flashcard.conjugation_id
                )
                .join(VerbSetMember, VerbSetMember.verb_id == Conjugation.verb_id)
                .where(VerbSetMember.set_id == verb_set_id)
            )
        return query

    due_rows = (
        db.execute(
            card_query()
            .where(FlashcardReview.state != ReviewStateName.new)
            .where(FlashcardReview.due <= now)
            .order_by(FlashcardReview.due)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    new_rows = (
        db.execute(
            card_query()
            .where(FlashcardReview.state == ReviewStateName.new)
            .order_by(Flashcard.id)
            .limit(new_limit)
        )
        .scalars()
        .all()
    )
    due_count = count_query().where(
        FlashcardReview.state != ReviewStateName.new, FlashcardReview.due <= now
    )
    new_count = count_query().where(
        FlashcardReview.state == ReviewStateName.new
    )
    return StudyQueue(
        cards=[_card_out(c) for c in [*due_rows, *new_rows]],
        due_count=db.execute(due_count).scalar_one(),
        new_count=db.execute(new_count).scalar_one(),
    )


@router.post("/study/review", response_model=ReviewOut)
def review_card(body: ReviewIn, db: Session = Depends(get_db)):
    card = db.get(Flashcard, body.card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    review = card.review
    state_before = review.state
    now = _now()
    grade(review, body.rating, now)
    db.add(
        ReviewLog(
            card_id=card.id,
            language=card.deck.language,
            rating=body.rating,
            state=state_before,
            reviewed_at=now,
        )
    )
    db.commit()
    return ReviewOut(
        card_id=card.id,
        state=review.state,
        due=review.due,
        again_soon=review.due - now < timedelta(minutes=20),
    )


# ---------------------------------------------------------------------------
# tasks
# ---------------------------------------------------------------------------


def _materialize_daily_tasks(db: Session, today: date) -> None:
    """Create today's instance for each daily template that lacks one."""
    templates = (
        db.execute(
            select(LanguageTask).where(
                LanguageTask.recurrence == "daily", LanguageTask.template_id.is_(None)
            )
        )
        .scalars()
        .all()
    )
    if not templates:
        return
    existing = set(
        db.execute(
            select(LanguageTask.template_id).where(LanguageTask.task_date == today)
        )
        .scalars()
        .all()
    )
    for tpl in templates:
        if tpl.id not in existing:
            db.add(
                LanguageTask(
                    text=tpl.text,
                    task_date=today,
                    template_id=tpl.id,
                    action_ref=tpl.action_ref,
                )
            )
    db.commit()


def _today_tasks(db: Session, today: date) -> list[LanguageTask]:
    _materialize_daily_tasks(db, today)
    return (
        db.execute(
            select(LanguageTask)
            .where(
                LanguageTask.template_id.isnot(None)
                & (LanguageTask.task_date == today)
                | (LanguageTask.recurrence == "")
                & LanguageTask.template_id.is_(None)
                & (LanguageTask.task_date.is_(None) | (LanguageTask.task_date == today))
                & ~LanguageTask.done
            )
            .order_by(LanguageTask.id)
        )
        .scalars()
        .all()
    )


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(tz_offset: int = 0, db: Session = Depends(get_db)):
    return [TaskOut.model_validate(t) for t in _today_tasks(db, _local_today(tz_offset))]


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    task = LanguageTask(
        text=body.text,
        task_date=body.task_date,
        recurrence=body.recurrence if body.recurrence == "daily" else "",
        action_ref=body.action_ref.strip(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(LanguageTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    data = body.model_dump(exclude_unset=True)
    if "text" in data and data["text"]:
        task.text = data["text"].strip()
    if "done" in data and data["done"] is not None:
        task.done = data["done"]
    if "action_ref" in data and data["action_ref"] is not None:
        task.action_ref = data["action_ref"].strip()
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(LanguageTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)  # deleting a template cascades to its instances
    db.commit()


# ---------------------------------------------------------------------------
# targets
# ---------------------------------------------------------------------------


def _target_current(
    db: Session, target: LanguageTarget, tz_offset: int, week_key: str
) -> int:
    start, end = _week_bounds_utc(tz_offset)
    if not target.auto:
        return target.manual_count if target.week_key == week_key else 0
    logs_this_week = (
        select(func.count(ReviewLog.id))
        .where(ReviewLog.reviewed_at >= start)
        .where(ReviewLog.reviewed_at < end)
    )
    if target.metric == "reviews":
        return db.execute(logs_this_week).scalar_one()
    if target.metric in ("fr_reviews", "es_reviews"):
        lang = Language.fr if target.metric == "fr_reviews" else Language.es
        return db.execute(logs_this_week.where(ReviewLog.language == lang)).scalar_one()
    if target.metric == "new_cards":
        return db.execute(
            select(func.count(Flashcard.id))
            .where(Flashcard.created_at >= start)
            .where(Flashcard.created_at < end)
        ).scalar_one()
    if target.metric == "cards_matured":
        return db.execute(
            select(func.count(FlashcardReview.id))
            .where(FlashcardReview.stability >= MATURE_STABILITY_DAYS)
            .where(FlashcardReview.last_review >= start)
            .where(FlashcardReview.last_review < end)
        ).scalar_one()
    return 0


def _week_key(tz_offset: int) -> str:
    today = _local_today(tz_offset)
    iso = today.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _target_out(db: Session, t: LanguageTarget, tz_offset: int) -> TargetOut:
    return TargetOut(
        id=t.id,
        metric=t.metric,
        label=t.label,
        target=t.target,
        auto=t.auto,
        current=_target_current(db, t, tz_offset, _week_key(tz_offset)),
    )


@router.get("/targets", response_model=list[TargetOut])
def list_targets(tz_offset: int = 0, db: Session = Depends(get_db)):
    targets = (
        db.execute(select(LanguageTarget).order_by(LanguageTarget.id)).scalars().all()
    )
    return [_target_out(db, t, tz_offset) for t in targets]


@router.post("/targets", response_model=TargetOut, status_code=201)
def create_target(body: TargetCreate, tz_offset: int = 0, db: Session = Depends(get_db)):
    if db.execute(
        select(LanguageTarget).where(LanguageTarget.metric == body.metric)
    ).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Metric already has a target")
    target = LanguageTarget(
        metric=body.metric.strip(),
        label=body.label.strip(),
        target=body.target,
        auto=body.auto,
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return _target_out(db, target, tz_offset)


@router.patch("/targets/{target_id}", response_model=TargetOut)
def update_target(
    target_id: int, body: TargetUpdate, tz_offset: int = 0, db: Session = Depends(get_db)
):
    target = db.get(LanguageTarget, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    data = body.model_dump(exclude_unset=True)
    if "label" in data and data["label"]:
        target.label = data["label"].strip()
    if "target" in data and data["target"]:
        target.target = data["target"]
    db.commit()
    db.refresh(target)
    return _target_out(db, target, tz_offset)


@router.post("/targets/{target_id}/tick", response_model=TargetOut)
def tick_target(
    target_id: int,
    delta: int = Query(default=1, ge=-1, le=1),
    tz_offset: int = 0,
    db: Session = Depends(get_db),
):
    """Bump a manual target's weekly count (resets when the week rolls over)."""
    target = db.get(LanguageTarget, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    if target.auto:
        raise HTTPException(status_code=400, detail="Auto targets track themselves")
    week = _week_key(tz_offset)
    if target.week_key != week:
        target.week_key = week
        target.manual_count = 0
    target.manual_count = max(0, target.manual_count + delta)
    db.commit()
    db.refresh(target)
    return _target_out(db, target, tz_offset)


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(target_id: int, db: Session = Depends(get_db)):
    target = db.get(LanguageTarget, target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    db.delete(target)
    db.commit()


# ---------------------------------------------------------------------------
# dashboard
# ---------------------------------------------------------------------------


@router.get("/dashboard", response_model=LanguageDashboard)
def dashboard(tz_offset: int = 0, db: Session = Depends(get_db)):
    now = _now()
    today = _local_today(tz_offset)

    # --- review-log driven stats (streak, heatmap, retention, guardrail)
    since = now - timedelta(days=190)
    logs = db.execute(
        select(ReviewLog.reviewed_at, ReviewLog.language, ReviewLog.rating, ReviewLog.state)
        .where(ReviewLog.reviewed_at >= since)
        .order_by(ReviewLog.reviewed_at)
    ).all()

    by_day: dict[date, int] = {}
    for reviewed_at, _, _, _ in logs:
        day = _local_day(reviewed_at, tz_offset)
        by_day[day] = by_day.get(day, 0) + 1

    streak = 0
    cursor = today
    if cursor not in by_day:
        cursor -= timedelta(days=1)  # today isn't studied yet — don't break it
    while cursor in by_day:
        streak += 1
        cursor -= timedelta(days=1)

    heatmap = [
        HeatmapDay(day=d, count=by_day.get(d, 0))
        for d in (today - timedelta(days=i) for i in range(181, -1, -1))
    ]

    retention: dict[str, float | None] = {}
    cutoff_30 = now - timedelta(days=30)
    for lang in (Language.fr, Language.es):
        graded = [
            rating
            for reviewed_at, language, rating, state in logs
            if language == lang
            and reviewed_at >= cutoff_30
            and state in (ReviewStateName.review, ReviewStateName.relearning)
        ]
        retention[lang.value] = (
            round(sum(1 for r in graded if r > 1) / len(graded), 4) if graded else None
        )

    week_start, week_end = _week_bounds_utc(tz_offset)
    es_week = sum(
        1
        for reviewed_at, language, _, _ in logs
        if language == Language.es and week_start <= reviewed_at < week_end
    )
    floor_target = db.execute(
        select(LanguageTarget).where(LanguageTarget.metric == "es_reviews")
    ).scalar_one_or_none()
    floor = floor_target.target if floor_target else DEFAULT_ES_FLOOR

    reviews_today = by_day.get(today, 0)

    # --- card counts by language
    end_of_today_utc = datetime.combine(
        today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
    ) + timedelta(minutes=tz_offset)
    counts = {
        "due": {"fr": 0, "es": 0},
        "new": {"fr": 0, "es": 0},
        "total": {"fr": 0, "es": 0},
        "mature": {"fr": 0, "es": 0},
    }
    rows = db.execute(
        select(
            FlashcardDeck.language,
            func.count(Flashcard.id),
            func.count(Flashcard.id).filter(
                FlashcardReview.state != ReviewStateName.new,
                FlashcardReview.due < end_of_today_utc,
            ),
            func.count(Flashcard.id).filter(
                FlashcardReview.state == ReviewStateName.new
            ),
            func.count(Flashcard.id).filter(
                FlashcardReview.stability >= MATURE_STABILITY_DAYS
            ),
        )
        .select_from(Flashcard)
        .join(FlashcardDeck, FlashcardDeck.id == Flashcard.deck_id)
        .join(FlashcardReview, FlashcardReview.card_id == Flashcard.id)
        .group_by(FlashcardDeck.language)
    ).all()
    for lang, total, due, new, mature in rows:
        code = _lang_code(lang)
        counts["total"][code] = total
        counts["due"][code] = due
        counts["new"][code] = new
        counts["mature"][code] = mature

    targets = (
        db.execute(select(LanguageTarget).order_by(LanguageTarget.id)).scalars().all()
    )

    return LanguageDashboard(
        streak_days=streak,
        reviews_today=reviews_today,
        due_today=LanguageSplit(**counts["due"]),
        new_cards=LanguageSplit(**counts["new"]),
        total_cards=LanguageSplit(**counts["total"]),
        mature_cards=LanguageSplit(**counts["mature"]),
        retention_30d=RetentionOut(fr=retention["fr"], es=retention["es"]),
        guardrail=GuardrailOut(es_reviews_this_week=es_week, floor=floor),
        tasks=[TaskOut.model_validate(t) for t in _today_tasks(db, today)],
        targets=[_target_out(db, t, tz_offset) for t in targets],
        heatmap=heatmap,
        decks=_list_decks(db),
    )


# ---------------------------------------------------------------------------
# text library + annotations
# ---------------------------------------------------------------------------


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


def _lexique_row(db: Session, word: str) -> LexiqueEntry | None:
    return db.execute(
        select(LexiqueEntry)
        .where(func.lower(LexiqueEntry.word) == word.lower())
        .order_by(LexiqueEntry.frequency.desc())
        .limit(1)
    ).scalar_one_or_none()


def _lexique_gender(db: Session, language: Language, word: str) -> str:
    """Offline gender fallback (French only — Lexique is a French database)."""
    if language != Language.fr:
        return ""
    row = _lexique_row(db, word)
    return row.gender if row else ""


def _lookup_annotation_text(
    db: Session, language: str | Language, selected_text: str
) -> TextLookupOut:
    language_code = _lang_code(language)
    selected = selected_text.strip()
    found = None
    provider = "manual_needed"
    matched_term = ""
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
        gender = _lexique_gender(db, Language(language_code), resolution.headword)

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


@router.get("/texts", response_model=list[LanguageTextOut])
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


@router.get("/texts/{text_id}", response_model=LanguageTextDetail)
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
    result = _lookup_annotation_text(db, text.language, body.selected_text)
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
            lexemes.maybe_get_or_create(db, _lang_code(text.language), body.headword)
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
                db, _lang_code(annotation.text.language), headword
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

    card_lexeme = lexemes.maybe_get_or_create(db, _lang_code(deck.language), front)
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
        enrich.enrich_card(db, card, _lang_code(deck.language))
    card.review = FlashcardReview()
    db.add(card)
    db.flush()
    annotation.deck_id = deck.id
    annotation.flashcard_id = card.id
    db.commit()
    db.refresh(card)
    return _card_out(card)


# ---------------------------------------------------------------------------
# wiki — look up any word
# ---------------------------------------------------------------------------

_WIKI_STRIP = ".,;:!?¡¿()[]{}\"'“”‘’«» "
_INFINITIVE_ENDINGS = {
    Language.fr: ("er", "ir", "re", "oir"),
    Language.es: ("ar", "er", "ir"),
}


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
            cached.fetched_at = _now()
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
    cleaned = translated.strip().lower().strip(_WIKI_STRIP)
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
    term = word.strip().lower().strip(_WIKI_STRIP)
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
        gender = _lexique_gender(db, language, term)
    ipa = next((e.ipa for e in entries if e.ipa), "")

    lexique = _lexique_row(db, term) if language == Language.fr else None
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
        and headword.endswith(_INFINITIVE_ENDINGS[language])
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


# ---------------------------------------------------------------------------
# conjugation center
# ---------------------------------------------------------------------------


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


def _verb_out(db: Session, verb: Verb) -> VerbOut:
    equivalent = _related_verb(db, verb)
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
        set_ids=_verb_set_ids(db, verb.id),
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
    ).strip().lower().strip(_WIKI_STRIP)
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
    if not translated.endswith(_INFINITIVE_ENDINGS[Language(target_language)]):
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


@router.get("/verbs", response_model=list[VerbOut])
def list_verbs(
    language: Language = Language.fr,
    db: Session = Depends(get_db),
):
    verbs = db.execute(
        select(Verb)
        .where(Verb.language == language.value)
        .order_by(Verb.frequency_rank, Verb.infinitive)
    ).scalars().all()
    return [_verb_out(db, verb) for verb in verbs]


@router.get("/verbs/{verb_id}", response_model=VerbDetail)
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


@router.get("/verb-sets", response_model=list[VerbSetOut])
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


@router.post("/conjugations/{conjugation_id}/audio", response_model=ConjugationAudioOut)
def conjugation_audio(conjugation_id: int, db: Session = Depends(get_db)):
    """Lazy tap-to-hear: synthesize + cache the cell's audio on first request."""
    conj = db.get(Conjugation, conjugation_id)
    if conj is None:
        raise HTTPException(status_code=404, detail="Conjugation not found")
    if not conj.audio_url:
        language = conj.verb.language
        conj.audio_url = tts.synthesize(
            language,
            spoken_conjugation(conj.person, conj.form, conj.mood, language),
        )
        db.commit()
    return ConjugationAudioOut(id=conj.id, audio_url=conj.audio_url)


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
    return _deck_out(deck, _deck_counts(db))
