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
    StaleMove,
    card_value,
    legal_moves,
    new_round,
    power_of,
    reduce,
    view_for,
)


def make_state(seed=1, opening=False, **cfg):
    state = new_round(CambioConfig(**cfg), seed=seed)
    if not opening:
        reduce(state, E.SERVER_SEAT, {"type": "close_opening"})
    return state


def put(state, seat, slot, rank, suit):
    """Replace a grid card with a chosen face, keeping its uid."""
    old = state.players[seat][slot]
    state.players[seat][slot] = Card(old.uid, rank, suit)


def stack(state, rank, suit, uid=900):
    """Push a chosen card on top of the stock."""
    state.stock.append(Card(uid, rank, suit))


def close_snap(state):
    if state.snap is not None:
        reduce(state, E.SERVER_SEAT, {"type": "close_snap"})


def attempt_snap(state, seat, target, slot):
    card = state.players[target][slot]
    reduce(
        state,
        seat,
        {
            "type": "snap",
            "target": target,
            "slot": slot,
            "window_id": state.snap.window_id,
            "card_uid": card.uid,
        },
    )


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
    s = make_state(opening=True)
    assert s.phase == E.OPENING
    assert len(s.players) == 2
    assert all(len(h) == 4 for h in s.players)
    assert s.discard == []
    assert len(s.stock) == 54 - 8
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
    assert legal_moves(s, 0) == []
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "draw_stock"})
    reduce(s, E.SERVER_SEAT, {"type": "close_opening"})
    assert s.phase == E.TURN


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
    assert s.phase == E.TURN and s.turn == 1
    assert s.snap is not None and s.snap.rank == "Q"
    close_snap(s)
    assert s.turn == 1 and s.phase == E.TURN


def test_swap_never_triggers_power():
    s = make_state()
    stack(s, "K", "S")  # black king drawn but swapped in, not played
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "swap", "slot": 1})
    assert s.phase == E.TURN and s.snap is not None  # no KING phase
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


def test_discard_is_never_a_draw_source():
    s = make_state()
    s.discard.append(Card(901, "9", "H"))
    assert not any(m["type"] == "draw_discard" for m in legal_moves(s, 0))
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "draw_discard"})


# --- powers -----------------------------------------------------------------


def test_peek_own_78():
    s = make_state()
    stack(s, "7", "D")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.PEEK_OWN
    assert all(move["type"] != "skip_power" for move in legal_moves(s, 0))
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "skip_power"})
    target_uid = s.players[0][0].uid
    assert target_uid not in s.knowledge[0]
    reduce(s, 0, {"type": "peek", "target": 0, "slot": 0})
    assert target_uid in s.knowledge[0]
    assert s.phase == E.POWER_REVEAL
    assert view_for(s, 0)["active_reveal"]["card"]["uid"] == target_uid
    observer_reveal = view_for(s, 1)["active_reveal"]
    assert observer_reveal == {"target": 0, "slot": 0}
    assert legal_moves(s, 0) == [] and legal_moves(s, 1) == []
    reduce(s, E.SERVER_SEAT, {"type": "close_power_reveal"})
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
    assert s.phase == E.POWER_REVEAL
    reduce(s, E.SERVER_SEAT, {"type": "close_power_reveal"})


def test_blind_swap_moves_cards_and_knowledge_follows_uid():
    s = make_state()
    stack(s, "J", "C")
    my_known = s.players[0][2]  # known from opening peek
    their = s.players[1][0]
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.BLIND_SWAP
    assert all(move["type"] != "skip_power" for move in legal_moves(s, 0))
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "skip_power"})
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
    assert s.phase == E.POWER_REVEAL
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "king_swap", "slot": 0, "target": 1, "target_slot": 1})
    reduce(s, E.SERVER_SEAT, {"type": "close_power_reveal"})
    assert s.phase == E.KING  # reveal closed; now must swap
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "king_look", "target": 1, "slot": 2})  # only one look
    reduce(s, 0, {"type": "king_swap", "slot": 0, "target": 1, "target_slot": 1})
    assert s.players[0][0].uid == uid
    close_snap(s)
    assert s.turn == 1


