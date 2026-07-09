from datetime import date

from pydantic import BaseModel, field_validator

CHALLENGE_COUNT = 25
CHALLENGE_IDS = set(range(1, CHALLENGE_COUNT + 1))


class OrderUpdate(BaseModel):
    """PUT body — the full display order, a permutation of 1..25."""

    ordering: list[int]

    @field_validator("ordering")
    @classmethod
    def must_be_permutation(cls, value: list[int]) -> list[int]:
        if set(value) != CHALLENGE_IDS or len(value) != CHALLENGE_COUNT:
            raise ValueError("ordering must be a permutation of 1..25")
        return value


class CompletionIn(BaseModel):
    """POST body — optional completion date, defaults to today server-side."""

    completed_at: date | None = None


class VideoIdeasIn(BaseModel):
    text: str


class WindowOut(BaseModel):
    index: int  # 1..11
    start: date
    end: date  # the milestone deadline, inclusive
    status: str  # met | current | missed | upcoming
    count: int  # completions stamped into this window


class ChallengeDashboard(BaseModel):
    ordering: list[int]
    completions: dict[int, date]  # challenge_id -> completed_at
    windows: list[WindowOut]
    run_status: str  # on_track | due | failed | won
    completed_count: int
    current_window: int | None  # None once past the finish date
    finish: date
    video_ideas: str
