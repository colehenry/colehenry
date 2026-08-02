"""In-memory realtime rooms: one authoritative engine state per room, seat
management, bot driving, and snap-window timing.

Framework-light on purpose: sockets are anything with `send_json` (FastAPI
WebSocket in prod, a stub in tests), and persistence is an injected recorder
callback so this module never imports the DB. One Railway instance holds all
rooms; horizontal scaling would move this to Redis and is explicitly out of
scope (plan §5).
"""

from __future__ import annotations

import asyncio
import random
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Protocol

from app.cambio import engine as E
from app.cambio.belief import belief_for, hand_estimate
from app.cambio.bot import choose_move
from app.cambio.config import CambioConfig
from app.cambio.engine import GameState, IllegalMove, new_round, reduce, view_for

VS_BOT = "vs_bot"
VS_HUMAN = "vs_human"

# Rooms idle longer than this get pruned on the next create.
ROOM_TTL_SECONDS = 24 * 3600
BOT_THINK_SECONDS = 0.9


class Socket(Protocol):
    async def send_json(self, data: dict) -> None: ...


@dataclass
class Seat:
    seat: int
    kind: str  # "human" | "bot"
    name: str = ""
    token: str = ""  # seat token: rejoin credential, never shared cross-seat
    ws: Any | None = None
    connected: bool = False
    ready: bool = False


# recorder(room, kind, payload) — kind: "start" | "move" | "round_end"
Recorder = Callable[["Room", str, dict], Awaitable[None]]


async def _noop_recorder(room: "Room", kind: str, payload: dict) -> None:
    return None


