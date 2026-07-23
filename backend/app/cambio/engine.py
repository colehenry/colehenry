"""Pure, deterministic Cambio engine.

State + ``reduce(state, seat, move)`` + per-player visibility masking
(``view_for``). No IO, no FastAPI, no DB — the WS room server, the bot, the
belief model, and the Monte-Carlo simulator all import this module, so the AI
plays by exactly the rules humans do.

Rules implemented from context/cambio_plan.md §1. Key modelling choices:

- Cards carry a stable ``uid``. Grid cards are always face down between
  actions; reveals are transient *events*. What a player currently "knows" is
  the uid-keyed ``knowledge`` set — knowledge follows the physical card
  through blind swaps and offloads, exactly like human memory of "that card I
  saw" does.
- ``reduce`` mutates the state in place (cheap for the million-game sim) but
  is otherwise pure: same state + move → same result. Use ``clone()`` when a
  caller needs to branch (bot search, determinization).
- The snap window's *timing* lives outside the engine: after any card lands
  on the discard the phase becomes ``snap`` and the room server (or sim)
  closes it with a ``{"type": "close_snap"}`` move from ``SERVER_SEAT``.
"""

from __future__ import annotations

import copy
import random
from dataclasses import dataclass, field

from app.cambio.config import CambioConfig

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["S", "H", "D", "C"]
JOKER = "JO"
RED_SUITS = {"H", "D"}

# Pseudo-seat used for engine-driven moves (closing the snap window).
SERVER_SEAT = -1

# Phases
TURN = "turn"  # actor chooses: draw stock / draw discard / call cambio
DRAWN = "drawn"  # actor holds a drawn card: swap into a slot or play it
PEEK_OWN = "peek_own"  # 7/8 played
PEEK_OPP = "peek_opp"  # 9/10 played
BLIND_SWAP = "blind_swap"  # J/Q played
KING = "king"  # black king played: look and/or swap, then done
SNAP = "snap"  # window open, any seat may attempt one match
SNAP_GIVE = "snap_give"  # correct snap on an opponent card: choose an offload
ROUND_END = "round_end"


@dataclass(frozen=True)
class Card:
    uid: int
    rank: str
    suit: str | None  # None for jokers

    def pub(self) -> dict:
        return {"uid": self.uid, "rank": self.rank, "suit": self.suit}


def card_value(card: Card) -> int:
    if card.rank == JOKER:
        return 0
    if card.rank == "A":
        return 1
    if card.rank in ("J", "Q"):
        return 10
    if card.rank == "K":
        return -1 if card.suit in RED_SUITS else 10
    return int(card.rank)


def power_of(card: Card) -> str | None:
    """The power a card triggers when played to the discard, if any."""
    if card.rank in ("7", "8"):
        return PEEK_OWN
    if card.rank in ("9", "10"):
        return PEEK_OPP
    if card.rank in ("J", "Q"):
        return BLIND_SWAP
    if card.rank == "K" and card.suit not in RED_SUITS:
        return KING
    return None


@dataclass
class SnapContext:
    rank: str  # rank to match (top of discard when the window opened)
    attempted: set[int] = field(default_factory=set)
    # SNAP_GIVE bookkeeping: seat that snapped correctly / seat that receives.
    giver: int | None = None
    receiver: int | None = None


@dataclass
class GameState:
    config: CambioConfig
    rng: random.Random
    players: list[list[Card]]  # hand per seat, variable length
    stock: list[Card]  # draw pile, [-1] is the top
    discard: list[Card]  # [-1] is the top, face up
    knowledge: dict[int, set[int]]  # seat -> uids that seat has seen
    turn: int = 0
    phase: str = TURN
    drawn: Card | None = None
    drawn_from_discard: bool = False
    king_looked: bool = False
    snap: SnapContext | None = None
    # Set once per turn when a card lands on the discard, consumed at end of
    # turn to decide whether a snap window opens.
    discarded_this_turn: bool = False
    cambio_caller: int | None = None
    final_turns: list[int] = field(default_factory=list)
    scores: list[int] | None = None
    winners: list[int] | None = None
    move_seq: int = 0
    events: list[dict] = field(default_factory=list)

    def clone(self) -> "GameState":
        return copy.deepcopy(self)


