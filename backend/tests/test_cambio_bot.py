"""Bot + belief smoke tests: many full bot-vs-bot rounds must finish legally,
and the belief distribution must stay a coherent posterior."""

from app.cambio import engine as E
from app.cambio.belief import belief_for, full_pool
from app.cambio.config import CambioConfig
from app.cambio.engine import new_round, reduce
from app.cambio.simulate import play_round


def test_bot_rounds_complete():
    wins = [0, 0]
    for seed in range(60):
        result = play_round(CambioConfig(), seed=seed)
        state = result.state
        assert state.phase == E.ROUND_END
        assert state.scores is not None and len(state.scores) == 2
        assert not result.forced, f"seed {seed} needed a forced cambio"
        for w in state.winners:
            wins[w] += 1
    # Both seats win sometimes — the game isn't degenerate.
    assert wins[0] > 0 and wins[1] > 0


def test_bot_scores_reasonable():
    totals = []
    for seed in range(40):
        state = play_round(CambioConfig(), seed=seed).state
        totals.append(min(state.scores))
    avg = sum(totals) / len(totals)
    # A bot that peeks and swaps should land winning hands well under the
    # ~21.2 expectation of four random cards.
    assert avg < 12, f"winning average {avg} — bot is not actually playing"


def test_belief_distribution_sums_to_one():
    state = new_round(CambioConfig(), seed=7)
    b = belief_for(state, 0)
    assert abs(sum(b["dist"].values()) - 1.0) < 0.01
    # 54 cards minus the 2 cards seen during the opening peek.
    assert b["pool_size"] == 52
    # Unknown in-play uids: own top row (2) + all 4 opponent cards.
    assert len(b["unknown_uids"]) == 6


def test_belief_updates_on_peek():
    state = new_round(CambioConfig(), seed=7)
    reduce(state, E.SERVER_SEAT, {"type": "close_opening"})
    before = belief_for(state, 0)["pool_size"]
    state.stock.append(E.Card(900, "7", "D"))
    reduce(state, 0, {"type": "draw_stock"})
    reduce(state, 0, {"type": "play"})
    reduce(state, 0, {"type": "peek", "target": 0, "slot": 0})
    after = belief_for(state, 0)
    # Saw two more faces: the synthetic 7 that was played and the peeked own
    # card (the injected card sits outside the 54, hence −2 not −1).
    assert after["pool_size"] == before - 2
    assert len(after["unknown_uids"]) == 5


def test_full_pool_counts():
    pool = full_pool(CambioConfig())
    assert sum(pool.values()) == 54
    assert pool["KR"] == 2 and pool["KB"] == 2 and pool["JO"] == 2
