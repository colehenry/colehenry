"""Cambio HTTP + WebSocket surface.

Room creation is owner-only; guests join through the invite link with just a
nickname — the room token gates access, the per-seat token survives refresh
(client keeps it in sessionStorage). The WS never trusts the client: every
move goes through engine.reduce, which rejects anything the seat couldn't
legally do.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.cambio.config import CambioConfig
from app.cambio.engine import IllegalMove
from app.cambio.rooms import Room, manager
from app.db import SessionLocal, get_db
from app.deps import require_cambio_host
from app.models import CambioGame, CambioMove, CambioPlayer, CambioRound, User
from app.schemas.cambio import (
    CambioOpponentRow,
    CambioRoomCreate,
    CambioRoomMeta,
    CambioRoomOut,
    CambioSeatOut,
    CambioStats,
)
from app.schemas import UserOut

router = APIRouter(prefix="/cambio", tags=["cambio"])

CONFIG_KNOBS = {
    "joker_count",
    "snap_enabled",
    "snap_window_ms",
    "caller_penalty",
    "opening_peek_count",
}


def _build_config(overrides: dict) -> CambioConfig:
    clean = {k: v for k, v in overrides.items() if k in CONFIG_KNOBS}
    return CambioConfig(**clean)


def _make_recorder(created_by: int | None):
    """Persistence callback for a room. Opens a short-lived session per event
    — WS handlers are long-lived, so no request-scoped session exists."""

    async def record(room: Room, kind: str, payload: dict) -> None:
        db: Session = SessionLocal()
        try:
            if kind == "start":
                if room.game_row_id is None:
                    game = CambioGame(
                        room_id=room.id,
                        mode=room.mode,
                        config=room.config.to_dict(),
                        created_by=created_by,
                    )
                    db.add(game)
                    db.flush()
                    for seat in room.seats:
                        db.add(
                            CambioPlayer(
                                game_id=game.id,
                                seat=seat.seat,
                                user_id=created_by if seat.seat == 0 and created_by else None,
                                guest_name=seat.name,
                                is_bot=seat.kind == "bot",
                            )
                        )
                    db.commit()
                    room.game_row_id = game.id
            elif kind == "move" and room.game_row_id is not None:
                db.add(
                    CambioMove(
                        game_id=room.game_row_id,
                        round_no=payload["round_no"],
                        seq=payload["seq"],
                        seat=payload["seat"],
                        move=payload["move"],
                        snap_correct=payload.get("snap_correct"),
                    )
                )
                db.commit()
            elif kind == "round_end" and room.game_row_id is not None:
                caller = payload.get("cambio_caller")
                scores = payload["scores"]
                penalized = (
                    room.config.caller_penalty > 0
                    and caller is not None
                    and scores[caller] > min(scores)
                )
                db.add(
                    CambioRound(
                        game_id=room.game_row_id,
                        round_no=payload["round_no"],
                        cambio_caller_seat=caller,
                        scores=scores,
                        winner_seats=payload["winners"],
                        was_caller_penalized=penalized,
                    )
                )
                game = db.get(CambioGame, room.game_row_id)
                if game is not None:
                    game.ended_at = datetime.now(timezone.utc)
                db.commit()
        finally:
            db.close()

    return record


# --- REST -------------------------------------------------------------------


@router.post("/rooms", response_model=CambioRoomOut, status_code=201)
def create_room(body: CambioRoomCreate, user: User = Depends(require_cambio_host)):
    try:
        config = _build_config(body.config)
    except TypeError:
        raise HTTPException(status_code=422, detail="Bad config knobs")
    room = manager.create(body.mode, config, recorder=_make_recorder(user.id))
    return CambioRoomOut(
        room_id=room.id,
        token=room.token,
        mode=room.mode,
        join_path=f"/cambio/r/{room.id}?t={room.token}",
    )


@router.get("/host", response_model=UserOut)
def host_session(user: User = Depends(require_cambio_host)):
    return user


@router.get("/rooms/{room_id}", response_model=CambioRoomMeta)
def room_meta(room_id: str, t: str):
    room = manager.get(room_id)
    if room is None or room.token != t:
        raise HTTPException(status_code=404, detail="Room not found")
    return CambioRoomMeta(
        room_id=room.id,
        mode=room.mode,
        started=room.state is not None,
        round_no=room.round_no,
        seats=[CambioSeatOut(**s) for s in room.seat_names()],
    )


# --- WebSocket --------------------------------------------------------------


@router.websocket("/ws/{room_id}")
async def game_socket(websocket: WebSocket, room_id: str):
    params = websocket.query_params
    room = manager.get(room_id)
    if room is None or room.token != params.get("t", ""):
        await websocket.close(code=4004, reason="Room not found")
        return

    seat = room.claim_seat(params.get("name", ""), params.get("seat") or None)
    if seat is None:
        await websocket.close(code=4001, reason="Room is full")
        return

    await websocket.accept()
    seat.ws = websocket
    seat.connected = True
    await websocket.send_json(
        {"type": "joined", "seat": seat.seat, "seat_token": seat.token}
    )

    # Joining never deals automatically. Each human explicitly readies after
    # the socket is connected, so the opening peek begins while they watch.
    await room.broadcast()

    try:
        while True:
            data = await websocket.receive_json()
            kind = data.get("type")
            try:
                if kind == "move":
                    await room.apply(seat.seat, data.get("move") or {})
                elif kind == "ready":
                    await room.mark_ready(seat.seat)
                elif kind == "restart":
                    # Compatibility with clients loaded before the ready
                    # handshake shipped; it cannot bypass readiness.
                    await room.mark_ready(seat.seat)
                elif kind == "ping":
                    await websocket.send_json({"type": "pong"})
            except IllegalMove as exc:
                await websocket.send_json({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        pass
    finally:
        # Pause-and-wait: the seat token stays valid, state stays put.
        if seat.ws is websocket:
            seat.ws = None
            seat.connected = False
            if room.state is None or room.state.phase == "round_end":
                seat.ready = False
            await room.broadcast()


# --- stats ------------------------------------------------------------------


@router.get("/stats", response_model=CambioStats)
def stats(db: Session = Depends(get_db), user: User = Depends(require_cambio_host)):
    games = (
        db.execute(
            select(CambioGame)
            .options(
                selectinload(CambioGame.players), selectinload(CambioGame.rounds)
            )
            .order_by(CambioGame.started_at)
        )
        .scalars()
        .all()
    )

    rounds_played = 0
    wins = 0
    closing: list[int] = []
    streak = longest = current = 0
    opponents: dict[str, dict] = {}
    cambio_calls = 0
    cambio_wins = 0
    owner_seats: dict[int, int] = {}
    last_played = None
    outcomes: list[bool] = []

    for game in games:
        owner_seat = next(
            (p.seat for p in game.players if p.user_id == user.id), None
        )
        if owner_seat is None:
            continue
        owner_seats[game.id] = owner_seat
        opp = next(
            (p for p in game.players if p.seat != owner_seat), None
        )
        opp_name = "Bot" if (opp and opp.is_bot) else (opp.guest_name if opp else "?")
        for rnd in sorted(game.rounds, key=lambda r: (r.created_at, r.round_no)):
            rounds_played += 1
            won = owner_seat in (rnd.winner_seats or [])
            outcomes.append(won)
            if won:
                wins += 1
            if rnd.scores and owner_seat < len(rnd.scores):
                closing.append(rnd.scores[owner_seat])
            row = opponents.setdefault(
                opp_name, {"rounds": 0, "wins": 0, "losses": 0}
            )
            row["rounds"] += 1
            row["wins" if won else "losses"] += 1
            if rnd.cambio_caller_seat == owner_seat:
                cambio_calls += 1
                if won:
                    cambio_wins += 1
            last_played = rnd.created_at

    for won in outcomes:
        current = current + 1 if won else 0
        longest = max(longest, current)
    streak = current

    snap_attempts = 0
    snap_correct = 0
    offloads = 0
    if owner_seats:
        moves = (
            db.execute(
                select(CambioMove).where(
                    CambioMove.game_id.in_(owner_seats.keys()),
                    CambioMove.snap_correct.is_not(None),
                )
            )
            .scalars()
            .all()
        )
        for m in moves:
            if m.seat != owner_seats.get(m.game_id):
                continue
            snap_attempts += 1
            if m.snap_correct:
                snap_correct += 1
                target = (m.move or {}).get("target")
                if target is not None and target != m.seat:
                    offloads += 1

    return CambioStats(
        games=len(owner_seats),
        rounds=rounds_played,
        wins=wins,
        win_pct=round(wins / rounds_played, 4) if rounds_played else 0.0,
        current_streak=streak,
        longest_streak=longest,
        avg_closing_score=(
            round(sum(closing) / len(closing), 2) if closing else None
        ),
        snap_attempts=snap_attempts,
        snap_accuracy=(
            round(snap_correct / snap_attempts, 4) if snap_attempts else None
        ),
        offloads=offloads,
        cambio_calls=cambio_calls,
        cambio_call_accuracy=(
            round(cambio_wins / cambio_calls, 4) if cambio_calls else None
        ),
        opponents=[
            CambioOpponentRow(name=name, **row)
            for name, row in sorted(
                opponents.items(), key=lambda kv: -kv[1]["rounds"]
            )
        ],
        last_played=last_played,
    )
