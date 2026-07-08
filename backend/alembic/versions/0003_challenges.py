"""challenge completions + state

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "challenge_completions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("challenge_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("completed_at", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "challenge_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ordering", ARRAY(sa.Integer()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("challenge_state")
    op.drop_table("challenge_completions")
