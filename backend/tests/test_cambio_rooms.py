"""Room-level integration: a stub human socket plays full vs-bot rounds
through the Room machinery (bot task, snap timer, masked broadcasts)."""

import asyncio
import random

from app.cambio import engine as E
from app.cambio.config import CambioConfig
from app.cambio.engine import legal_moves
from app.cambio.rooms import VS_BOT, Room, RoomManager


class StubSocket:
    def __init__(self):
        self.messages = []

    async def send_json(self, data):
        self.messages.append(data)


def run(coro):
    return asyncio.run(coro)


async def play_vs_bot_round(seed=0):
    config = CambioConfig(
        opening_peek_ms=1,
        power_reveal_ms=1,
        snap_window_ms=40,
    )
    room = Room("TEST01", VS_BOT, config, bot_delay=0.0)
    ws = StubSocket()
    seat = room.claim_seat("Cole", None)
    assert seat is not None and seat.seat == 0
    seat.ws = ws
    seat.connected = True
    seat.ready = True
    assert room.humans_ready()
    await room.start_round()

    rng = random.Random(seed)
    for _ in range(400):
        state = room.state
        if state.phase == E.ROUND_END:
            break
        moves = legal_moves(state, 0)
        actionable = state.turn == 0 and state.phase != E.SNAP_GIVE
        if state.phase == E.SNAP_GIVE and state.snap.giver == 0:
            actionable = True
        if actionable and moves:
            # Humans shouldn't spam cambio turn one; keep games short-ish
            # but sane: call only when few moves left.
            non_cambio = [m for m in moves if m["type"] != "cambio"]
            move = rng.choice(non_cambio or moves)
            try:
                await room.apply(0, move)
            except E.IllegalMove:
                pass
        else:
            await asyncio.sleep(0.02)  # let bot task / snap timer run
        if state.move_seq > 250 and state.phase == E.TURN and state.turn == 0:
            if state.cambio_caller is None:
                await room.apply(0, {"type": "cambio"})
    else:
        raise AssertionError("round did not finish")
    return room, ws


def test_vs_bot_round_completes():
    room, ws = run(play_vs_bot_round())
    assert room.state.phase == E.ROUND_END
    assert room.state.scores is not None
    # The human socket received masked views throughout.
    views = [m for m in ws.messages if m["type"] == "view"]
    assert views
    for v in views:
        for player in v["view"]["players"]:
            for slot in player["hand"]:
                assert "rank" not in slot  # uid-only over the wire
        assert "belief" in v["view"]


def test_room_manager_create_and_token_gate():
    mgr = RoomManager()
    room = mgr.create(VS_BOT)
    assert mgr.get(room.id) is room
    assert mgr.get(room.id.lower()) is room
    assert len(room.token) >= 8
    # Second human seat does not exist in vs_bot.
    first = room.claim_seat("A", None)
    assert first.seat == 0
    assert room.claim_seat("B", None) is None
    # Reconnect by seat token.
    again = room.claim_seat("", first.token)
    assert again is first
    assert room.claim_seat("", "wrong-token") is None


def test_two_humans_must_both_ready_before_deal():
    async def scenario():
        room = Room("READY2", "vs_human", CambioConfig())
        first = room.claim_seat("Cole", None)
        second = room.claim_seat("Friend", None)
        first.ws, second.ws = StubSocket(), StubSocket()
        first.connected = second.connected = True

        await room.mark_ready(first.seat)
        assert room.state is None
        assert first.ready and not second.ready

        await room.mark_ready(second.seat)
        assert room.state is not None
        assert room.state.phase == E.OPENING
        assert room.view_payload(first.seat)["room"]["opening_deadline_ms"] is not None
        assert room.round_no == 1
        assert not first.ready and not second.ready
        assert room.state.events == []
        assert any(
            event["type"] == "opening_peek"
            for event in first.ws.messages[-1]["view"]["events"]
        )

    run(scenario())


def test_bot_game_starts_when_the_human_readies():
    async def scenario():
        room = Room("READY1", VS_BOT, CambioConfig(), bot_delay=60)
        human = room.claim_seat("Cole", None)
        human.ws = StubSocket()
        human.connected = True
        assert room.state is None

        await room.mark_ready(human.seat)
        assert room.state is not None
        assert room.round_no == 1

    run(scenario())


def test_tied_humans_must_both_confirm_before_showdown():
    async def scenario():
        room = Room(
            "TIE222",
            "vs_human",
            CambioConfig(opening_peek_ms=60_000, snap_window_ms=60_000),
        )
        first = room.claim_seat("Cole", None)
        second = room.claim_seat("Friend", None)
        first.ws, second.ws = StubSocket(), StubSocket()
        first.connected = second.connected = True
        first.ready = second.ready = True
        await room.start_round()
        await room.apply(E.SERVER_SEAT, {"type": "close_opening"})

        for seat in (0, 1):
            for slot, (rank, suit) in enumerate(
                [("A", "S"), ("2", "H"), ("3", "C"), ("4", "D")]
            ):
                old = room.state.players[seat][slot]
                room.state.players[seat][slot] = E.Card(old.uid, rank, suit)

        await room.apply(0, {"type": "cambio"})
        room.state.stock.append(E.Card(904, "2", "H"))
        await room.apply(1, {"type": "draw_stock"})
        await room.apply(1, {"type": "play"})
        await room.apply(E.SERVER_SEAT, {"type": "close_snap"})
        assert room.state.phase == E.SHOWDOWN_PENDING
        assert room.state.scores == [10, 10]

        await room.mark_ready(first.seat)
        assert room.state.phase == E.SHOWDOWN_PENDING
        assert first.ready and not second.ready

        await room.mark_ready(second.seat)
        assert room.state.phase == E.OPENING
        assert room.state.sudden_death
        assert [len(hand) for hand in room.state.players] == [1, 1]
        assert not first.ready and not second.ready
        assert room.round_no == 1

    run(scenario())


def test_simultaneous_draw_and_snap_never_apply_a_stale_penalty():
    async def scenario():
        room = Room(
            "RACE22",
            "vs_human",
            CambioConfig(opening_peek_ms=60_000, snap_window_ms=60_000),
        )
        first = room.claim_seat("Cole", None)
        second = room.claim_seat("Friend", None)
        first.ws, second.ws = StubSocket(), StubSocket()
        first.connected = second.connected = True
        await room.start_round()
        await room.apply(E.SERVER_SEAT, {"type": "close_opening"})

        old = room.state.players[1][0]
        room.state.players[1][0] = E.Card(old.uid, "4", "C")
        room.state.stock.append(E.Card(904, "4", "H"))
        await room.apply(0, {"type": "draw_stock"})
        await room.apply(0, {"type": "play"})
        stale_candidate = next(
            move
            for move in E.legal_moves(room.state, 1)
            if move["type"] == "snap" and move["target"] == 1 and move["slot"] == 0
        )

        results = await asyncio.gather(
            room.apply(1, {"type": "draw_stock"}),
            room.apply(1, stale_candidate),
            return_exceptions=True,
        )
        assert all(
            result is None or isinstance(result, E.StaleMove) for result in results
        )
        assert len(room.state.players[1]) in (3, 4)

        for socket in (first.ws, second.ws):
            events = [
                event
                for message in socket.messages
                if message["type"] == "view"
                for event in message["view"]["events"]
            ]
            assert not any(event.get("type") == "penalty" for event in events)
            seqs = [
                message["view"]["move_seq"]
                for message in socket.messages
                if message["type"] == "view"
            ]
            assert seqs == sorted(seqs)

    run(scenario())
