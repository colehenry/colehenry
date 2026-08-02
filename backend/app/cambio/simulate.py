"""Headless round runner — bot vs bot, no timers, no sockets.

Used by the offline Monte-Carlo simulator (scripts/cambio_sim.py) and the
engine smoke tests. Snap windows collapse to "every bot gets one look, then
the window closes"; wall-clock timing only exists in the realtime rooms.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from app.cambio import engine as E
from app.cambio.bot import choose_move
from app.cambio.config import CambioConfig
from app.cambio.engine import GameState, new_round, reduce

# A 2-player round rarely clears 200 reduces; a runaway pair of identical
# never-call bots could cycle, so past this the next actor is forced to call.
FORCE_CAMBIO_AFTER = 300
HARD_STOP = 2000


@dataclass
class RoundResult:
    state: GameState
    moves: int
    forced: bool = False
    move_log: list[dict] = field(default_factory=list)


def play_round(
    config: CambioConfig | None = None,
    seed: int | None = None,
    log_moves: bool = False,
) -> RoundResult:
    config = config or CambioConfig()
    state = new_round(config, seed=seed)
    rng = random.Random(None if seed is None else seed ^ 0x5EED)
    moves = 0
    forced = False
    log: list[dict] = []

    def apply(seat: int, move: dict) -> None:
        nonlocal moves
        reduce(state, seat, move)
        moves += 1
        if log_moves:
            log.append({"seat": seat, "move": move})

    while state.phase != E.ROUND_END and moves < HARD_STOP:
        if state.phase == E.OPENING:
            apply(E.SERVER_SEAT, {"type": "close_opening"})
        elif state.phase == E.POWER_REVEAL:
            apply(E.SERVER_SEAT, {"type": "close_power_reveal"})
        elif state.phase == E.SNAP_GIVE:
            apply(state.snap.giver, choose_move(state, state.snap.giver, rng))
        elif state.snap is not None:
            acted = False
            seats = list(range(len(state.players)))
            rng.shuffle(seats)  # who reacts first is chance
            for seat in seats:
                move = choose_move(state, seat, rng)
                if move is not None:
                    apply(seat, move)
                    acted = True
                    break  # phase may have changed (snap_give / round end)
            if not acted:
                # The active player starts immediately, closing the window as
                # part of their draw/cambio action.
                seat = state.turn
                move = choose_move(state, seat, rng)
                if move is None:
                    apply(E.SERVER_SEAT, {"type": "close_snap"})
                else:
                    apply(seat, move)
        else:
            seat = state.turn
            move = choose_move(state, seat, rng)
            if (
                moves >= FORCE_CAMBIO_AFTER
                and state.phase == E.TURN
                and state.cambio_caller is None
            ):
                move = {"type": "cambio"}
                forced = True
            apply(seat, move)

    return RoundResult(state=state, moves=moves, forced=forced, move_log=log)
