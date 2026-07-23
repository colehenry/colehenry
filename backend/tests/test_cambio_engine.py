"""Engine unit tests against the rules in context/cambio_plan.md §1.

Deterministic where it matters: instead of fishing for seeds, tests build a
state with `new_round` and then rewrite hands/stock/discard directly — the
engine only ever looks at the lists, so surgically placed cards make every
edge case reachable.
"""

import pytest

from app.cambio.config import CambioConfig
from app.cambio import engine as E
from app.cambio.engine import (
    Card,
    IllegalMove,
    card_value,
    legal_moves,
    new_round,
    power_of,
    reduce,
    view_for,
)


def make_state(seed=1, **cfg):
    return new_round(CambioConfig(**cfg), seed=seed)


def put(state, seat, slot, rank, suit):
    """Replace a grid card with a chosen face, keeping its uid."""
    old = state.players[seat][slot]
    state.players[seat][slot] = Card(old.uid, rank, suit)


def stack(state, rank, suit, uid=900):
    """Push a chosen card on top of the stock."""
    state.stock.append(Card(uid, rank, suit))


def close_snap(state):
    if state.phase == E.SNAP:
        reduce(state, E.SERVER_SEAT, {"type": "close_snap"})


# --- values -----------------------------------------------------------------


def test_card_values():
    assert card_value(Card(0, "JO", None)) == 0
    assert card_value(Card(0, "A", "S")) == 1
    assert card_value(Card(0, "7", "D")) == 7
    assert card_value(Card(0, "J", "C")) == 10
    assert card_value(Card(0, "Q", "H")) == 10
    assert card_value(Card(0, "K", "H")) == -1
    assert card_value(Card(0, "K", "D")) == -1
    assert card_value(Card(0, "K", "S")) == 10
    assert card_value(Card(0, "K", "C")) == 10


def test_powers():
    assert power_of(Card(0, "7", "S")) == E.PEEK_OWN
    assert power_of(Card(0, "8", "H")) == E.PEEK_OWN
    assert power_of(Card(0, "9", "S")) == E.PEEK_OPP
    assert power_of(Card(0, "10", "H")) == E.PEEK_OPP
    assert power_of(Card(0, "J", "S")) == E.BLIND_SWAP
    assert power_of(Card(0, "Q", "D")) == E.BLIND_SWAP
    assert power_of(Card(0, "K", "S")) == E.KING
    assert power_of(Card(0, "K", "H")) is None  # red king: valuable, powerless
    assert power_of(Card(0, "A", "S")) is None
    assert power_of(Card(0, "JO", None)) is None


# --- setup ------------------------------------------------------------------


def test_deal_shape_and_opening_peek():
    s = make_state()
    assert len(s.players) == 2
    assert all(len(h) == 4 for h in s.players)
    assert len(s.discard) == 1
    assert len(s.stock) == 54 - 8 - 1
    # Bottom two of your own hand are known; opponent's are not.
    for seat in (0, 1):
        hand = s.players[seat]
        assert {hand[2].uid, hand[3].uid} <= s.knowledge[seat]
        assert hand[0].uid not in s.knowledge[seat]
        # Nothing of the opponent's hand is known.
        assert not {c.uid for c in s.players[1 - seat]} & s.knowledge[seat]
    # Peek events are private.
    peeks = [e for e in s.events if e["type"] == "opening_peek"]
    assert len(peeks) == 2
    assert peeks[0]["to"] == [0]


def test_uid_does_not_encode_face():
    # Same uid across two seeds must be able to hold different faces.
    a, b = make_state(seed=1), make_state(seed=2)
    all_a = {c.uid: (c.rank, c.suit) for c in a.stock}
    all_b = {c.uid: (c.rank, c.suit) for c in b.stock}
    diffs = [u for u in all_a if u in all_b and all_a[u] != all_b[u]]
    assert diffs, "uids must be assigned after the shuffle"


# --- draw / swap / play -----------------------------------------------------


def test_draw_stock_swap_discards_replaced_card():
    s = make_state()
    stack(s, "5", "H")
    put(s, 0, 0, "Q", "S")
    reduce(s, 0, {"type": "draw_stock"})
    assert s.drawn.rank == "5"
    assert s.phase == E.DRAWN
    reduce(s, 0, {"type": "swap", "slot": 0})
    assert s.players[0][0].rank == "5"
    assert s.discard[-1].rank == "Q"
    assert s.phase == E.SNAP  # replaced card hit the discard
    close_snap(s)
    assert s.turn == 1 and s.phase == E.TURN


def test_swap_never_triggers_power():
    s = make_state()
    stack(s, "K", "S")  # black king drawn but swapped in, not played
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "swap", "slot": 1})
    assert s.phase == E.SNAP  # straight to snap window, no KING phase
    close_snap(s)
    assert s.turn == 1


def test_play_nonpower_card_ends_turn():
    s = make_state()
    stack(s, "3", "C")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.discard[-1].rank == "3"
    close_snap(s)
    assert s.turn == 1


