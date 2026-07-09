import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Language(str, enum.Enum):
    es = "es"
    fr = "fr"


class CardType(str, enum.Enum):
    basic = "basic"
    cloze = "cloze"
    audio = "audio"  # audio-first: hear it → produce it


class CardDirection(str, enum.Enum):
    recognition = "recognition"  # target language → English/Spanish
    production = "production"  # prompt → produce the target-language form


class CardSource(str, enum.Enum):
    manual = "manual"
    paste = "paste"
    kobo = "kobo"
    youtube = "youtube"
    lyric = "lyric"
    conjugation = "conjugation"
    system = "system"  # seeded content (minimal pairs, primer drills)


class ReviewStateName(str, enum.Enum):
    new = "new"
    learning = "learning"
    review = "review"
    relearning = "relearning"


class FlashcardDeck(Base):
    __tablename__ = "flashcard_decks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    language: Mapped[Language] = mapped_column(
        Enum(Language, name="language_code"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    # System decks are generated (conjugation drills, minimal pairs); they can
    # be studied and their cards deleted, but the deck itself isn't editable.
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    cards: Mapped[list["Flashcard"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan"
    )
    text_annotations: Mapped[list["LanguageTextAnnotation"]] = relationship(
        back_populates="deck"
    )


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(primary_key=True)
    deck_id: Mapped[int] = mapped_column(
        ForeignKey("flashcard_decks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    card_type: Mapped[CardType] = mapped_column(
        Enum(CardType, name="card_type"), default=CardType.basic, nullable=False
    )
    direction: Mapped[CardDirection] = mapped_column(
        Enum(CardDirection, name="card_direction"),
        default=CardDirection.recognition,
        nullable=False,
    )
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    ipa: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    gender: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    part_of_speech: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    audio_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    example: Mapped[str] = mapped_column(Text, default="", nullable=False)
    example_translation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    cognate_note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_false_friend: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[CardSource] = mapped_column(
        Enum(CardSource, name="card_source"), default=CardSource.manual, nullable=False
    )
    source_ref: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    deck: Mapped[FlashcardDeck] = relationship(back_populates="cards")
    review: Mapped["FlashcardReview"] = relationship(
        back_populates="card", cascade="all, delete-orphan", uselist=False
    )
    logs: Mapped[list["ReviewLog"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )
    text_annotations: Mapped[list["LanguageTextAnnotation"]] = relationship(
        back_populates="flashcard"
    )


class FlashcardReview(Base):
    """FSRS scheduling state — one row per card (py-fsrs Card fields)."""

    __tablename__ = "flashcard_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    state: Mapped[ReviewStateName] = mapped_column(
        Enum(ReviewStateName, name="review_state"),
        default=ReviewStateName.new,
        nullable=False,
    )
    step: Mapped[int | None] = mapped_column(Integer)
    stability: Mapped[float | None] = mapped_column(Float)
    difficulty: Mapped[float | None] = mapped_column(Float)
    due: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    last_review: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lapses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    card: Mapped[Flashcard] = relationship(back_populates="review")


class ReviewLog(Base):
    """One row per graded review — feeds streak/retention/heatmap stats."""

    __tablename__ = "review_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    language: Mapped[Language] = mapped_column(
        Enum(Language, name="language_code", create_type=False), nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–4 (FSRS)
    # State the card was in when graded — retention counts review-state cards.
    state: Mapped[ReviewStateName] = mapped_column(
        Enum(ReviewStateName, name="review_state", create_type=False), nullable=False
    )
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    card: Mapped[Flashcard] = relationship(back_populates="logs")


class FalseFriend(Base):
    """Curated ES↔FR faux-amis list, seeded via app.seed_language."""

    __tablename__ = "false_friends"

    id: Mapped[int] = mapped_column(primary_key=True)
    fr: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    es: Mapped[str] = mapped_column(String(80), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)


class LanguageTask(Base):
    """Daily checklist. Rows with a recurrence are templates (no date);
    dated instances are generated from them on dashboard load."""

    __tablename__ = "language_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(String(300), nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    task_date: Mapped[date | None] = mapped_column(Date, index=True)
    recurrence: Mapped[str] = mapped_column(String(20), default="", nullable=False)  # ""|daily
    template_id: Mapped[int | None] = mapped_column(
        ForeignKey("language_tasks.id", ondelete="CASCADE")
    )
    # e.g. "study:fr:20" — makes the task startable in-app and auto-checkable
    action_ref: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (UniqueConstraint("template_id", "task_date"),)


class LanguageTarget(Base):
    """Weekly targets. Auto metrics are computed from review logs/cards;
    manual ones are ticked by hand (count resets when week_key rolls over)."""

    __tablename__ = "language_targets"

    id: Mapped[int] = mapped_column(primary_key=True)
    metric: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    target: Mapped[int] = mapped_column(Integer, nullable=False)
    auto: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    manual_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    week_key: Mapped[str] = mapped_column(String(10), default="", nullable=False)


class LanguageText(Base):
    """Stored long-form text for annotation-driven vocabulary capture."""

    __tablename__ = "language_texts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    language: Mapped[Language] = mapped_column(
        Enum(Language, name="language_code", create_type=False), nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(40), default="other", nullable=False)
    source_ref: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    annotations: Mapped[list["LanguageTextAnnotation"]] = relationship(
        back_populates="text",
        cascade="all, delete-orphan",
        order_by="LanguageTextAnnotation.start_offset",
    )


class LanguageTextAnnotation(Base):
    """A highlighted word/phrase plus lookup/manual study notes."""

    __tablename__ = "language_text_annotations"
    __table_args__ = (
        Index("ix_language_text_annotations_text_span", "text_id", "start_offset"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    text_id: Mapped[int] = mapped_column(
        ForeignKey("language_texts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    end_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_text: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(30), default="highlight", nullable=False)
    color: Mapped[str] = mapped_column(String(30), default="brand", nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    translation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    ipa: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    gender: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    part_of_speech: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    cognate_note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_false_friend: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deck_id: Mapped[int | None] = mapped_column(
        ForeignKey("flashcard_decks.id", ondelete="SET NULL")
    )
    flashcard_id: Mapped[int | None] = mapped_column(
        ForeignKey("flashcards.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    text: Mapped[LanguageText] = relationship(back_populates="annotations")
    deck: Mapped[FlashcardDeck | None] = relationship(back_populates="text_annotations")
    flashcard: Mapped[Flashcard | None] = relationship(back_populates="text_annotations")


class WikiEntry(Base):
    """Cached dictionary payload for a wiki word lookup (one row per word)."""

    __tablename__ = "wiki_entries"
    __table_args__ = (UniqueConstraint("language", "word"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    language: Mapped[Language] = mapped_column(
        Enum(Language, name="language_code", create_type=False), nullable=False
    )
    word: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TranslationCache(Base):
    """One-time EN→FR/ES machine translations of wiki definitions."""

    __tablename__ = "translation_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    digest: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    target_lang: Mapped[str] = mapped_column(String(5), nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    translated: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LexiqueEntry(Base):
    """Lexique 3.83 lemma rows — offline gender + frequency for French."""

    __tablename__ = "lexique_entries"
    __table_args__ = (Index("ix_lexique_entries_word", "word"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    word: Mapped[str] = mapped_column(String(120), nullable=False)
    lemma: Mapped[str] = mapped_column(String(120), nullable=False)
    pos: Mapped[str] = mapped_column(String(30), nullable=False)  # Lexique cgram
    gender: Mapped[str] = mapped_column(String(4), default="", nullable=False)  # m|f
    # films subtitle frequency per million words — proxy for "how common"
    frequency: Mapped[float] = mapped_column(Float, default=0, nullable=False)


class Verb(Base):
    """Top ~100 French verbs, seeded at build time via scripts/seed_verbs.py."""

    __tablename__ = "verbs"

    id: Mapped[int] = mapped_column(primary_key=True)
    infinitive: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    group: Mapped[str] = mapped_column(String(20), nullable=False)  # -er|-ir|-re|irregular
    is_irregular: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    translation: Mapped[str] = mapped_column(String(120), nullable=False)
    es_equivalent: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    frequency_rank: Mapped[int] = mapped_column(Integer, nullable=False)

    conjugations: Mapped[list["Conjugation"]] = relationship(
        back_populates="verb", cascade="all, delete-orphan"
    )


class Conjugation(Base):
    __tablename__ = "conjugations"
    __table_args__ = (UniqueConstraint("verb_id", "mood", "tense", "person"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    verb_id: Mapped[int] = mapped_column(
        ForeignKey("verbs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mood: Mapped[str] = mapped_column(String(30), nullable=False)
    tense: Mapped[str] = mapped_column(String(40), nullable=False)
    person: Mapped[str] = mapped_column(String(20), nullable=False)  # je|tu|il|nous|vous|ils
    form: Mapped[str] = mapped_column(String(120), nullable=False)
    es_form: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    audio_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    verb: Mapped[Verb] = relationship(back_populates="conjugations")
