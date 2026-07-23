from datetime import datetime

from pydantic import BaseModel, Field


class CambioRoomCreate(BaseModel):
    mode: str = Field(pattern="^(vs_bot|vs_human)$")
    # Sparse knob overrides; anything omitted keeps the CambioConfig default.
    config: dict = Field(default_factory=dict)


class CambioSeatOut(BaseModel):
    seat: int
    name: str
    kind: str
    connected: bool


class CambioRoomOut(BaseModel):
    room_id: str
    token: str
    mode: str
    join_path: str  # frontend route the invite link points at


class CambioRoomMeta(BaseModel):
    room_id: str
    mode: str
    started: bool
    round_no: int
    seats: list[CambioSeatOut]


class CambioOpponentRow(BaseModel):
    name: str
    rounds: int
    wins: int
    losses: int


class CambioStats(BaseModel):
    games: int
    rounds: int
    wins: int
    win_pct: float
    current_streak: int
    longest_streak: int
    avg_closing_score: float | None
    snap_attempts: int
    snap_accuracy: float | None
    offloads: int
    cambio_calls: int
    cambio_call_accuracy: float | None
    opponents: list[CambioOpponentRow]
    last_played: datetime | None
