"""French learning hub — learner state on top of the curated curriculum.

The curriculum itself (sprints, vocab, verbs, pronunciation banks) is Python
in `app/curriculum`; these tables hold what only the learner produces:
vocabulary status + mastery dimensions, every exercise result, cached
LLM generations, session plans, mastery tests, and the interference log.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.types import PortableJSONB


class LearningState(Base):
    """Single-row learner settings (active sprint etc.)."""

    __tablename__ = "learning_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    active_sprint: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    settings: Mapped[dict] = mapped_column(PortableJSONB, default=dict, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class LearningVocab(Base):
    """One lexical item with its status and per-dimension mastery.

    Curriculum items are synced from `app.curriculum.vocab` (curriculum_id set);
    imported / text-mined items have curriculum_id NULL. Mastery columns are
    exponential moving averages in [0, 1] updated by every result that names
    the item (SRS reviews included).
    """

    __tablename__ = "learning_vocab"
    __table_args__ = (Index("ix_learning_vocab_sprint_status", "sprint", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    curriculum_id: Mapped[str | None] = mapped_column(String(80), unique=True)
    french: Mapped[str] = mapped_column(String(160), nullable=False)
    spanish: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    english: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    part_of_speech: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    gender: Mapped[str] = mapped_column(String(8), default="", nullable=False)
    ipa: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    sprint: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="core", nullable=False)  # core | recognition | encountered
    frequency_band: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    example_fr: Mapped[str] = mapped_column(Text, default="", nullable=False)
    example_es: Mapped[str] = mapped_column(Text, default="", nullable=False)
    pattern: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    spanish_connection: Mapped[str] = mapped_column(Text, default="", nullable=False)
    pronunciation_warning: Mapped[str] = mapped_column(Text, default="", nullable=False)
    cognate_type: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    false_friend: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reference_links: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    tags: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="curriculum", nullable=False)  # curriculum | import | text | manual
    text_id: Mapped[int | None] = mapped_column(ForeignKey("language_texts.id", ondelete="SET NULL"))
    lexeme_id: Mapped[int | None] = mapped_column(ForeignKey("language_lexemes.id", ondelete="SET NULL"))
    # mastery dimensions (EMA, 0–1)
    recognition: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    audio_recognition: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    written_production: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    spoken_production: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    contextual_use: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class LearningResult(Base):
    """One graded attempt at anything — deterministic drill, LLM drill, SRS
    review, self-rated task, external resource, mastery-test item."""

    __tablename__ = "learning_results"
    __table_args__ = (
        Index("ix_learning_results_sprint_time", "sprint", "occurred_at"),
        Index("ix_learning_results_format", "format"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    sprint: Mapped[int] = mapped_column(Integer, nullable=False)
    activity_id: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    format: Mapped[str] = mapped_column(String(40), nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="deterministic", nullable=False)  # deterministic|llm|static|srs|self|external|test
    skill: Mapped[str] = mapped_column(String(20), nullable=False)
    target_ids: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    dims: Mapped[dict] = mapped_column(PortableJSONB, default=dict, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, default="", nullable=False)
    answer: Mapped[str] = mapped_column(Text, default="", nullable=False)
    expected: Mapped[str] = mapped_column(Text, default="", nullable=False)
    time_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    generated_id: Mapped[int | None] = mapped_column(ForeignKey("learning_generated.id", ondelete="SET NULL"))
    session_id: Mapped[int | None] = mapped_column(ForeignKey("learning_sessions.id", ondelete="SET NULL"))
    test_id: Mapped[int | None] = mapped_column(ForeignKey("learning_tests.id", ondelete="SET NULL"))
    meta: Mapped[dict] = mapped_column(PortableJSONB, default=dict, nullable=False)


class LearningGenerated(Base):
    """Validated LLM-generated exercise, cached for reuse after spacing."""

    __tablename__ = "learning_generated"
    __table_args__ = (Index("ix_learning_generated_lookup", "format", "sprint", "params_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    params_hash: Mapped[str] = mapped_column(String(40), nullable=False)
    format: Mapped[str] = mapped_column(String(40), nullable=False)
    sprint: Mapped[int] = mapped_column(Integer, nullable=False)
    targets: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    model: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    prompt_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    payload: Mapped[dict] = mapped_column(PortableJSONB, nullable=False)
    valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    served_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_served_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class LearningSession(Base):
    """A composed study session (rules or LLM) and what got done in it."""

    __tablename__ = "learning_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sprint: Mapped[int] = mapped_column(Integer, nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="rules", nullable=False)  # rules | llm
    plan: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    completed: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LearningTest(Base):
    """A sprint mastery-test attempt: the generated test, answers, profile."""

    __tablename__ = "learning_tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    sprint: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict] = mapped_column(PortableJSONB, nullable=False)
    scores: Mapped[dict] = mapped_column(PortableJSONB, default=dict, nullable=False)
    profile: Mapped[dict] = mapped_column(PortableJSONB, default=dict, nullable=False)
    readiness: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weak: Mapped[list] = mapped_column(PortableJSONB, default=list, nullable=False)


class LearningInterference(Base):
    """Personal Interference Log — Spanish-driven errors that recur."""

    __tablename__ = "learning_interference"

    id: Mapped[int] = mapped_column(primary_key=True)
    error: Mapped[str] = mapped_column(Text, nullable=False)
    correct: Mapped[str] = mapped_column(Text, nullable=False)
    spanish_source: Mapped[str] = mapped_column(Text, default="", nullable=False)
    explanation: Mapped[str] = mapped_column(Text, default="", nullable=False)
    ref: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    pattern: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)  # auto | manual | llm | curated
    times_seen: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    next_review: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
