"""language texts and annotations

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, ENUM

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

language_code = ENUM("es", "fr", name="language_code", create_type=False)


def upgrade() -> None:
    op.create_table(
        "language_texts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("language", language_code, nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False, server_default="other"),
        sa.Column("source_ref", sa.String(300), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False),
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
        "language_text_annotations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "text_id",
            sa.Integer(),
            sa.ForeignKey("language_texts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("start_offset", sa.Integer(), nullable=False),
        sa.Column("end_offset", sa.Integer(), nullable=False),
        sa.Column("selected_text", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False, server_default="highlight"),
        sa.Column("color", sa.String(30), nullable=False, server_default="brand"),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("translation", sa.Text(), nullable=False, server_default=""),
        sa.Column("ipa", sa.String(200), nullable=False, server_default=""),
        sa.Column("part_of_speech", sa.String(40), nullable=False, server_default=""),
        sa.Column("cognate_note", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "is_false_friend", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "deck_id",
            sa.Integer(),
            sa.ForeignKey("flashcard_decks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "flashcard_id",
            sa.Integer(),
            sa.ForeignKey("flashcards.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
    op.create_index(
        "ix_language_text_annotations_text_span",
        "language_text_annotations",
        ["text_id", "start_offset"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_language_text_annotations_text_span",
        table_name="language_text_annotations",
    )
    op.drop_table("language_text_annotations")
    op.drop_table("language_texts")
