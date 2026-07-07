"""One-time import of the Catan CSVs into Postgres.

Run after migrations: `python -m app.seed_catan [path/to/catan_data]`
Idempotent — exits without touching anything if catan_games already has rows.
The CSVs are not needed at runtime after this.
"""

import csv
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal
from app.models import CatanGame, CatanPlayer, CatanResult

# Raw addresses in the CSV → display names.
LOCATIONS = {
    "1651 redcliff st": "Redcliff",
    "621 mariposa ave": "Mariposa",
}

# Only this crew counts toward dashboard aggregates; everyone else is a guest.
DASHBOARD_PLAYERS = {"jaren", "cole", "aditya", "dan", "allen"}


def _int_or_none(raw: str) -> int | None:
    raw = raw.strip().lower()
    return None if raw in ("", "na") else int(raw)


def seed(data_dir: Path) -> None:
    games_csv = data_dir / "games.csv"
    stats_csv = data_dir / "player_stats.csv"

    with SessionLocal() as db:
        existing = db.execute(select(CatanGame.id).limit(1)).first()
        if existing:
            print("catan_games already has data — nothing to do")
            return

        players: dict[str, CatanPlayer] = {}

        def get_player(raw_name: str) -> CatanPlayer:
            key = raw_name.strip().lower()
            if key not in players:
                player = CatanPlayer(
                    name=key.title(),
                    show_in_dashboard=key in DASHBOARD_PLAYERS,
                )
                db.add(player)
                db.flush()
                players[key] = player
            return players[key]

        games: dict[str, CatanGame] = {}
        winners: dict[str, str] = {}
        with games_csv.open() as f:
            for row in csv.DictReader(f):
                game = CatanGame(
                    played_at=datetime.strptime(row["date"], "%m-%d-%y").date(),
                    location=LOCATIONS.get(
                        row["location"].strip().lower(), row["location"].strip()
                    ),
                    notes=row["notes"].strip(),
                )
                db.add(game)
                games[row["game_id"]] = game
                winners[row["game_id"]] = row["winner"].strip().lower()
        db.flush()

        count = 0
        with stats_csv.open() as f:
            for row in csv.DictReader(f):
                game = games[row["game_id"]]
                player = get_player(row["player_name"])
                db.add(
                    CatanResult(
                        game_id=game.id,
                        player_id=player.id,
                        starting_pips=_int_or_none(row["starting_pips"]),
                        victory_points=_int_or_none(row["victory_points"]),
                        largest=row["largest"].strip().upper() == "TRUE",
                        longest=row["longest"].strip().upper() == "TRUE",
                        won=row["player_name"].strip().lower() == winners[row["game_id"]],
                    )
                )
                count += 1

        db.commit()
        print(f"seeded {len(games)} games, {len(players)} players, {count} results")


if __name__ == "__main__":
    default = Path(__file__).resolve().parents[2] / "catan_data"
    seed(Path(sys.argv[1]) if len(sys.argv) > 1 else default)
