from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import require_owner
from app.models import CatanGame, CatanPlayer, CatanResult, User
from app.schemas.catan import (
    CatanDashboard,
    CatanGameCreate,
    CatanGameOut,
    CatanGameSummary,
    CatanGameUpdate,
    CatanLeaderboardRow,
    CatanPerformanceSpotlight,
    CatanPlayerOut,
    CatanResultIn,
    CatanResultOut,
    CatanWinEvent,
)

router = APIRouter(prefix="/catan", tags=["catan"])


def _load_games(db: Session) -> list[CatanGame]:
    return (
        db.execute(
            select(CatanGame)
            .options(selectinload(CatanGame.results).selectinload(CatanResult.player))
            .order_by(CatanGame.played_at.desc(), CatanGame.id.desc())
        )
        .scalars()
        .all()
    )


def _winner(game: CatanGame) -> str | None:
    for r in game.results:
        if r.won:
            return r.player.name
    return None


def _result_out(r: CatanResult) -> CatanResultOut:
    return CatanResultOut(
        player_id=r.player_id,
        player_name=r.player.name,
        victory_points=r.victory_points,
        starting_pips=r.starting_pips,
        largest=r.largest,
        longest=r.longest,
        won=r.won,
    )


def _game_out(game: CatanGame) -> CatanGameOut:
    results = sorted(
        game.results,
        key=lambda r: (not r.won, -(r.victory_points if r.victory_points is not None else -1)),
    )
    return CatanGameOut(
        id=game.id,
        played_at=game.played_at,
        location=game.location,
        notes=game.notes,
        winner=_winner(game),
        results=[_result_out(r) for r in results],
    )


def _resolve_player(db: Session, name: str) -> CatanPlayer:
    """Reuse an existing player case-insensitively, else create one.

    New players are guests by default — they show up in game summaries but
    stay out of dashboard aggregates until show_in_dashboard is flipped.
    """
    clean = name.strip()
    player = db.execute(
        select(CatanPlayer).where(func.lower(CatanPlayer.name) == clean.lower())
    ).scalar_one_or_none()
    if player is None:
        player = CatanPlayer(name=clean.title(), show_in_dashboard=False)
        db.add(player)
        db.flush()
    return player


def _set_results(db: Session, game: CatanGame, results: list[CatanResultIn]) -> None:
    game.results.clear()
    db.flush()
    for r in results:
        player = _resolve_player(db, r.player_name)
        game.results.append(
            CatanResult(
                player_id=player.id,
                victory_points=r.victory_points,
                starting_pips=r.starting_pips,
                largest=r.largest,
                longest=r.longest,
                won=r.won,
            )
        )


