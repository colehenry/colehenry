from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class CatanResultIn(BaseModel):
    """One player's line in a game, keyed by name (matched case-insensitively)."""

    player_name: str
    victory_points: int | None = None
    starting_pips: int | None = None
    largest: bool = False
    longest: bool = False
    won: bool = False

    @field_validator("player_name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("player name is required")
        return value


class CatanGameCreate(BaseModel):
    played_at: date
    location: str = ""
    notes: str = ""
    results: list[CatanResultIn]

    @model_validator(mode="after")
    def check_results(self) -> "CatanGameCreate":
        if len(self.results) < 2:
            raise ValueError("a game needs at least 2 players")
        names = [r.player_name.lower() for r in self.results]
        if len(set(names)) != len(names):
            raise ValueError("duplicate player in results")
        if sum(1 for r in self.results if r.won) != 1:
            raise ValueError("exactly one winner required")
        return self


class CatanGameUpdate(BaseModel):
    """PATCH body — replaces results wholesale when provided."""

    played_at: date | None = None
    location: str | None = None
    notes: str | None = None
    results: list[CatanResultIn] | None = None

    @model_validator(mode="after")
    def check_results(self) -> "CatanGameUpdate":
        if self.results is not None:
            if len(self.results) < 2:
                raise ValueError("a game needs at least 2 players")
            names = [r.player_name.lower() for r in self.results]
            if len(set(names)) != len(names):
                raise ValueError("duplicate player in results")
            if sum(1 for r in self.results if r.won) != 1:
                raise ValueError("exactly one winner required")
        return self


class CatanResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_id: int
    player_name: str
    victory_points: int | None
    starting_pips: int | None
    largest: bool
    longest: bool
    won: bool


class CatanGameOut(BaseModel):
    id: int
    played_at: date
    location: str
    notes: str
    winner: str | None
    results: list[CatanResultOut]


class CatanGameSummary(BaseModel):
    """Row for the recent-games table."""

    id: int
    played_at: date
    location: str
    notes: str
    winner: str | None
    player_names: list[str]
    longest: list[str]
    largest: list[str]


class CatanPlayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    show_in_dashboard: bool


class CatanLeaderboardRow(BaseModel):
    player_id: int
    name: str
    games: int
    wins: int
    win_pct: float
    avg_vp: float | None
    longest_count: int
    largest_count: int
    last_win: date | None


class CatanWinEvent(BaseModel):
    """One game in chronological order — feeds the wins-over-time chart."""

    game_id: int
    played_at: date
    winner: str | None


class CatanPerformanceSpotlight(BaseModel):
    game_id: int
    played_at: date
    location: str
    player_name: str
    victory_points: int | None
    winner: str | None


class CatanDashboard(BaseModel):
    total_games: int
    first_game: date | None
    last_game: date | None
    leaderboard: list[CatanLeaderboardRow]
    timeline: list[CatanWinEvent]
    players: list[CatanPlayerOut]
    worst_performances: list[CatanPerformanceSpotlight]
    longest_road_to_nowhere: list[CatanPerformanceSpotlight]
    close_but_no_sheep: list[CatanPerformanceSpotlight]