class IllegalMove(Exception):
    pass


def build_deck(config: CambioConfig, rng: random.Random) -> list[Card]:
    faces: list[tuple[str, str | None]] = [
        (rank, suit) for suit in SUITS for rank in RANKS
    ]
    faces += [(JOKER, None)] * config.joker_count
    rng.shuffle(faces)
    # uids are assigned AFTER the shuffle: a uid must never encode the face,
    # since uids travel to clients while faces stay server-side.
    return [Card(uid, rank, suit) for uid, (rank, suit) in enumerate(faces)]


def new_round(config: CambioConfig, seed: int | None = None) -> GameState:
    """Deal a fresh round. Opening peek (fixed bottom row) is applied here:
    the peeked cards enter each seat's knowledge and are emitted as private
    ``opening_peek`` events for the UI's timed reveal."""
    rng = random.Random(seed)
    deck = build_deck(config, rng)
    players = [
        [deck.pop() for _ in range(config.hand_size)]
        for _ in range(config.num_players)
    ]
    discard = [deck.pop()]
    state = GameState(
        config=config,
        rng=rng,
        players=players,
        stock=deck,
        discard=discard,
        knowledge={seat: set() for seat in range(config.num_players)},
    )
    # The starting discard is public.
    for seat in range(config.num_players):
        state.knowledge[seat].add(discard[0].uid)
    # Opening peek: bottom row = the last `opening_peek_count` slots.
    for seat, hand in enumerate(players):
        peeked = hand[-config.opening_peek_count:] if config.opening_peek_count else []
        for card in peeked:
            state.knowledge[seat].add(card.uid)
        state.events.append(
            {
                "type": "opening_peek",
                "to": [seat],
                "seat": seat,
                "cards": [c.pub() for c in peeked],
            }
        )
    return state


# --- knowledge helpers ------------------------------------------------------


def _publicize(state: GameState, card: Card) -> None:
    for seat in state.knowledge:
        state.knowledge[seat].add(card.uid)


def _reveal_to(state: GameState, viewer: int, card: Card, kind: str, **extra) -> None:
    state.knowledge[viewer].add(card.uid)
    state.events.append({"type": kind, "to": [viewer], "card": card.pub(), **extra})


def _to_discard(state: GameState, card: Card, source: str) -> None:
    state.discard.append(card)
    _publicize(state, card)
    state.discarded_this_turn = True
    state.events.append({"type": "discard", "to": None, "card": card.pub(), "source": source})


def _draw_from_stock(state: GameState) -> Card | None:
    """Pop the stock, reshuffling the discard (minus its top) when empty."""
    if not state.stock and len(state.discard) > 1:
        top = state.discard.pop()
        state.stock = state.discard
        state.discard = [top]
        state.rng.shuffle(state.stock)
        # Reshuffled cards are face down again — nobody tracked their order,
        # but everyone has *seen* them, so knowledge (uid-based) persists.
        # That is exactly how a human counts a reshuffled deck.
        state.events.append({"type": "reshuffle", "to": None, "count": len(state.stock)})
    return state.stock.pop() if state.stock else None


# --- legality ---------------------------------------------------------------


def _slot_ok(state: GameState, seat: int, slot: int) -> bool:
    return 0 <= seat < len(state.players) and 0 <= slot < len(state.players[seat])