@router.get("/dashboard", response_model=CatanDashboard)
def dashboard(db: Session = Depends(get_db)):
    """Public. Aggregates cover dashboard players only; guests are excluded."""
    games = _load_games(db)
    players = (
        db.execute(select(CatanPlayer).order_by(CatanPlayer.id)).scalars().all()
    )
    dashboard_ids = {p.id for p in players if p.show_in_dashboard}

    stats: dict[int, dict] = defaultdict(
        lambda: {
            "games": 0,
            "wins": 0,
            "vps": [],
            "longest": 0,
            "largest": 0,
            "last_win": None,
        }
    )
    chronological = sorted(games, key=lambda g: (g.played_at, g.id))
    performances: list[tuple[CatanGame, CatanResult]] = []
    for game in chronological:
        for r in game.results:
            if r.player_id not in dashboard_ids:
                continue
            performances.append((game, r))
            s = stats[r.player_id]
            s["games"] += 1
            if r.won:
                s["wins"] += 1
                s["last_win"] = game.played_at
            if r.victory_points is not None:
                s["vps"].append(r.victory_points)
            if r.longest:
                s["longest"] += 1
            if r.largest:
                s["largest"] += 1

    by_id = {p.id: p for p in players}
    leaderboard = [
        CatanLeaderboardRow(
            player_id=pid,
            name=by_id[pid].name,
            games=s["games"],
            wins=s["wins"],
            win_pct=round(s["wins"] / s["games"], 4) if s["games"] else 0.0,
            avg_vp=round(sum(s["vps"]) / len(s["vps"]), 2) if s["vps"] else None,
            longest_count=s["longest"],
            largest_count=s["largest"],
            last_win=s["last_win"],
        )
        for pid, s in stats.items()
    ]
    leaderboard.sort(key=lambda row: (-row.win_pct, -row.wins, row.name))

    def spotlight(game: CatanGame, result: CatanResult) -> CatanPerformanceSpotlight:
        return CatanPerformanceSpotlight(
            game_id=game.id,
            played_at=game.played_at,
            location=game.location,
            player_name=result.player.name,
            victory_points=result.victory_points,
            winner=_winner(game),
        )

    worst_performances = [
        spotlight(game, result)
        for game, result in sorted(
            (p for p in performances if p[1].victory_points is not None),
            key=lambda p: (
                p[1].victory_points,
                p[0].played_at,
                p[0].id,
                p[1].player.name,
            ),
        )[:5]
    ]
    longest_road_to_nowhere = [
        spotlight(game, result)
        for game, result in sorted(
            (
                p
                for p in performances
                if p[1].longest and p[1].victory_points is not None
            ),
            key=lambda p: (
                p[1].victory_points,
                p[0].played_at,
                p[0].id,
                p[1].player.name,
            ),
        )[:5]
    ]
    close_but_no_sheep = [
        spotlight(game, result)
        for game, result in sorted(
            (
                p
                for p in performances
                if not p[1].won and p[1].victory_points is not None
            ),
            key=lambda p: (
                -p[1].victory_points,
                p[0].played_at,
                p[0].id,
                p[1].player.name,
            ),
        )[:5]
    ]

    return CatanDashboard(
        total_games=len(games),
        first_game=chronological[0].played_at if chronological else None,
        last_game=chronological[-1].played_at if chronological else None,
        leaderboard=leaderboard,
        timeline=[
            CatanWinEvent(game_id=g.id, played_at=g.played_at, winner=_winner(g))
            for g in chronological
        ],
        players=[CatanPlayerOut.model_validate(p) for p in players],
        worst_performances=worst_performances,
        longest_road_to_nowhere=longest_road_to_nowhere,
        close_but_no_sheep=close_but_no_sheep,
    )


@router.get("/games", response_model=list[CatanGameSummary])
def list_games(db: Session = Depends(get_db)):
    """Public. Newest first."""
    return [
        CatanGameSummary(
            id=g.id,
            played_at=g.played_at,
            location=g.location,
            notes=g.notes,
            winner=_winner(g),
            player_names=[r.player.name for r in g.results],
            longest=[r.player.name for r in g.results if r.longest],
            largest=[r.player.name for r in g.results if r.largest],
        )
        for g in _load_games(db)
    ]


@router.get("/games/{game_id}", response_model=CatanGameOut)
def get_game(game_id: int, db: Session = Depends(get_db)):
    game = db.get(CatanGame, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return _game_out(game)


@router.post("/games", response_model=CatanGameOut, status_code=201)
def create_game(
    body: CatanGameCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    game = CatanGame(
        played_at=body.played_at,
        location=body.location.strip(),
        notes=body.notes.strip(),
    )
    db.add(game)
    db.flush()
    _set_results(db, game, body.results)
    db.commit()
    db.refresh(game)
    return _game_out(game)


@router.patch("/games/{game_id}", response_model=CatanGameOut)
def update_game(
    game_id: int,
    body: CatanGameUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    game = db.get(CatanGame, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    data = body.model_dump(exclude_unset=True)
    if "played_at" in data and data["played_at"] is not None:
        game.played_at = data["played_at"]
    if "location" in data and data["location"] is not None:
        game.location = data["location"].strip()
    if "notes" in data and data["notes"] is not None:
        game.notes = data["notes"].strip()
    if body.results is not None:
        _set_results(db, game, body.results)
    db.commit()
    db.refresh(game)
    return _game_out(game)


@router.delete("/games/{game_id}", status_code=204)
def delete_game(
    game_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    game = db.get(CatanGame, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    db.delete(game)
    db.commit()
