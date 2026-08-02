"""Belief tracking — the probability layer behind the odds overlay and bot.

From one seat's point of view, every card they have not seen is exchangeable:
the correct Bayesian posterior over any single unseen card is uniform over the
remaining multiset of faces (the full deck minus every face this seat has
legally seen — opening peek, power peeks, discards, snap flips, drawn cards).
Blind swaps need no special handling because knowledge is uid-keyed and moves
with the physical card.

Kings split by color (KR = −1, KB = 10), so distributions run over
pseudo-ranks, not raw ranks.
"""

from __future__ import annotations

from collections import Counter

from app.cambio.config import CambioConfig
from app.cambio.engine import JOKER, RANKS, RED_SUITS, Card, GameState

# Pseudo-ranks: A..10, J, Q split kings by color, plus the joker.
PSEUDO_RANKS = [r for r in RANKS if r != "K"] + ["KR", "KB", "JO"]

PSEUDO_VALUES = {
    **{r: int(r) for r in RANKS if r.isdigit()},
    "A": 1,
    "J": 10,
    "Q": 10,
    "KR": -1,
    "KB": 10,
    "JO": 0,
}


def pseudo_rank(card: Card) -> str:
    if card.rank == JOKER:
        return "JO"
    if card.rank == "K":
        return "KR" if card.suit in RED_SUITS else "KB"
    return card.rank


def full_pool(config: CambioConfig) -> Counter:
    pool = Counter()
    for r in RANKS:
        if r == "K":
            pool["KR"] += 2
            pool["KB"] += 2
        else:
            pool[r] += 4
    pool["JO"] += config.joker_count
    return pool


def _all_cards(state: GameState) -> dict[int, Card]:
    cards = {}
    for hand in state.players:
        for c in hand:
            cards[c.uid] = c
    for c in state.stock:
        cards[c.uid] = c
    for c in state.discard:
        cards[c.uid] = c
    if state.drawn is not None:
        cards[state.drawn.uid] = state.drawn
    return cards


def belief_for(state: GameState, seat: int) -> dict:
    """Marginal distribution over any card the seat hasn't seen, plus the
    list of unknown in-play uids it applies to. All unseen cards share the
    same marginal, so one distribution covers every face-down card AND the
    top of the stock — the overlay just points uids at it.

    JSON-safe; pushed to the client on every state change so hovering costs
    nothing.
    """
    cards = _all_cards(state)
    pool = full_pool(state.config)
    for uid in state.knowledge.get(seat, ()):  # faces this seat has seen
        card = cards.get(uid)
        if card is not None:
            pool[pseudo_rank(card)] -= 1

    total = sum(pool.values())
    dist = {
        pr: (pool[pr] / total if total else 0.0) for pr in PSEUDO_RANKS if pool[pr] > 0
    }
    ev = sum(PSEUDO_VALUES[pr] * p for pr, p in dist.items())

    unknown_uids = [
        c.uid
        for hand in state.players
        for c in hand
        if c.uid not in state.knowledge.get(seat, ())
    ]
    if state.drawn is not None and state.drawn.uid not in state.knowledge.get(seat, ()):
        unknown_uids.append(state.drawn.uid)

    return {
        "dist": {pr: round(p, 4) for pr, p in dist.items()},
        "ev": round(ev, 2),
        # P(card value <= t) for the thresholds the overlay surfaces.
        "p_low": {
            str(t): round(sum(p for pr, p in dist.items() if PSEUDO_VALUES[pr] <= t), 4)
            for t in (0, 2, 4, 6)
        },
        "pool_size": total,
        "unknown_uids": unknown_uids,
    }


def hand_estimate(state: GameState, seat: int) -> float:
    """Expected point total of a seat's own hand given what they know."""
    cards = _all_cards(state)
    b = belief_for(state, seat)
    total = 0.0
    for c in state.players[seat]:
        if c.uid in state.knowledge.get(seat, ()):
            total += PSEUDO_VALUES[pseudo_rank(cards[c.uid])]
        else:
            total += b["ev"]
    return total