def test_drawing_from_discard_cannot_be_played_back():
    s = make_state()
    s.discard.append(Card(901, "9", "H"))
    reduce(s, 0, {"type": "draw_discard"})
    assert s.drawn.rank == "9"
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "play"})
    reduce(s, 0, {"type": "swap", "slot": 2})
    assert s.players[0][2].rank == "9"


# --- powers -----------------------------------------------------------------


def test_peek_own_78():
    s = make_state()
    stack(s, "7", "D")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.PEEK_OWN
    target_uid = s.players[0][0].uid
    assert target_uid not in s.knowledge[0]
    reduce(s, 0, {"type": "peek", "target": 0, "slot": 0})
    assert target_uid in s.knowledge[0]
    close_snap(s)
    assert s.turn == 1


def test_peek_opp_910_rejects_own_card():
    s = make_state()
    stack(s, "10", "S")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.PEEK_OPP
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "peek", "target": 0, "slot": 0})
    uid = s.players[1][0].uid  # top row: seat 1 has not peeked it themselves
    reduce(s, 0, {"type": "peek", "target": 1, "slot": 0})
    assert uid in s.knowledge[0]
    # The peeked player does NOT learn their own card from your peek.
    assert uid not in s.knowledge[1]


def test_blind_swap_moves_cards_and_knowledge_follows_uid():
    s = make_state()
    stack(s, "J", "C")
    my_known = s.players[0][2]  # known from opening peek
    their = s.players[1][0]
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.BLIND_SWAP
    reduce(s, 0, {"type": "blind_swap", "slot": 2, "target": 1, "target_slot": 0})
    assert s.players[1][0].uid == my_known.uid
    assert s.players[0][2].uid == their.uid
    # I still know the card I gave away (it's in their grid now).
    assert my_known.uid in s.knowledge[0]
    # I did not learn the card I received.
    assert their.uid not in s.knowledge[0]


def test_black_king_look_then_swap():
    s = make_state()
    stack(s, "K", "C")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.KING
    uid = s.players[1][1].uid
    reduce(s, 0, {"type": "king_look", "target": 1, "slot": 1})
    assert uid in s.knowledge[0]
    assert s.phase == E.KING  # still may swap
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "king_look", "target": 1, "slot": 2})  # only one look
    reduce(s, 0, {"type": "king_swap", "slot": 0, "target": 1, "target_slot": 1})
    assert s.players[0][0].uid == uid
    close_snap(s)
    assert s.turn == 1


def test_king_skip():
    s = make_state()
    stack(s, "K", "S")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    reduce(s, 0, {"type": "skip_power"})
    close_snap(s)
    assert s.turn == 1


# --- snap -------------------------------------------------------------------


def snap_setup(rank="4"):
    """Seat 0 plays a `rank` card so a snap window on `rank` opens."""
    s = make_state()
    stack(s, rank, "H", uid=902)
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.SNAP
    assert s.snap.rank == rank
    return s


def test_snap_own_correct_sheds_card():
    s = snap_setup("4")
    put(s, 1, 0, "4", "C")
    reduce(s, 1, {"type": "snap", "target": 1, "slot": 0})
    assert len(s.players[1]) == 3
    assert s.discard[-1].rank == "4"
    assert s.phase == E.SNAP  # window stays open
    close_snap(s)


def test_snap_wrong_draws_penalty_and_publicizes():
    s = snap_setup("4")
    put(s, 1, 0, "9", "C")
    uid = s.players[1][0].uid
    reduce(s, 1, {"type": "snap", "target": 1, "slot": 0})
    assert len(s.players[1]) == 5  # kept + penalty
    # The flip revealed the card to everyone.
    assert uid in s.knowledge[0] and uid in s.knowledge[1]
    # One attempt per window.
    with pytest.raises(IllegalMove):
        reduce(s, 1, {"type": "snap", "target": 1, "slot": 1})


def test_snap_opponent_correct_offloads():
    s = snap_setup("4")
    put(s, 0, 1, "4", "S")  # seat 0 (the player who just played) holds a 4
    give_uid = s.players[1][2].uid
    reduce(s, 1, {"type": "snap", "target": 0, "slot": 1})
    assert s.phase == E.SNAP_GIVE
    assert len(s.players[0]) == 3
    reduce(s, 1, {"type": "snap_give", "slot": 2})
    assert len(s.players[1]) == 3
    assert len(s.players[0]) == 4  # got the offload
    assert s.players[0][-1].uid == give_uid
    assert s.phase == E.SNAP
    close_snap(s)
    assert s.turn == 1


def test_snap_opponent_wrong_snapper_pays():
    s = snap_setup("4")
    put(s, 0, 1, "9", "S")
    reduce(s, 1, {"type": "snap", "target": 0, "slot": 1})
    assert len(s.players[0]) == 4  # keeps their card
    assert len(s.players[1]) == 5  # snapper drew the penalty
    close_snap(s)


