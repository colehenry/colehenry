"""cambio games, players, rounds, and move log

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cambio_games",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.String(12), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("config", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "cambio_players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("game_id", sa.Integer(), sa.ForeignKey("cambio_games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seat", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("guest_name", sa.String(80), nullable=False, server_default=""),
        sa.Column("is_bot", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "cambio_rounds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("game_id", sa.Integer(), sa.ForeignKey("cambio_games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round_no", sa.Integer(), nullable=False),
        sa.Column("cambio_caller_seat", sa.Integer(), nullable=True),
        sa.Column("scores", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("winner_seats", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("was_caller_penalized", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "cambio_moves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("game_id", sa.Integer(), sa.ForeignKey("cambio_games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round_no", sa.Integer(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("seat", sa.Integer(), nullable=False),
        sa.Column("move", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("snap_correct", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_cambio_moves_game", "cambio_moves", ["game_id", "round_no", "seq"])
    op.create_index("ix_cambio_players_game", "cambio_players", ["game_id"])
    op.create_index("ix_cambio_rounds_game", "cambio_rounds", ["game_id"])


def downgrade() -> None:
    op.drop_table("cambio_moves")
    op.drop_table("cambio_rounds")
    op.drop_table("cambio_players")
    op.drop_table("cambio_games")