def legal_moves(state: GameState, seat: int) -> list[dict]:
    """Enumerate legal moves for a seat — drives the bot and the simulator."""
    moves: list[dict] = []
    if state.phase == ROUND_END:
        return moves

    if state.phase == SNAP:
        if seat == SERVER_SEAT:
            return [{"type": "close_snap"}]
        if seat not in state.snap.attempted:
            for target in range(len(state.players)):
                for slot in range(len(state.players[target])):
                    moves.append({"type": "snap", "target": target, "slot": slot})
        return moves

    if state.phase == SNAP_GIVE:
        if seat == state.snap.giver:
            for slot in range(len(state.players[seat])):
                moves.append({"type": "snap_give", "slot": slot})
        return moves

    if seat != state.turn:
        return moves

    if state.phase == TURN:
        if state.stock or len(state.discard) > 1:
            moves.append({"type": "draw_stock"})
        if state.discard:
            moves.append({"type": "draw_discard"})
        if state.cambio_caller is None:
            moves.append({"type": "cambio"})
    elif state.phase == DRAWN:
        for slot in range(len(state.players[seat])):
            moves.append({"type": "swap", "slot": slot})
        # An empty hand (everything snapped away) has no slot to swap into,
        # so playing is the only physical option regardless of draw source.
        if (
            not state.drawn_from_discard
            or state.config.power_on_discard_draw
            or not state.players[seat]
        ):
            moves.append({"type": "play"})
    elif state.phase == PEEK_OWN:
        for slot in range(len(state.players[seat])):
            moves.append({"type": "peek", "target": seat, "slot": slot})
        moves.append({"type": "skip_power"})
    elif state.phase == PEEK_OPP:
        for target in range(len(state.players)):
            if target == seat:
                continue
            for slot in range(len(state.players[target])):
                moves.append({"type": "peek", "target": target, "slot": slot})
        moves.append({"type": "skip_power"})
    elif state.phase == BLIND_SWAP:
        for target in range(len(state.players)):
            if target == seat:
                continue
            for my in range(len(state.players[seat])):
                for their in range(len(state.players[target])):
                    moves.append(
                        {"type": "blind_swap", "slot": my, "target": target, "target_slot": their}
                    )
        moves.append({"type": "skip_power"})
    elif state.phase == KING:
        if not state.king_looked:
            for target in range(len(state.players)):
                for slot in range(len(state.players[target])):
                    moves.append({"type": "king_look", "target": target, "slot": slot})
        for target in range(len(state.players)):
            if target == seat:
                continue
            for my in range(len(state.players[seat])):
                for their in range(len(state.players[target])):
                    moves.append(
                        {"type": "king_swap", "slot": my, "target": target, "target_slot": their}
                    )
        moves.append({"type": "skip_power"})
    return moves


# --- reduce -----------------------------------------------------------------


def reduce(state: GameState, seat: int, move: dict) -> GameState:
    """Validate + apply one move. Raises IllegalMove on anything a player
    could not legally do given what they can see. Returns the same (mutated)
    state; fresh ``state.events`` describe what happened for animation/log."""
    state.events = []
    kind = move.get("type")

    if state.phase == ROUND_END:
        raise IllegalMove("round is over")

    if kind == "close_snap":
        if state.phase != SNAP or seat != SERVER_SEAT:
            raise IllegalMove("no snap window to close")
        state.snap = None
        state.phase = TURN
        _advance_turn(state)
    elif state.phase == SNAP:
        _apply_snap(state, seat, move)
    elif state.phase == SNAP_GIVE:
        _apply_snap_give(state, seat, move)
    elif seat != state.turn:
        raise IllegalMove("not your turn")
    elif state.phase == TURN:
        _apply_turn_choice(state, seat, move)
    elif state.phase == DRAWN:
        _apply_drawn(state, seat, move)
    elif state.phase in (PEEK_OWN, PEEK_OPP):
        _apply_peek(state, seat, move)
    elif state.phase == BLIND_SWAP:
        _apply_blind_swap(state, seat, move)
    elif state.phase == KING:
        _apply_king(state, seat, move)
    else:  # pragma: no cover - unknown phase would be an engine bug
        raise IllegalMove(f"bad phase {state.phase}")

    state.move_seq += 1
    return state