def test_snap_disabled_knob():
    s = make_state(snap_enabled=False)
    stack(s, "3", "C")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.TURN
    assert s.turn == 1


# --- cambio + scoring -------------------------------------------------------


def finish_final_turn(s, seat):
    stack(s, "2", "H", uid=903)
    reduce(s, seat, {"type": "draw_stock"})
    reduce(s, seat, {"type": "play"})
    close_snap(s)


def test_cambio_final_turn_and_scoring():
    s = make_state()
    # Known hands: seat 0 = red king + ace + joker + 2 (total 2)
    put(s, 0, 0, "K", "H")
    put(s, 0, 1, "A", "S")
    put(s, 0, 2, "JO", None)
    put(s, 0, 3, "2", "C")
    # seat 1 = Q + J + 10 + black king (total 40)
    put(s, 1, 0, "Q", "S")
    put(s, 1, 1, "J", "D")
    put(s, 1, 2, "10", "C")
    put(s, 1, 3, "K", "S")
    reduce(s, 0, {"type": "cambio"})
    assert s.cambio_caller == 0
    assert s.turn == 1
    finish_final_turn(s, 1)
    assert s.phase == E.ROUND_END
    assert s.scores[0] == -1 + 1 + 0 + 2
    # seat 1 swapped a 2 in? no — they played it. Their hand unchanged.
    assert s.scores[1] == 10 + 10 + 10 + 10
    assert s.winners == [0]


def test_caller_penalty_knob():
    s = make_state(caller_penalty=10)
    for i, (r, su) in enumerate([("Q", "S"), ("Q", "H"), ("Q", "D"), ("Q", "C")]):
        put(s, 0, i, r, su)
    for i, (r, su) in enumerate([("A", "S"), ("A", "H"), ("A", "D"), ("A", "C")]):
        put(s, 1, i, r, su)
    reduce(s, 0, {"type": "cambio"})  # terrible call
    finish_final_turn(s, 1)
    assert s.scores[0] == 40 + 10
    assert s.winners == [1]


def test_tie_is_shared_win():
    s = make_state()
    for seat in (0, 1):
        for i, (r, su) in enumerate([("A", "S" if seat else "H"), ("2", "C" if seat else "D"), ("3", "S" if seat else "H"), ("4", "C" if seat else "D")]):
            put(s, seat, i, r, su)
    reduce(s, 0, {"type": "cambio"})
    finish_final_turn(s, 1)
    assert s.winners == [0, 1]


def test_no_second_cambio():
    s = make_state()
    reduce(s, 0, {"type": "cambio"})
    with pytest.raises(IllegalMove):
        reduce(s, 1, {"type": "cambio"})


# --- masking ----------------------------------------------------------------


def test_view_hides_hidden_cards():
    s = make_state()
    v0 = view_for(s, 0)
    # Hands are uid-only.
    for p in v0["players"]:
        for slot in p["hand"]:
            assert set(slot.keys()) == {"uid"}
    # known covers exactly the opening peek + starting discard... minus the
    # discard (not in play). So exactly the two peeked cards.
    assert len(v0["known"]) == 2
    my_known_uids = {s.players[0][2].uid, s.players[0][3].uid}
    assert {int(k) for k in v0["known"]} == my_known_uids
    # Opponent's view knows nothing about seat 0's hand.
    v1 = view_for(s, 1)
    assert not ({int(k) for k in v1["known"]} & {c.uid for c in s.players[0]})


def test_view_masks_drawn_card():
    s = make_state()
    reduce(s, 0, {"type": "draw_stock"})
    v0, v1 = view_for(s, 0), view_for(s, 1)
    assert "card" in v0["drawn"]
    assert "card" not in v1["drawn"]


def test_round_end_reveals_everything():
    s = make_state()
    reduce(s, 0, {"type": "cambio"})
    finish_final_turn(s, 1)
    v1 = view_for(s, 1)
    all_uids = {c.uid for hand in s.players for c in hand}
    assert all_uids <= {int(k) for k in v1["known"]}


# --- variable hand size + reshuffle ----------------------------------------


def test_legal_moves_cover_variable_hand_sizes():
    s = snap_setup("4")
    put(s, 1, 0, "9", "C")
    reduce(s, 1, {"type": "snap", "target": 1, "slot": 0})  # wrong → 5 cards
    close_snap(s)
    assert s.turn == 1
    reduce(s, 1, {"type": "draw_stock"})
    swaps = [m for m in legal_moves(s, 1) if m["type"] == "swap"]
    assert len(swaps) == 5


def test_stock_reshuffles_from_discard():
    s = make_state()
    # Drain the stock into the discard.
    s.discard.extend(s.stock)
    s.stock = []
    top = s.discard[-1]
    reduce(s, 0, {"type": "draw_stock"})
    assert s.drawn is not None
    assert s.discard == [top]
    assert len(s.stock) > 0
