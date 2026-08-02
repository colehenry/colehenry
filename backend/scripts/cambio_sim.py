"""Offline Monte-Carlo Cambio simulator.

Runs bot-vs-bot rounds with the SAME engine the live game uses
(app/cambio/engine.py), so every number here transfers exactly to live play.

Run locally from /backend:

    source .venv/bin/activate
    python scripts/cambio_sim.py --games 100000 --workers 8

Reports: seat win rates, score distributions, snap outcome rates, cambio-call
accuracy, and an EV table per drawn pseudo-rank (swap vs play win%) — the
"I drew D, what should I do?" chart. Offline analysis is allowed to read true
faces; live play never is.
"""

from __future__ import annotations

import argparse
import random
import sys
from collections import Counter
from multiprocessing import Pool
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.cambio import engine as E  # noqa: E402
from app.cambio.belief import pseudo_rank  # noqa: E402
from app.cambio.bot import choose_move  # noqa: E402
from app.cambio.config import CambioConfig  # noqa: E402
from app.cambio.engine import new_round, reduce  # noqa: E402
from app.cambio.simulate import FORCE_CAMBIO_AFTER, HARD_STOP  # noqa: E402


def new_stats() -> dict:
    return {
        "games": 0,
        "wins": Counter(),  # seat -> wins (ties count for both)
        "winning_scores": [],
        "all_scores": [],
        "moves": [],
        "snap": Counter(),  # correct / wrong / offload
        "cambio": Counter(),  # called_and_won / called_and_lost / forced
        # drawn pseudo-rank -> action -> [times, wins-for-actor]
        "draw_ev": {},
    }


def run_one(config: CambioConfig, seed: int, stats: dict) -> None:
    state = new_round(config, seed=seed)
    rng = random.Random(seed ^ 0x5EED)
    moves = 0
    forced = False
    decisions: list[tuple[int, str, str]] = []  # (seat, drawn pseudo, action)

    while state.phase != E.ROUND_END and moves < HARD_STOP:
        if state.phase == E.SNAP:
            acted = False
            seats = list(range(len(state.players)))
            rng.shuffle(seats)  # who reacts first is chance
            for seat in seats:
                move = choose_move(state, seat, rng)
                if move is not None:
                    reduce(state, seat, move)
                    ev = state.events[0] if state.events else {}
                    if ev.get("type") == "snap_attempt":
                        stats["snap"]["correct" if ev["correct"] else "wrong"] += 1
                        if ev["correct"] and ev["seat"] != ev["by"]:
                            stats["snap"]["offload"] += 1
                    acted = True
                    break
            if not acted:
                reduce(state, E.SERVER_SEAT, {"type": "close_snap"})
        elif state.phase == E.SNAP_GIVE:
            reduce(state, state.snap.giver, choose_move(state, state.snap.giver, rng))
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
            if state.phase == E.DRAWN and move["type"] in ("swap", "play"):
                decisions.append((seat, pseudo_rank(state.drawn), move["type"]))
            reduce(state, seat, move)
        moves += 1

    if state.phase != E.ROUND_END:
        return  # hard stop tripped; skip this pathological round

    stats["games"] += 1
    stats["moves"].append(moves)
    for w in state.winners:
        stats["wins"][w] += 1
    stats["winning_scores"].append(min(state.scores))
    stats["all_scores"].extend(state.scores)

    if state.cambio_caller is not None:
        if forced:
            stats["cambio"]["forced"] += 1
        elif state.cambio_caller in state.winners:
            stats["cambio"]["called_and_won"] += 1
        else:
            stats["cambio"]["called_and_lost"] += 1

    for seat, pr, action in decisions:
        cell = stats["draw_ev"].setdefault(pr, {}).setdefault(action, [0, 0])
        cell[0] += 1
        cell[1] += int(seat in state.winners)


def run_chunk(args: tuple[int, int]) -> dict:
    start, count = args
    config = CambioConfig()
    stats = new_stats()
    for seed in range(start, start + count):
        run_one(config, seed, stats)
    return stats


def merge(a: dict, b: dict) -> dict:
    a["games"] += b["games"]
    a["wins"].update(b["wins"])
    a["winning_scores"].extend(b["winning_scores"])
    a["all_scores"].extend(b["all_scores"])
    a["moves"].extend(b["moves"])
    a["snap"].update(b["snap"])
    a["cambio"].update(b["cambio"])
    for pr, actions in b["draw_ev"].items():
        for act, (n, w) in actions.items():
            cell = a["draw_ev"].setdefault(pr, {}).setdefault(act, [0, 0])
            cell[0] += n
            cell[1] += w
    return a


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--games", type=int, default=10_000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    chunk = max(1, args.games // args.workers)
    jobs = [
        (args.seed + i * chunk, min(chunk, args.games - i * chunk))
        for i in range(args.workers)
        if args.games - i * chunk > 0
    ]
    if args.workers > 1:
        with Pool(args.workers) as pool:
            results = pool.map(run_chunk, jobs)
    else:
        results = [run_chunk(j) for j in jobs]

    total = results[0]
    for r in results[1:]:
        total = merge(total, r)

    g = total["games"]
    print(f"\n=== Cambio sim — {g} rounds, 2 heuristic bots ===")
    for seat in (0, 1):
        print(f"seat {seat} win rate: {total['wins'][seat] / g:.3f}")
    ws = total["winning_scores"]
    alls = total["all_scores"]
    print(f"avg winning score: {sum(ws)/len(ws):.2f}")
    print(f"avg score overall: {sum(alls)/len(alls):.2f}")
    print(f"avg moves/round:   {sum(total['moves'])/g:.1f}")

    snap = total["snap"]
    attempts = snap["correct"] + snap["wrong"]
    if attempts:
        print(
            f"snaps: {attempts} ({attempts/g:.2f}/round), "
            f"accuracy {snap['correct']/attempts:.3f}, offloads {snap['offload']}"
        )
    cc = total["cambio"]
    called = cc["called_and_won"] + cc["called_and_lost"]
    if called:
        print(
            f"cambio-call accuracy: {cc['called_and_won']/called:.3f} "
            f"({called} genuine calls, {cc['forced']} forced)"
        )

    print("\ndrawn card -> action EV table (win% when actor took the action)")
    print(f"{'draw':>5} {'swap n':>8} {'swap win%':>10} {'play n':>8} {'play win%':>10}")
    order = ["JO", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "KR", "KB"]
    for pr in order:
        actions = total["draw_ev"].get(pr, {})
        sw = actions.get("swap", [0, 0])
        pl = actions.get("play", [0, 0])
        swp = f"{sw[1]/sw[0]:.3f}" if sw[0] else "-"
        plp = f"{pl[1]/pl[0]:.3f}" if pl[0] else "-"
        print(f"{pr:>5} {sw[0]:>8} {swp:>10} {pl[0]:>8} {plp:>10}")


if __name__ == "__main__":
    main()
