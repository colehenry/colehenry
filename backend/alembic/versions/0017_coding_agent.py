"""coding agent devices, tasks, and events

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "coding_devices",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("capabilities", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "coding_pairing_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "coding_tasks",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("device_id", sa.Text(), sa.ForeignKey("coding_devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("workspace_id", sa.Text(), nullable=False),
        sa.Column("workspace_name", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("branch", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="queued"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_coding_tasks_device_id", "coding_tasks", ["device_id"])
    op.create_table(
        "coding_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Text(), sa.ForeignKey("coding_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("task_id", "seq", name="uq_coding_events_task_seq"),
    )
    op.create_index("ix_coding_events_task_id", "coding_events", ["task_id"])


def downgrade() -> None:
    op.drop_table("coding_events")
    op.drop_table("coding_tasks")
    op.drop_table("coding_pairing_codes")
    op.drop_table("coding_devices")
