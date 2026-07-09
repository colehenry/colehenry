from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import CardDirection, CardSource, CardType, Language, ReviewStateName

# ---------------------------------------------------------------------------
# decks
# ---------------------------------------------------------------------------


class DeckOut(BaseModel):
    id: int
    name: str
    language: Language
    description: str
    tags: list[str]
    is_system: bool
    created_at: datetime
    card_count: int
    due_count: int
    new_count: int


class DeckCreate(BaseModel):
    name: str
    language: Language
    description: str = ""
    tags: list[str] = []

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("deck name is required")
        return value


class DeckUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None


# ---------------------------------------------------------------------------
# cards
# ---------------------------------------------------------------------------


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    card_type: CardType
    direction: CardDirection
    front: str
    back: str
    ipa: str
    gender: str
    part_of_speech: str
    audio_url: str
    example: str
    example_translation: str
    cognate_note: str
    is_false_friend: bool
    source: CardSource
    source_ref: str
    tags: list[str]
    created_at: datetime
    # flattened review state
    state: ReviewStateName
    due: datetime
    reps: int
    lapses: int
    stability: float | None


class CardCreate(BaseModel):
    deck_id: int
    front: str
    back: str = ""
    card_type: CardType = CardType.basic
    direction: CardDirection = CardDirection.recognition
    ipa: str = ""
    gender: str = ""
    part_of_speech: str = ""
    example: str = ""
    example_translation: str = ""
    cognate_note: str = ""
    tags: list[str] = []
    enrich: bool = True

    @field_validator("front")
    @classmethod
    def front_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("card front is required")
        return value


class CardUpdate(BaseModel):
    front: str | None = None
    back: str | None = None
    card_type: CardType | None = None
    direction: CardDirection | None = None
    ipa: str | None = None
    gender: str | None = None
    part_of_speech: str | None = None
    example: str | None = None
    example_translation: str | None = None
    cognate_note: str | None = None
    is_false_friend: bool | None = None
    tags: list[str] | None = None
    deck_id: int | None = None


# ---------------------------------------------------------------------------
# study
# ---------------------------------------------------------------------------


class StudyQueue(BaseModel):
    cards: list[CardOut]
    due_count: int
    new_count: int


class ReviewIn(BaseModel):
    card_id: int
    rating: int = Field(ge=1, le=4)


class ReviewOut(BaseModel):
    card_id: int
    state: ReviewStateName
    due: datetime
    # True when the card comes back later in this same session (learning steps)
    again_soon: bool


# ---------------------------------------------------------------------------
# dashboard
# ---------------------------------------------------------------------------


class LanguageSplit(BaseModel):
    fr: int
    es: int


class RetentionOut(BaseModel):
    fr: float | None
    es: float | None


class GuardrailOut(BaseModel):
    es_reviews_this_week: int
    floor: int


class HeatmapDay(BaseModel):
    day: date
    count: int


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    done: bool
    task_date: date | None
    recurrence: str
    template_id: int | None
    action_ref: str


class TaskCreate(BaseModel):
    text: str
    task_date: date | None = None
    recurrence: str = ""  # "" | "daily"
    action_ref: str = ""

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("task text is required")
        return value


class TaskUpdate(BaseModel):
    text: str | None = None
    done: bool | None = None
    action_ref: str | None = None


class TargetOut(BaseModel):
    id: int
    metric: str
    label: str
    target: int
    auto: bool
    current: int


class TargetCreate(BaseModel):
    metric: str
    label: str
    target: int = Field(gt=0)
    auto: bool = True


class TargetUpdate(BaseModel):
    label: str | None = None
    target: int | None = Field(default=None, gt=0)


class LanguageDashboard(BaseModel):
    streak_days: int
    reviews_today: int
    due_today: LanguageSplit
    new_cards: LanguageSplit
    total_cards: LanguageSplit
    mature_cards: LanguageSplit
    retention_30d: RetentionOut
    guardrail: GuardrailOut
    tasks: list[TaskOut]
    targets: list[TargetOut]
    heatmap: list[HeatmapDay]
    decks: list[DeckOut]


# ---------------------------------------------------------------------------
# text library + annotations
# ---------------------------------------------------------------------------


class TextAnnotationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text_id: int
    start_offset: int
    end_offset: int
    selected_text: str
    kind: str
    color: str
    note: str
    translation: str
    ipa: str
    part_of_speech: str
    cognate_note: str
    is_false_friend: bool
    deck_id: int | None
    flashcard_id: int | None
    created_at: datetime
    updated_at: datetime


class LanguageTextOut(BaseModel):
    id: int
    title: str
    language: Language
    source_type: str
    source_ref: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    annotation_count: int


class LanguageTextDetail(LanguageTextOut):
    content: str
    annotations: list[TextAnnotationOut]


class LanguageTextCreate(BaseModel):
    title: str
    language: Language
    content: str
    source_type: str = "other"
    source_ref: str = ""
    tags: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title is required")
        return value

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text content is required")
        return value


class LanguageTextUpdate(BaseModel):
    title: str | None = None
    language: Language | None = None
    content: str | None = None
    source_type: str | None = None
    source_ref: str | None = None
    tags: list[str] | None = None


class TextAnnotationCreate(BaseModel):
    start_offset: int = Field(ge=0)
    end_offset: int = Field(gt=0)
    selected_text: str = ""
    kind: str = "highlight"
    color: str = "brand"
    note: str = ""
    translation: str = ""
    ipa: str = ""
    part_of_speech: str = ""
    cognate_note: str = ""
    is_false_friend: bool = False


class TextAnnotationUpdate(BaseModel):
    start_offset: int | None = Field(default=None, ge=0)
    end_offset: int | None = Field(default=None, gt=0)
    selected_text: str | None = None
    kind: str | None = None
    color: str | None = None
    note: str | None = None
    translation: str | None = None
    ipa: str | None = None
    part_of_speech: str | None = None
    cognate_note: str | None = None
    is_false_friend: bool | None = None


class TextLookupIn(BaseModel):
    selected_text: str

    @field_validator("selected_text")
    @classmethod
    def selected_text_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("selected text is required")
        return value


class TextLookupOut(BaseModel):
    selected_text: str
    translation: str
    ipa: str
    part_of_speech: str
    cognate_note: str
    is_false_friend: bool
    provider: str


class AnnotationCardCreate(BaseModel):
    deck_id: int
    front: str = ""
    back: str = ""
    card_type: CardType = CardType.basic
    direction: CardDirection = CardDirection.recognition
    tags: list[str] = Field(default_factory=list)
    enrich: bool = True


# ---------------------------------------------------------------------------
# conjugation center
# ---------------------------------------------------------------------------


class VerbOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    infinitive: str
    group: str
    is_irregular: bool
    translation: str
    es_equivalent: str
    frequency_rank: int


class ConjugationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mood: str
    tense: str
    person: str
    form: str
    es_form: str
    audio_url: str


class VerbDetail(VerbOut):
    conjugations: list[ConjugationOut]


class ConjugationAudioOut(BaseModel):
    id: int
    audio_url: str


class DrillCreate(BaseModel):
    """Generate cell-level cloze cards into a per-tense system deck."""

    mood: str
    tense: str
    verb_ids: list[int] = []  # empty = use group/irregular filters
    group: str = ""  # "-er" | "-ir" | "-re" | "irregular" | ""
    irregular_only: bool = False
    audio_first: bool = False