def test_black_king_requires_look_then_swap():
    s = make_state()
    stack(s, "K", "S")
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "skip_power"})
    with pytest.raises(IllegalMove):
        reduce(s, 0, {"type": "king_swap", "slot": 0, "target": 1, "target_slot": 0})
    reduce(s, 0, {"type": "king_look", "target": 1, "slot": 0})
    reduce(s, E.SERVER_SEAT, {"type": "close_power_reveal"})
    moves = legal_moves(s, 0)
    assert moves and all(m["type"] == "king_swap" for m in moves)
    reduce(s, 0, {"type": "king_swap", "slot": 0, "target": 1, "target_slot": 0})
    assert s.turn == 1


# --- snap -------------------------------------------------------------------


def snap_setup(rank="4"):
    """Seat 0 plays a `rank` card so a snap window on `rank` opens."""
    s = make_state()
    stack(s, rank, "H", uid=902)
    reduce(s, 0, {"type": "draw_stock"})
    reduce(s, 0, {"type": "play"})
    assert s.phase == E.TURN and s.turn == 1
    assert s.snap is not None
    assert s.snap.rank == rank
    return s


def test_snap_own_correct_sheds_card():
    s = snap_setup("4")
    put(s, 1, 0, "4", "C")
    attempt_snap(s, 1, 1, 0)
    assert len(s.players[1]) == 3
    assert s.discard[-1].rank == "4"
    assert s.phase == E.TURN and s.snap is not None  # overlay stays open
    close_snap(s)


def test_multiple_correct_snaps_are_allowed_in_one_window():
    s = snap_setup("4")
    put(s, 1, 0, "4", "C")
    put(s, 1, 1, "4", "S")

    attempt_snap(s, 1, 1, 0)
    assert any(move["type"] == "snap" for move in legal_moves(s, 1))

    # The second matching card shifted into slot 0 after the first was shed.
    attempt_snap(s, 1, 1, 0)
    assert len(s.players[1]) == 2
    assert [card.rank for card in s.discard[-2:]] == ["4", "4"]
    assert 1 not in s.snap.attempted


def test_snap_wrong_draws_penalty_and_publicizes():
    s = snap_setup("4")
    put(s, 1, 0, "9", "C")
    uid = s.players[1][0].uid
    attempt_snap(s, 1, 1, 0)
    assert len(s.players[1]) == 5  # kept + penalty
    # The flip revealed the card to everyone.
    assert uid in s.knowledge[0] and uid in s.knowledge[1]
    # A wrong snap blocks further attempts for this player in the window.
    with pytest.raises(IllegalMove):
        attempt_snap(s, 1, 1, 1)


def test_snap_overlay_does_not_block_the_next_turn():
    s = snap_setup("4")
    moves = legal_moves(s, 1)
    assert any(m["type"] == "draw_stock" for m in moves)
    assert any(m["type"] == "snap" for m in moves)

    reduce(s, 1, {"type": "draw_stock"})
    assert s.phase == E.DRAWN
    assert s.snap is None


def test_empty_hand_wins_immediately():
    s = snap_setup("4")
    s.players[1] = s.players[1][:1]
    put(s, 1, 0, "4", "C")
    attempt_snap(s, 1, 1, 0)
    assert s.players[1] == []
    assert s.phase == E.ROUND_END
    assert s.winners == [1]
    assert any(e["type"] == "round_end" and e["reason"] == "empty_hand" for e in s.events)


def test_snap_opponent_correct_offloads():
    s = snap_setup("4")
    put(s, 0, 1, "4", "S")  # seat 0 (the player who just played) holds a 4
    give_uid = s.players[1][2].uid
    attempt_snap(s, 1, 0, 1)
    assert s.phase == E.SNAP_GIVE
    assert len(s.players[0]) == 3
    reduce(s, 1, {"type": "snap_give", "slot": 2})
    assert len(s.players[1]) == 3
    assert len(s.players[0]) == 4  # got the offload
    assert s.players[0][-1].uid == give_uid
    assert s.phase == E.TURN and s.snap is not None
    close_snap(s)
    assert s.turn == 1


def test_offloading_last_card_wins_immediately():
    s = snap_setup("4")
    put(s, 0, 1, "4", "S")
    s.players[1] = s.players[1][:1]
    attempt_snap(s, 1, 0, 1)
    assert s.phase == E.SNAP_GIVE
    reduce(s, 1, {"type": "snap_give", "slot": 0})
    assert s.players[1] == []
    assert s.phase == E.ROUND_END and s.winners == [1]


