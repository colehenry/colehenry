"""archive coding sessions without deleting history

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "coding_tasks",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_coding_tasks_archived_at", "coding_tasks", ["archived_at"])


def downgrade() -> None:
    op.drop_index("ix_coding_tasks_archived_at", table_name="coding_tasks")
    op.drop_column("coding_tasks", "archived_at")