def _apply_turn_choice(state: GameState, seat: int, move: dict) -> None:
    kind = move.get("type")
    if kind == "draw_stock":
        card = _draw_from_stock(state)
        if card is None:
            raise IllegalMove("stock exhausted")
        state.drawn = card
        state.drawn_from_discard = False
        state.knowledge[seat].add(card.uid)
        state.phase = DRAWN
        state.events.append({"type": "draw", "to": None, "seat": seat, "source": "stock"})
        state.events.append({"type": "drawn_card", "to": [seat], "card": card.pub()})
    elif kind == "draw_discard":
        if not state.discard:
            raise IllegalMove("discard empty")
        card = state.discard.pop()
        state.drawn = card
        state.drawn_from_discard = True
        state.phase = DRAWN
        state.events.append(
            {"type": "draw", "to": None, "seat": seat, "source": "discard", "card": card.pub()}
        )
    elif kind == "cambio":
        if state.cambio_caller is not None:
            raise IllegalMove("cambio already called")
        state.cambio_caller = seat
        n = len(state.players)
        state.final_turns = [(seat + i) % n for i in range(1, n)]
        state.events.append({"type": "cambio_called", "to": None, "seat": seat})
        _advance_turn(state)
    else:
        raise IllegalMove(f"bad move {kind} in turn phase")


def _apply_drawn(state: GameState, seat: int, move: dict) -> None:
    kind = move.get("type")
    drawn = state.drawn
    if kind == "swap":
        slot = move.get("slot")
        if not isinstance(slot, int) or not _slot_ok(state, seat, slot):
            raise IllegalMove("bad slot")
        replaced = state.players[seat][slot]
        state.players[seat][slot] = drawn
        state.drawn = None
        state.events.append(
            {"type": "swap_in", "to": None, "seat": seat, "slot": slot, "uid": drawn.uid}
        )
        _to_discard(state, replaced, source="swap")
        _end_turn(state)
    elif kind == "play":
        if (
            state.drawn_from_discard
            and not state.config.power_on_discard_draw
            and state.players[seat]
        ):
            raise IllegalMove("cannot play back a discard draw")
        state.drawn = None
        _to_discard(state, drawn, source="play")
        power = power_of(drawn)
        if power and (not state.drawn_from_discard or state.config.power_on_discard_draw):
            state.phase = power
            state.king_looked = False
            state.events.append({"type": "power", "to": None, "power": power, "seat": seat})
        else:
            _end_turn(state)
    else:
        raise IllegalMove(f"bad move {kind} while holding a draw")


def _apply_peek(state: GameState, seat: int, move: dict) -> None:
    kind = move.get("type")
    if kind == "skip_power":
        _end_turn(state)
        return
    if kind != "peek":
        raise IllegalMove("expected peek or skip_power")
    target, slot = move.get("target"), move.get("slot")
    if not isinstance(target, int) or not isinstance(slot, int) or not _slot_ok(state, target, slot):
        raise IllegalMove("bad target")
    if state.phase == PEEK_OWN and target != seat:
        raise IllegalMove("7/8 peeks your own card")
    if state.phase == PEEK_OPP and target == seat:
        raise IllegalMove("9/10 peeks an opponent card")
    card = state.players[target][slot]
    _reveal_to(state, seat, card, "peek", seat=target, slot=slot)
    # Everyone sees *which* card was peeked, just not its face.
    state.events.append(
        {"type": "peeked", "to": None, "by": seat, "seat": target, "slot": slot, "uid": card.uid}
    )
    _end_turn(state)


def _apply_blind_swap(state: GameState, seat: int, move: dict) -> None:
    kind = move.get("type")
    if kind == "skip_power":
        _end_turn(state)
        return
    if kind != "blind_swap":
        raise IllegalMove("expected blind_swap or skip_power")
    _swap_between(state, seat, move)
    _end_turn(state)