def test_snap_opponent_wrong_snapper_pays():
    s = snap_setup("4")
    put(s, 0, 1, "9", "S")
    attempt_snap(s, 1, 0, 1)
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


def test_stale_snap_from_previous_window_never_reveals_or_penalizes():
    s = snap_setup("4")
    put(s, 1, 0, "4", "C")
    card = s.players[1][0]
    stale = {
        "type": "snap",
        "target": 1,
        "slot": 0,
        "window_id": s.snap.window_id,
        "card_uid": card.uid,
    }

    # The opponent starts and finishes their turn, replacing the snap window.
    stack(s, "6", "D", uid=904)
    reduce(s, 1, {"type": "draw_stock"})
    reduce(s, 1, {"type": "play"})
    assert s.snap.rank == "6" and s.snap.window_id != stale["window_id"]

    before_hand = [c.uid for c in s.players[1]]
    before_knowledge = set(s.knowledge[0])
    with pytest.raises(StaleMove):
        reduce(s, 0, stale)
    assert [c.uid for c in s.players[1]] == before_hand
    assert s.knowledge[0] == before_knowledge
    assert s.events == []


def test_snap_removals_never_change_surviving_card_rows():
    s = snap_setup("4")
    put(s, 1, 0, "4", "C")
    put(s, 1, 2, "4", "S")
    original_rows = {card.uid: s.hand_rows[card.uid] for card in s.players[1]}

    attempt_snap(s, 1, 1, 0)  # four cards to three
    assert all(s.hand_rows[c.uid] == original_rows[c.uid] for c in s.players[1])

    attempt_snap(s, 1, 1, 1)  # three cards to two; original slot 2 shifted
    assert len(s.players[1]) == 2
    assert all(s.hand_rows[c.uid] == original_rows[c.uid] for c in s.players[1])
    rows_by_uid = {
        slot["uid"]: slot["row"] for slot in view_for(s, 1)["players"][1]["hand"]
    }
    assert rows_by_uid == {c.uid: original_rows[c.uid] for c in s.players[1]}


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


def test_tie_waits_for_confirmation_then_redeals_one_card_each():
    s = make_state()
    for seat in (0, 1):
        for i, (r, su) in enumerate([("A", "S" if seat else "H"), ("2", "C" if seat else "D"), ("3", "S" if seat else "H"), ("4", "C" if seat else "D")]):
            put(s, seat, i, r, su)
    reduce(s, 0, {"type": "cambio"})
    finish_final_turn(s, 1)
    assert s.phase == E.SHOWDOWN_PENDING
    assert s.scores == [10, 10]
    assert s.winners == [0, 1]
    assert all(
        card.uid in s.knowledge[viewer]
        for viewer in (0, 1)
        for hand in s.players
        for card in hand
    )

    reduce(s, E.SERVER_SEAT, {"type": "start_showdown"})
    assert s.phase == E.OPENING
    assert s.sudden_death
    assert s.winners is None and s.scores is None
    assert [len(hand) for hand in s.players] == [1, 1]
    assert len(s.stock) == 52 and s.discard == []
    assert s.players[0][0].uid in s.knowledge[0]
    assert s.players[1][0].uid in s.knowledge[1]

    reduce(s, E.SERVER_SEAT, {"type": "close_opening"})

    # Sudden death is a real one-card game and can resolve normally.
    put(s, 0, 0, "A", "S")
    put(s, 1, 0, "K", "S")
    reduce(s, 0, {"type": "cambio"})
    finish_final_turn(s, 1)
    assert s.phase == E.ROUND_END and s.winners == [0]


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
            assert set(slot.keys()) == {"uid", "row"}
    # known covers exactly the two opening-peek cards.
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
    assert v0["drawn"]["uid"] == v1["drawn"]["uid"] == s.drawn.uid
    assert "card" in v0["drawn"]
    assert "card" not in v1["drawn"]
    assert v0["legal_moves"] == legal_moves(s, 0)
    assert v1["legal_moves"] == []


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
    attempt_snap(s, 1, 1, 0)  # wrong → 5 cards
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
