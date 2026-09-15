"""Pydantic shapes for /language/learning."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class StateIn(BaseModel):
    active_sprint: int = Field(ge=1, le=4)


class VocabOut(BaseModel):
    id: int
    curriculum_id: str | None
    french: str
    display: str
    spanish: str
    english: str
    part_of_speech: str
    gender: str
    ipa: str
    sprint: int
    priority: int
    status: str
    frequency_band: str
    example_fr: str
    example_es: str
    pattern: str
    spanish_connection: str
    pronunciation_warning: str
    cognate_type: str
    false_friend: bool
    reference_links: list[Any]
    tags: list[Any]
    source: str
    text_id: int | None
    recognition: float
    audio_recognition: float
    written_production: float
    spoken_production: float
    contextual_use: float
    attempts: int
    last_seen_at: datetime | None


class VocabStatusIn(BaseModel):
    status: str = Field(pattern="^(core|recognition|encountered)$")


class VocabImportIn(BaseModel):
    items: list[dict[str, Any]]


class EncounterIn(BaseModel):
    french: str
    spanish: str = ""
    english: str = ""
    part_of_speech: str = ""
    gender: str = ""
    ipa: str = ""
    example_fr: str = ""
    example_es: str = ""
    text_id: int | None = None
    lexeme_id: int | None = None
    status: str = Field(default="encountered", pattern="^(core|recognition|encountered)$")


class ExercisesIn(BaseModel):
    activity_id: str | None = None
    format: str | None = None
    sprint: int | None = Field(default=None, ge=1, le=4)
    count: int | None = Field(default=None, ge=1, le=40)
    params: dict[str, Any] = {}
    targets: list[str] = []
    source: str = Field(default="auto", pattern="^(auto|deterministic|llm)$")
    fresh: bool = False
    difficulty: int = Field(default=2, ge=1, le=3)


class ResultIn(BaseModel):
    sprint: int = Field(ge=1, le=4)
    activity_id: str = ""
    format: str
    source: str = "deterministic"
    skill: str
    target_ids: list[str] = []
    dims: dict[str, float] = {}
    correct: bool
    score: float = Field(ge=0, le=1)
    prompt: str = ""
    answer: str = ""
    expected: str = ""
    time_ms: int = 0
    generated_id: int | None = None
    meta: dict[str, Any] = {}


class CompletionIn(BaseModel):
    activity_id: str
    name: str = ""
    skill: str
    sprint: int = Field(ge=1, le=4)
    score: float = Field(ge=0, le=1)
    summary: str = ""
    minutes: int = 0


class ResultsIn(BaseModel):
    results: list[ResultIn] = []
    session_id: int | None = None
    completion: CompletionIn | None = None


class AttemptIn(BaseModel):
    activity_id: str
    title: str = ""
    format: str = ""
    skill: str = "grammar"
    sprint: int = Field(ge=1, le=4)
    session_id: int | None = None
    payload: dict[str, Any]


class AttemptProgressIn(BaseModel):
    index: int = Field(ge=0)
    graded: list[dict[str, Any]]
    payload: dict[str, Any] | None = None


class AttemptOut(BaseModel):
    id: int
    activity_id: str
    title: str
    format: str
    skill: str
    sprint: int
    session_id: int | None
    payload: dict[str, Any]
    index: int
    total: int
    graded: list[Any]
    started_at: datetime
    updated_at: datetime
    finished_at: datetime | None


class SessionIn(BaseModel):
    minutes: int = Field(ge=3, le=180)
    use_llm: bool = True
    sprint: int | None = Field(default=None, ge=1, le=4)


class SessionOut(BaseModel):
    id: int
    created_at: datetime
    sprint: int
    minutes: int
    source: str
    plan: list[Any]
    completed: list[Any]
    completed_at: datetime | None


class TestStartIn(BaseModel):
    sprint: int = Field(ge=1, le=4)


class TestSubmitIn(BaseModel):
    results: list[ResultIn]


class TestOut(BaseModel):
    id: int
    sprint: int
    started_at: datetime
    completed_at: datetime | None
    payload: dict[str, Any]
    scores: dict[str, Any]
    profile: dict[str, Any]
    readiness: float
    passed: bool
    weak: list[Any]


class TestSummary(BaseModel):
    id: int
    sprint: int
    started_at: datetime
    completed_at: datetime | None
    scores: dict[str, Any]
    profile: dict[str, Any]
    readiness: float
    passed: bool
    weak: list[Any]


class InterferenceIn(BaseModel):
    error: str
    correct: str
    spanish_source: str = ""
    explanation: str = ""
    ref: str = ""


class InterferenceUpdate(BaseModel):
    resolved: bool | None = None
    explanation: str | None = None
    correct: str | None = None


class InterferenceOut(BaseModel):
    id: int
    error: str
    correct: str
    spanish_source: str
    explanation: str
    ref: str
    pattern: str
    source: str
    times_seen: int
    next_review: datetime
    last_seen: datetime
    resolved: bool
    created_at: datetime


class ExplainIn(BaseModel):
    text: str
    mode: str = "explain"
    context: str = ""
    sprint: int | None = None
