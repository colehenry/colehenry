"""French learning hub: vocab state, results, generated cache, sessions, tests, interference log

Revision ID: 0020
Revises: 0019
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts(name: str, **kw):
    return sa.Column(name, sa.DateTime(timezone=True), **kw)


def upgrade() -> None:
    op.create_table(
        "learning_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("active_sprint", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("settings", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        _ts("updated_at", nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "learning_vocab",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("curriculum_id", sa.String(80), nullable=True, unique=True),
        sa.Column("french", sa.String(160), nullable=False),
        sa.Column("spanish", sa.String(200), nullable=False, server_default=""),
        sa.Column("english", sa.String(200), nullable=False, server_default=""),
        sa.Column("part_of_speech", sa.String(40), nullable=False, server_default=""),
        sa.Column("gender", sa.String(8), nullable=False, server_default=""),
        sa.Column("ipa", sa.String(120), nullable=False, server_default=""),
        sa.Column("sprint", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("status", sa.String(20), nullable=False, server_default="core"),
        sa.Column("frequency_band", sa.String(20), nullable=False, server_default=""),
        sa.Column("example_fr", sa.Text(), nullable=False, server_default=""),
        sa.Column("example_es", sa.Text(), nullable=False, server_default=""),
        sa.Column("pattern", sa.String(200), nullable=False, server_default=""),
        sa.Column("spanish_connection", sa.Text(), nullable=False, server_default=""),
        sa.Column("pronunciation_warning", sa.Text(), nullable=False, server_default=""),
        sa.Column("cognate_type", sa.String(20), nullable=False, server_default="none"),
        sa.Column("false_friend", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reference_links", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("tags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("source", sa.String(20), nullable=False, server_default="curriculum"),
        sa.Column("text_id", sa.Integer(), sa.ForeignKey("language_texts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lexeme_id", sa.Integer(), sa.ForeignKey("language_lexemes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recognition", sa.Float(), nullable=False, server_default="0"),
        sa.Column("audio_recognition", sa.Float(), nullable=False, server_default="0"),
        sa.Column("written_production", sa.Float(), nullable=False, server_default="0"),
        sa.Column("spoken_production", sa.Float(), nullable=False, server_default="0"),
        sa.Column("contextual_use", sa.Float(), nullable=False, server_default="0"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        _ts("last_seen_at", nullable=True),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
        _ts("updated_at", nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_learning_vocab_sprint_status", "learning_vocab", ["sprint", "status"])

    op.create_table(
        "learning_generated",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("params_hash", sa.String(40), nullable=False),
        sa.Column("format", sa.String(40), nullable=False),
        sa.Column("sprint", sa.Integer(), nullable=False),
        sa.Column("targets", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("model", sa.String(120), nullable=False, server_default=""),
        sa.Column("prompt_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("valid", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("served_count", sa.Integer(), nullable=False, server_default="0"),
        _ts("last_served_at", nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct", sa.Integer(), nullable=False, server_default="0"),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_learning_generated_lookup", "learning_generated", ["format", "sprint", "params_hash"])

    op.create_table(
        "learning_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
        sa.Column("sprint", sa.Integer(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="rules"),
        sa.Column("plan", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("completed", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        _ts("completed_at", nullable=True),
    )

    op.create_table(
        "learning_tests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sprint", sa.Integer(), nullable=False),
        _ts("started_at", nullable=False, server_default=sa.func.now()),
        _ts("completed_at", nullable=True),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("scores", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("profile", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("readiness", sa.Float(), nullable=False, server_default="0"),
        sa.Column("passed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("weak", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.create_index("ix_learning_tests_sprint", "learning_tests", ["sprint"])

    op.create_table(
        "learning_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        _ts("occurred_at", nullable=False, server_default=sa.func.now()),
        sa.Column("sprint", sa.Integer(), nullable=False),
        sa.Column("activity_id", sa.String(60), nullable=False, server_default=""),
        sa.Column("format", sa.String(40), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="deterministic"),
        sa.Column("skill", sa.String(20), nullable=False),
        sa.Column("target_ids", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("dims", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("answer", sa.Text(), nullable=False, server_default=""),
        sa.Column("expected", sa.Text(), nullable=False, server_default=""),
        sa.Column("time_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("generated_id", sa.Integer(), sa.ForeignKey("learning_generated.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("learning_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("test_id", sa.Integer(), sa.ForeignKey("learning_tests.id", ondelete="SET NULL"), nullable=True),
        sa.Column("meta", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_learning_results_occurred_at", "learning_results", ["occurred_at"])
    op.create_index("ix_learning_results_sprint_time", "learning_results", ["sprint", "occurred_at"])
    op.create_index("ix_learning_results_format", "learning_results", ["format"])

    op.create_table(
        "learning_interference",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("error", sa.Text(), nullable=False),
        sa.Column("correct", sa.Text(), nullable=False),
        sa.Column("spanish_source", sa.Text(), nullable=False, server_default=""),
        sa.Column("explanation", sa.Text(), nullable=False, server_default=""),
        sa.Column("ref", sa.String(120), nullable=False, server_default=""),
        sa.Column("pattern", sa.String(200), nullable=False, server_default=""),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("times_seen", sa.Integer(), nullable=False, server_default="1"),
        _ts("next_review", nullable=False, server_default=sa.func.now()),
        _ts("last_seen", nullable=False, server_default=sa.func.now()),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("learning_interference")
    op.drop_table("learning_results")
    op.drop_table("learning_tests")
    op.drop_table("learning_sessions")
    op.drop_table("learning_generated")
    op.drop_table("learning_vocab")
    op.drop_table("learning_state")
