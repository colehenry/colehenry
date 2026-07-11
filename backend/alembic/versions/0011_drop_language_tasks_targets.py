"""drop the unused gamification tables (language_tasks, language_targets)

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-10

The motivation dashboard (streaks / daily tasks / weekly targets) was removed
from the UI on 2026-07-08 and its backend endpoints deleted on 2026-07-10.
These two tables are no longer referenced by any model, router, or seed, so we
drop them. The downgrade recreates the schema from the original 0005 shape
(row data is not restored).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("language_targets")
    op.drop_table("language_tasks")


def downgrade() -> None:
    op.create_table(
        "language_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("text", sa.String(300), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("task_date", sa.Date(), nullable=True, index=True),
        sa.Column("recurrence", sa.String(20), nullable=False, server_default=""),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("language_tasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("action_ref", sa.String(100), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("template_id", "task_date"),
    )
    op.create_table(
        "language_targets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("metric", sa.String(40), nullable=False, unique=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("target", sa.Integer(), nullable=False),
        sa.Column("auto", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("manual_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("week_key", sa.String(10), nullable=False, server_default=""),
    )
