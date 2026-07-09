"""language: flashcards, FSRS state, faux-amis, tasks, targets, conjugations

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, ENUM

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

language_code = ENUM("es", "fr", name="language_code", create_type=False)
card_type = ENUM("basic", "cloze", "audio", name="card_type", create_type=False)
card_direction = ENUM(
    "recognition", "production", name="card_direction", create_type=False
)
card_source = ENUM(
    "manual", "paste", "kobo", "youtube", "lyric", "conjugation", "system",
    name="card_source", create_type=False,
)
review_state = ENUM(
    "new", "learning", "review", "relearning", name="review_state", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in (language_code, card_type, card_direction, card_source, review_state):
        enum.create(bind, checkfirst=True)

    op.create_table(
        "flashcard_decks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("language", language_code, nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "flashcards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "deck_id",
            sa.Integer(),
            sa.ForeignKey("flashcard_decks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("card_type", card_type, nullable=False, server_default="basic"),
        sa.Column(
            "direction", card_direction, nullable=False, server_default="recognition"
        ),
        sa.Column("front", sa.Text(), nullable=False),
        sa.Column("back", sa.Text(), nullable=False),
        sa.Column("ipa", sa.String(200), nullable=False, server_default=""),
        sa.Column("gender", sa.String(20), nullable=False, server_default=""),
        sa.Column("part_of_speech", sa.String(40), nullable=False, server_default=""),
        sa.Column("audio_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("example", sa.Text(), nullable=False, server_default=""),
        sa.Column("example_translation", sa.Text(), nullable=False, server_default=""),
        sa.Column("cognate_note", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "is_false_friend", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("source", card_source, nullable=False, server_default="manual"),
        sa.Column("source_ref", sa.String(200), nullable=False, server_default=""),
        sa.Column("tags", ARRAY(sa.String()), nullable=False, server_default="{}"),
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
        "flashcard_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "card_id",
            sa.Integer(),
            sa.ForeignKey("flashcards.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("state", review_state, nullable=False, server_default="new"),
        sa.Column("step", sa.Integer(), nullable=True),
        sa.Column("stability", sa.Float(), nullable=True),
        sa.Column("difficulty", sa.Float(), nullable=True),
        sa.Column(
            "due",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            index=True,
        ),
        sa.Column("last_review", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lapses", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "review_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "card_id",
            sa.Integer(),
            sa.ForeignKey("flashcards.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("language", language_code, nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("state", review_state, nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            index=True,
        ),
    )

    op.create_table(
        "false_friends",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fr", sa.String(80), nullable=False, unique=True),
        sa.Column("es", sa.String(80), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
    )

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

    op.create_table(
        "verbs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("infinitive", sa.String(60), nullable=False, unique=True),
        sa.Column("group", sa.String(20), nullable=False),
        sa.Column("is_irregular", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("translation", sa.String(120), nullable=False),
        sa.Column("es_equivalent", sa.String(60), nullable=False, server_default=""),
        sa.Column("frequency_rank", sa.Integer(), nullable=False),
    )

    op.create_table(
        "conjugations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "verb_id",
            sa.Integer(),
            sa.ForeignKey("verbs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("mood", sa.String(30), nullable=False),
        sa.Column("tense", sa.String(40), nullable=False),
        sa.Column("person", sa.String(20), nullable=False),
        sa.Column("form", sa.String(120), nullable=False),
        sa.Column("es_form", sa.String(120), nullable=False, server_default=""),
        sa.Column("audio_url", sa.String(500), nullable=False, server_default=""),
        sa.UniqueConstraint("verb_id", "mood", "tense", "person"),
    )


def downgrade() -> None:
    op.drop_table("conjugations")
    op.drop_table("verbs")
    op.drop_table("language_targets")
    op.drop_table("language_tasks")
    op.drop_table("false_friends")
    op.drop_table("review_logs")
    op.drop_table("flashcard_reviews")
    op.drop_table("flashcards")
    op.drop_table("flashcard_decks")
    bind = op.get_bind()
    for enum in (review_state, card_source, card_direction, card_type, language_code):
        enum.drop(bind, checkfirst=True)
