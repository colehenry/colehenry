"""catan players, games, results

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "catan_players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "show_in_dashboard",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "catan_games",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("played_at", sa.Date(), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "catan_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "game_id",
            sa.Integer(),
            sa.ForeignKey("catan_games.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "player_id",
            sa.Integer(),
            sa.ForeignKey("catan_players.id"),
            nullable=False,
        ),
        sa.Column("starting_pips", sa.Integer(), nullable=True),
        sa.Column("victory_points", sa.Integer(), nullable=True),
        sa.Column("largest", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("longest", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("won", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("game_id", "player_id"),
    )


def downgrade() -> None:
    op.drop_table("catan_results")
    op.drop_table("catan_games")
    op.drop_table("catan_players")
