"""wiki cache, annotation gender, lexique, reset conjugation audio

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, JSONB

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

language_code = ENUM("es", "fr", name="language_code", create_type=False)


def upgrade() -> None:
    op.add_column(
        "language_text_annotations",
        sa.Column("gender", sa.String(20), nullable=False, server_default=""),
    )

    op.create_table(
        "wiki_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("language", language_code, nullable=False),
        sa.Column("word", sa.String(120), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("language", "word"),
    )

    op.create_table(
        "lexique_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("word", sa.String(120), nullable=False),
        sa.Column("lemma", sa.String(120), nullable=False),
        sa.Column("pos", sa.String(30), nullable=False),
        sa.Column("gender", sa.String(4), nullable=False, server_default=""),
        sa.Column("frequency", sa.Float(), nullable=False, server_default="0"),
    )
    op.create_index("ix_lexique_entries_word", "lexique_entries", ["word"])

    # Conjugation audio now speaks "je suis" instead of "suis"; clear the old
    # bare-form clips so they lazily regenerate with the pronoun.
    op.execute("UPDATE conjugations SET audio_url = ''")


def downgrade() -> None:
    op.drop_index("ix_lexique_entries_word", table_name="lexique_entries")
    op.drop_table("lexique_entries")
    op.drop_table("wiki_entries")
    op.drop_column("language_text_annotations", "gender")