class Room:
    def __init__(
        self,
        room_id: str,
        mode: str,
        config: CambioConfig,
        recorder: Recorder = _noop_recorder,
        bot_delay: float = BOT_THINK_SECONDS,
    ) -> None:
        self.id = room_id
        self.token = secrets.token_urlsafe(8)
        self.mode = mode
        self.config = config
        self.recorder = recorder
        self.bot_delay = bot_delay
        self.state: GameState | None = None
        self.round_no = 0
        self.seats: list[Seat] = [
            Seat(seat=i, kind="human") for i in range(config.num_players)
        ]
        if mode == VS_BOT:
            self.seats[1] = Seat(seat=1, kind="bot", name="Bot", connected=True)
        self.created_at = time.time()
        self.touched_at = self.created_at
        self.lock = asyncio.Lock()
        self.game_row_id: int | None = None  # set by the recorder
        self._opening_task: asyncio.Task | None = None
        self._opening_deadline: float | None = None
        self._power_reveal_task: asyncio.Task | None = None
        self._power_reveal_deadline: float | None = None
        self._snap_task: asyncio.Task | None = None
        self._bot_task: asyncio.Task | None = None
        self._bot_rng = random.Random()

    # --- seats -------------------------------------------------------------

    def claim_seat(self, name: str, seat_token: str | None) -> Seat | None:
        """Reconnect by seat token, else claim the first free human seat."""
        if seat_token:
            for seat in self.seats:
                if seat.kind == "human" and seat.token == seat_token:
                    return seat
            return None
        for seat in self.seats:
            if seat.kind == "human" and not seat.token:
                seat.name = (name or f"Player {seat.seat + 1}").strip()[:40]
                seat.token = secrets.token_urlsafe(12)
                return seat
        return None

    def humans_ready(self) -> bool:
        return all(
            s.connected and s.ready for s in self.seats if s.kind == "human"
        )

    # --- lifecycle ---------------------------------------------------------

    async def start_round(self) -> None:
        for seat in self.seats:
            if seat.kind == "human":
                seat.ready = False
        self.round_no += 1
        self.state = new_round(self.config, seed=None)
        self._opening_deadline = time.time() + self.config.opening_peek_ms / 1000
        await self.recorder(self, "start", {"round_no": self.round_no})
        await self.broadcast()
        # Events are transient animation/reveal messages. Once every connected
        # player has received this broadcast they must never be replayed.
        self.state.events = []
        self._arm_followups()

    async def mark_ready(self, seat_number: int) -> None:
        """Ready one human for the first or next round."""
        async with self.lock:
            if self.state is not None and self.state.phase != E.ROUND_END:
                raise IllegalMove("round already started")
            seat = self.seats[seat_number]
            if seat.kind != "human" or not seat.connected:
                raise IllegalMove("seat is not connected")
            seat.ready = True
            if self.humans_ready():
                await self.start_round()
            else:
                await self.broadcast()

    async def apply(self, seat: int, move: dict) -> None:
        """Validate + apply a move, persist it, fan out views, arm timers."""
        async with self.lock:
            if self.state is None:
                raise IllegalMove("round not started")
            was_opening = self.state.phase == E.OPENING
            was_power_reveal = self.state.phase == E.POWER_REVEAL
            reduce(self.state, seat, move)
            is_opening = self.state.phase == E.OPENING
            is_power_reveal = self.state.phase == E.POWER_REVEAL
            if is_opening and not was_opening:
                self._opening_deadline = time.time() + self.config.opening_peek_ms / 1000
            elif not is_opening:
                self._opening_deadline = None
            if is_power_reveal and not was_power_reveal:
                self._power_reveal_deadline = (
                    time.time() + self.config.power_reveal_ms / 1000
                )
            elif not is_power_reveal:
                self._power_reveal_deadline = None
            self.touched_at = time.time()
            snap_correct = next(
                (
                    e["correct"]
                    for e in self.state.events
                    if e["type"] == "snap_attempt"
                ),
                None,
            )
            await self.recorder(
                self,
                "move",
                {
                    "round_no": self.round_no,
                    "seq": self.state.move_seq,
                    "seat": seat,
                    "move": move,
                    "snap_correct": snap_correct,
                },
            )
            if self.state.phase == E.ROUND_END:
                await self.recorder(
                    self,
                    "round_end",
                    {
                        "round_no": self.round_no,
                        "scores": self.state.scores,
                        "winners": self.state.winners,
                        "cambio_caller": self.state.cambio_caller,
                    },
                )
        await self.broadcast()
        if self.state is not None:
            self.state.events = []
        self._arm_followups()

    # --- fan-out -----------------------------------------------------------

    def seat_names(self) -> list[dict]:
        return [
            {
                "seat": s.seat,
                "name": s.name or ("Bot" if s.kind == "bot" else ""),
                "kind": s.kind,
                "connected": s.connected,
                "ready": s.ready,
            }
            for s in self.seats
        ]

    def view_payload(self, seat: int) -> dict:
        view = view_for(self.state, seat)
        view["belief"] = belief_for(self.state, seat)
        view["hand_estimate"] = round(hand_estimate(self.state, seat), 1)
        return {
            "type": "view",
            "room": {
                "id": self.id,
                "mode": self.mode,
                "round_no": self.round_no,
                "seats": self.seat_names(),
                "snap_window_ms": self.config.snap_window_ms,
                "opening_deadline_ms": (
                    round(self._opening_deadline * 1000)
                    if self.state is not None
                    and self.state.phase == E.OPENING
                    and self._opening_deadline is not None
                    else None
                ),
                "power_reveal_deadline_ms": (
                    round(self._power_reveal_deadline * 1000)
                    if self.state is not None
                    and self.state.phase == E.POWER_REVEAL
                    and self._power_reveal_deadline is not None
                    else None
                ),
            },
            "view": view,
        }

    async def broadcast(self) -> None:
        if self.state is None:
            payload = {
                "type": "waiting",
                "room": {
                    "id": self.id,
                    "mode": self.mode,
                    "round_no": self.round_no,
                    "seats": self.seat_names(),
                    "snap_window_ms": self.config.snap_window_ms,
                },
            }
            for seat in self.seats:
                if seat.ws is not None and seat.connected:
                    await self._send(seat, payload)
            return
        for seat in self.seats:
            if seat.ws is not None and seat.connected:
                await self._send(seat, self.view_payload(seat.seat))

    async def _send(self, seat: Seat, payload: dict) -> None:
        try:
            await seat.ws.send_json(payload)
        except Exception:
            seat.connected = False

    # --- timers + bot -------------------------------------------------------

    def _arm_followups(self) -> None:
        state = self.state
        if state is None or state.phase == E.ROUND_END:
            return
        if state.phase == E.OPENING:
            self._arm_opening_timer()
            return
        if state.phase == E.POWER_REVEAL:
            self._arm_power_reveal_timer()
            return
        if state.snap is not None:
            self._arm_snap_timer()
        self._arm_bot()

    def _arm_opening_timer(self) -> None:
        if self._opening_task is not None and not self._opening_task.done():
            return

        async def close_later() -> None:
            deadline = self._opening_deadline
            if deadline is None:
                return
            await asyncio.sleep(max(0, deadline - time.time()))
            state = self.state
            if state is None or state.phase != E.OPENING:
                return
            try:
                await self.apply(E.SERVER_SEAT, {"type": "close_opening"})
            except IllegalMove:
                pass

        self._opening_task = asyncio.create_task(close_later())

    def _arm_power_reveal_timer(self) -> None:
        if self._power_reveal_task is not None and not self._power_reveal_task.done():
            return

        async def close_later() -> None:
            deadline = self._power_reveal_deadline
            if deadline is None:
                return
            await asyncio.sleep(max(0, deadline - time.time()))
            state = self.state
            if state is None or state.phase != E.POWER_REVEAL:
                return
            try:
                await self.apply(E.SERVER_SEAT, {"type": "close_power_reveal"})
            except IllegalMove:
                pass

        self._power_reveal_task = asyncio.create_task(close_later())

    def _arm_snap_timer(self) -> None:
        if self._snap_task is not None and not self._snap_task.done():
            self._snap_task.cancel()

        async def close_later() -> None:
            await asyncio.sleep(self.config.snap_window_ms / 1000)
            while True:
                state = self.state
                if state is None:
                    return
                if state.snap is not None and state.phase != E.SNAP_GIVE:
                    try:
                        await self.apply(E.SERVER_SEAT, {"type": "close_snap"})
                    except IllegalMove:
                        pass
                    return
                if state.phase == E.SNAP_GIVE:
                    await asyncio.sleep(0.5)  # wait out the offload choice
                    continue
                return  # phase moved on without us

        self._snap_task = asyncio.create_task(close_later())

    def _arm_bot(self) -> None:
        bots = [s.seat for s in self.seats if s.kind == "bot"]
        if not bots or self.state is None:
            return
        if self._bot_task is not None and not self._bot_task.done():
            return  # already thinking; it re-checks after each move

        async def think() -> None:
            while True:
                state = self.state
                if state is None or state.phase == E.ROUND_END:
                    return
                move_seat = None
                move = None
                for b in bots:
                    candidate = choose_move(state, b, self._bot_rng)
                    if candidate is not None and _bot_may_act(state, b):
                        move_seat, move = b, candidate
                        break
                if move is None:
                    return
                await asyncio.sleep(self.bot_delay)
                if self.state is None or self.state.move_seq != state.move_seq:
                    continue  # world changed while thinking; re-decide
                try:
                    await self.apply(move_seat, move)
                except IllegalMove:
                    continue

        self._bot_task = asyncio.create_task(think())


def _bot_may_act(state: GameState, seat: int) -> bool:
    if state.phase == E.SNAP_GIVE:
        return state.snap is not None and state.snap.giver == seat
    if state.snap is not None and seat not in state.snap.attempted:
        return True
    return state.turn == seat


class RoomManager:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}

    def create(
        self,
        mode: str,
        config: CambioConfig | None = None,
        recorder: Recorder = _noop_recorder,
    ) -> Room:
        self._prune()
        room_id = secrets.token_hex(3).upper()  # e.g. "7F3A9C"
        while room_id in self.rooms:
            room_id = secrets.token_hex(3).upper()
        room = Room(room_id, mode, config or CambioConfig(), recorder=recorder)
        self.rooms[room_id] = room
        return room

    def get(self, room_id: str) -> Room | None:
        return self.rooms.get(room_id.upper())

    def _prune(self) -> None:
        cutoff = time.time() - ROOM_TTL_SECONDS
        for rid in [r for r, room in self.rooms.items() if room.touched_at < cutoff]:
            del self.rooms[rid]


manager = RoomManager()
