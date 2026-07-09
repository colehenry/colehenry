"""translation cache for wiki definitions

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "translation_cache",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("digest", sa.String(40), nullable=False, unique=True),
        sa.Column("target_lang", sa.String(5), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("translated", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("translation_cache")
