"""Heuristic bot. Plays by the same rules humans do: it only reads faces of
cards in its own ``knowledge`` set — never the hidden state — so it cannot
cheat any more than a client can. Deterministic given (state, rng).

Policy: value-greedy with belief EVs for unknowns. Good enough to be fun in
2-player; the Monte-Carlo layer (scripts/cambio_sim.py) exists to grade and
tune exactly these heuristics.
"""

from __future__ import annotations

import random

from app.cambio import engine as E
from app.cambio.belief import PSEUDO_VALUES, belief_for, hand_estimate, pseudo_rank
from app.cambio.engine import Card, GameState

# Call cambio when the expected hand total is at or below this.
CAMBIO_THRESHOLD = 5.0
# Take the discard only when it's at least this much better than the slot
# it would replace.
SWAP_MARGIN = 1.0


def _faces(state: GameState, seat: int) -> dict[int, Card]:
    """uid -> Card, restricted to faces this seat has legally seen."""
    known = state.knowledge.get(seat, set())
    faces: dict[int, Card] = {}
    for hand in state.players:
        for c in hand:
            if c.uid in known:
                faces[c.uid] = c
    if state.drawn is not None and state.drawn.uid in known:
        faces[state.drawn.uid] = state.drawn
    return faces


def _slot_values(state: GameState, seat: int) -> list[float]:
    """Per-slot expected value of the bot's own hand."""
    faces = _faces(state, seat)
    ev = belief_for(state, seat)["ev"]
    return [
        PSEUDO_VALUES[pseudo_rank(faces[c.uid])] if c.uid in faces else ev
        for c in state.players[seat]
    ]


def _worst_slot(state: GameState, seat: int) -> tuple[int, float]:
    values = _slot_values(state, seat)
    if not values:  # hand snapped empty — nothing to replace or shed
        return -1, -1000.0
    slot = max(range(len(values)), key=lambda i: values[i])
    return slot, values[slot]


def choose_move(state: GameState, seat: int, rng: random.Random) -> dict | None:
    """The bot's move for the current phase, or None to stay quiet (only
    meaningful during a snap window)."""
    phase = state.phase
    if phase == E.SNAP_GIVE:
        if state.snap and state.snap.giver == seat:
            slot, _ = _worst_slot(state, seat)
            return {"type": "snap_give", "slot": slot}
        return None
    if state.snap is not None:
        snap_move = _snap_move(state, seat)
        if snap_move is not None:
            return snap_move
    if state.round_end_pending:
        return None
    if state.turn != seat or phase == E.ROUND_END:
        return None

    if phase == E.TURN:
        return _turn_move(state, seat)
    if phase == E.DRAWN:
        return _drawn_move(state, seat)
    if phase == E.PEEK_OWN:
        return _peek_own(state, seat)
    if phase == E.PEEK_OPP:
        return _peek_opp(state, seat, rng)
    if phase == E.BLIND_SWAP:
        return _blind_swap(state, seat, rng)
    if phase == E.KING:
        return _king(state, seat, rng)
    return None


def _turn_move(state: GameState, seat: int) -> dict:
    est = hand_estimate(state, seat)
    if state.cambio_caller is None and est <= CAMBIO_THRESHOLD:
        return {"type": "cambio"}
    if state.stock or len(state.discard) > 1:
        return {"type": "draw_stock"}
    return {"type": "cambio"}


def _drawn_move(state: GameState, seat: int) -> dict:
    drawn = state.drawn
    value = PSEUDO_VALUES[pseudo_rank(drawn)]
    slot, worst = _worst_slot(state, seat)
    if slot < 0:  # empty hand: playing is the only legal move
        return {"type": "play"}
    # A power card is usually worth more played than swapped, unless the hand
    # is bad and the card is genuinely low (never swap in a black king).
    if E.power_of(drawn) is not None:
        return {"type": "play"}
    if value < worst - SWAP_MARGIN:
        return {"type": "swap", "slot": slot}
    return {"type": "play"}


def _unknown_slots(state: GameState, seat: int, of: int) -> list[int]:
    known = state.knowledge.get(seat, set())
    return [i for i, c in enumerate(state.players[of]) if c.uid not in known]


