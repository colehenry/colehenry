"""French learning hub: resumable practice attempts

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "learning_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("activity_id", sa.String(60), nullable=False),
        sa.Column("title", sa.String(160), nullable=False, server_default=""),
        sa.Column("format", sa.String(40), nullable=False, server_default=""),
        sa.Column("skill", sa.String(20), nullable=False, server_default="grammar"),
        sa.Column("sprint", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("learning_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("graded", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_learning_attempts_open", "learning_attempts", ["finished_at", "activity_id"])


def downgrade() -> None:
    op.drop_table("learning_attempts")