def _apply_king(state: GameState, seat: int, move: dict) -> None:
    kind = move.get("type")
    if kind == "skip_power":
        _end_turn(state)
    elif kind == "king_look":
        if state.king_looked:
            raise IllegalMove("already looked")
        target, slot = move.get("target"), move.get("slot")
        if not isinstance(target, int) or not isinstance(slot, int) or not _slot_ok(state, target, slot):
            raise IllegalMove("bad target")
        card = state.players[target][slot]
        state.king_looked = True
        _reveal_to(state, seat, card, "peek", seat=target, slot=slot)
        state.events.append(
            {"type": "peeked", "to": None, "by": seat, "seat": target, "slot": slot, "uid": card.uid}
        )
    elif kind == "king_swap":
        _swap_between(state, seat, move)
        _end_turn(state)
    else:
        raise IllegalMove("expected king_look/king_swap/skip_power")


def _swap_between(state: GameState, seat: int, move: dict) -> None:
    my, target, their = move.get("slot"), move.get("target"), move.get("target_slot")
    if (
        not isinstance(my, int)
        or not isinstance(target, int)
        or not isinstance(their, int)
        or target == seat
        or not _slot_ok(state, seat, my)
        or not _slot_ok(state, target, their)
    ):
        raise IllegalMove("bad swap target")
    a, b = state.players[seat][my], state.players[target][their]
    state.players[seat][my], state.players[target][their] = b, a
    # No faces revealed; knowledge rides along with the uids.
    state.events.append(
        {
            "type": "table_swap",
            "to": None,
            "a": {"seat": seat, "slot": my, "uid": b.uid},
            "b": {"seat": target, "slot": their, "uid": a.uid},
        }
    )


def _apply_snap(state: GameState, seat: int, move: dict) -> None:
    if move.get("type") != "snap":
        raise IllegalMove("snap window is open")
    if seat < 0 or seat >= len(state.players):
        raise IllegalMove("bad seat")
    if seat in state.snap.attempted:
        raise IllegalMove("already attempted this window")
    target, slot = move.get("target"), move.get("slot")
    if not isinstance(target, int) or not isinstance(slot, int) or not _slot_ok(state, target, slot):
        raise IllegalMove("bad snap target")
    state.snap.attempted.add(seat)
    card = state.players[target][slot]
    _publicize(state, card)  # flipped for everyone before resolving
    correct = card.rank == state.snap.rank
    state.events.append(
        {
            "type": "snap_attempt",
            "to": None,
            "by": seat,
            "seat": target,
            "slot": slot,
            "card": card.pub(),
            "correct": correct,
        }
    )
    if correct:
        state.players[target].pop(slot)
        state.discard.append(card)
        if target != seat and state.players[seat]:
            # Offload: the snapper hands the victim one of their own cards.
            state.snap.giver = seat
            state.snap.receiver = target
            state.phase = SNAP_GIVE
    else:
        penalty = _draw_from_stock(state)
        if penalty is not None:
            state.players[seat].append(penalty)
            state.events.append(
                {"type": "penalty", "to": None, "seat": seat, "uid": penalty.uid}
            )


def _apply_snap_give(state: GameState, seat: int, move: dict) -> None:
    if move.get("type") != "snap_give" or seat != state.snap.giver:
        raise IllegalMove("waiting for the snapper to offload")
    slot = move.get("slot")
    if not isinstance(slot, int) or not _slot_ok(state, seat, slot):
        raise IllegalMove("bad slot")
    card = state.players[seat].pop(slot)
    state.players[state.snap.receiver].append(card)
    state.events.append(
        {
            "type": "offload",
            "to": None,
            "from": seat,
            "seat": state.snap.receiver,
            "uid": card.uid,
        }
    )
    state.snap.giver = None
    state.snap.receiver = None
    state.phase = SNAP  # window stays open for remaining seats