def _peek_own(state: GameState, seat: int) -> dict:
    unknown = _unknown_slots(state, seat, seat)
    slot = unknown[0] if unknown else 0
    return {"type": "peek", "target": seat, "slot": slot}


def _peek_opp(state: GameState, seat: int, rng: random.Random) -> dict:
    opponents = [s for s in range(len(state.players)) if s != seat and state.players[s]]
    rng.shuffle(opponents)
    for opp in opponents:
        unknown = _unknown_slots(state, seat, opp)
        if unknown:
            return {"type": "peek", "target": opp, "slot": unknown[0]}
    opp = opponents[0]
    return {"type": "peek", "target": opp, "slot": 0}


def _blind_swap(state: GameState, seat: int, rng: random.Random) -> dict:
    """Swap our worst card away when it's clearly above the unknown EV, or
    when we know an opponent card is better than our worst."""
    faces = _faces(state, seat)
    ev = belief_for(state, seat)["ev"]
    slot, worst = _worst_slot(state, seat)
    best_target: tuple[int, int, float] | None = None
    for opp in range(len(state.players)):
        if opp == seat:
            continue
        for j, c in enumerate(state.players[opp]):
            val = (
                PSEUDO_VALUES[pseudo_rank(faces[c.uid])] if c.uid in faces else ev
            )
            if best_target is None or val < best_target[2]:
                best_target = (opp, j, val)
    if best_target is not None:
        return {
            "type": "blind_swap",
            "slot": slot,
            "target": best_target[0],
            "target_slot": best_target[1],
        }
    raise RuntimeError("blind swap requires cards on both sides")


def _king(state: GameState, seat: int, rng: random.Random) -> dict:
    faces = _faces(state, seat)
    slot, worst = _worst_slot(state, seat)
    if not state.king_looked:
        # Look at an opponent card we don't know; else one of our own.
        for opp in [s for s in range(len(state.players)) if s != seat]:
            unknown = _unknown_slots(state, seat, opp)
            if unknown:
                return {"type": "king_look", "target": opp, "slot": unknown[0]}
        unknown = _unknown_slots(state, seat, seat)
        if unknown:
            return {"type": "king_look", "target": seat, "slot": unknown[0]}
        # The look is mandatory even when every remaining card is remembered.
        targets = [
            (opp, i)
            for opp in range(len(state.players))
            for i in range(len(state.players[opp]))
        ]
        target, target_slot = rng.choice(targets)
        return {"type": "king_look", "target": target, "slot": target_slot}
    # The swap is mandatory. Prefer the best known opponent card, otherwise
    # choose a face-down target without inventing information.
    best: tuple[int, int, float] | None = None
    for opp in range(len(state.players)):
        if opp == seat:
            continue
        for j, c in enumerate(state.players[opp]):
            if c.uid in faces:
                val = PSEUDO_VALUES[pseudo_rank(faces[c.uid])]
                if best is None or val < best[2]:
                    best = (opp, j, val)
    if best is not None:
        return {"type": "king_swap", "slot": slot, "target": best[0], "target_slot": best[1]}
    opponents = [s for s in range(len(state.players)) if s != seat and state.players[s]]
    target = rng.choice(opponents)
    return {
        "type": "king_swap",
        "slot": slot,
        "target": target,
        "target_slot": rng.randrange(len(state.players[target])),
    }


def _snap_move(state: GameState, seat: int) -> dict | None:
    if state.snap is None or seat in state.snap.attempted:
        return None
    faces = _faces(state, seat)
    rank = state.snap.rank
    def snap(target: int, slot: int, card: Card) -> dict:
        return {
            "type": "snap",
            "target": target,
            "slot": slot,
            "window_id": state.snap.window_id,
            "card_uid": card.uid,
        }

    # Own certain match first: shedding is always good.
    for i, c in enumerate(state.players[seat]):
        if c.uid in faces and faces[c.uid].rank == rank:
            return snap(seat, i, c)
    # Opponent certain match: only worth it if we hold something bad to
    # offload (otherwise it just shrinks their hand).
    _, worst = _worst_slot(state, seat)
    if worst >= 7 and state.players[seat]:
        for opp in range(len(state.players)):
            if opp == seat:
                continue
            for j, c in enumerate(state.players[opp]):
                if c.uid in faces and faces[c.uid].rank == rank:
                    return snap(opp, j, c)
    return None