def _end_turn(state: GameState) -> None:
    """A turn's action fully resolved: open the snap window if something hit
    the discard, otherwise advance immediately."""
    state.drawn = None
    state.drawn_from_discard = False
    if state.config.snap_enabled and state.discarded_this_turn:
        state.discarded_this_turn = False
        state.snap = SnapContext(rank=state.discard[-1].rank)
        state.phase = SNAP
        state.events.append(
            {"type": "snap_open", "to": None, "rank": state.snap.rank}
        )
        return
    state.discarded_this_turn = False
    state.phase = TURN
    _advance_turn(state)


def _advance_turn(state: GameState) -> None:
    state.phase = TURN
    if state.cambio_caller is not None:
        if state.final_turns:
            state.turn = state.final_turns.pop(0)
        else:
            _score_round(state)
        return
    state.turn = (state.turn + 1) % len(state.players)
    # No stock and no drawable discard would deadlock; force scoring.
    if not state.stock and len(state.discard) <= 1 and not state.discard:
        _score_round(state)  # pragma: no cover - practically unreachable


def _score_round(state: GameState) -> None:
    totals = [sum(card_value(c) for c in hand) for hand in state.players]
    if state.config.caller_penalty and state.cambio_caller is not None:
        caller = state.cambio_caller
        others = [t for s, t in enumerate(totals) if s != caller]
        if others and totals[caller] >= min(others):
            totals[caller] += state.config.caller_penalty
    low = min(totals)
    state.scores = totals
    state.winners = [s for s, t in enumerate(totals) if t == low]
    state.phase = ROUND_END
    for hand in state.players:
        for card in hand:
            _publicize(state, card)
    state.events.append(
        {
            "type": "round_end",
            "to": None,
            "scores": totals,
            "winners": state.winners,
            "hands": [[c.pub() for c in hand] for hand in state.players],
        }
    )


# --- visibility masking -----------------------------------------------------


def _event_visible(event: dict, seat: int) -> bool:
    return event.get("to") is None or seat in event["to"]


def view_for(state: GameState, seat: int) -> dict:
    """The masked projection one seat is allowed to see. This is the ONLY
    thing that ever goes over the wire — a client physically cannot see
    hidden cards, so it cannot cheat."""
    in_play: set[int] = {c.uid for hand in state.players for c in hand}
    if state.drawn is not None:
        in_play.add(state.drawn.uid)
    uid_to_card = {c.uid: c for hand in state.players for c in hand}
    if state.drawn is not None:
        uid_to_card[state.drawn.uid] = state.drawn

    known = {
        str(uid): uid_to_card[uid].pub()
        for uid in state.knowledge.get(seat, set())
        if uid in in_play
    }

    drawn = None
    if state.drawn is not None:
        drawn = {"holder": state.turn, "from_discard": state.drawn_from_discard}
        if seat == state.turn or state.drawn_from_discard:
            drawn["card"] = state.drawn.pub()

    return {
        "seat": seat,
        "phase": state.phase,
        "turn": state.turn,
        "move_seq": state.move_seq,
        "config": state.config.to_dict(),
        "stock_count": len(state.stock),
        "discard_count": len(state.discard),
        "discard_top": state.discard[-1].pub() if state.discard else None,
        "drawn": drawn,
        "players": [
            {"seat": s, "hand": [{"uid": c.uid} for c in hand]}
            for s, hand in enumerate(state.players)
        ],
        "known": known,
        "king_looked": state.king_looked,
        "snap": (
            {
                "rank": state.snap.rank,
                "attempted": sorted(state.snap.attempted),
                "giver": state.snap.giver,
                "receiver": state.snap.receiver,
            }
            if state.snap
            else None
        ),
        "cambio_caller": state.cambio_caller,
        "final_turns": list(state.final_turns),
        "scores": state.scores,
        "winners": state.winners,
        "events": [
            {k: v for k, v in e.items() if k != "to"}
            for e in state.events
            if _event_visible(e, seat)
        ],
    }
