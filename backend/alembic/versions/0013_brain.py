"""brain notes + links (second-brain vault index)

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fuzzy proper-noun matching for search (pg_trgm). No `vector` extension —
    # vector RAG is deferred (see context/brain_plan.md §0.5, Phase 6).
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "brain_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("path", sa.Text(), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False, server_default=""),
        sa.Column("body_md", sa.Text(), nullable=False, server_default=""),
        sa.Column("frontmatter", JSONB(), nullable=False, server_default="{}"),
        sa.Column("content_hash", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Full-text over title + body as a Postgres generated column, so it always
    # tracks the row without app-side maintenance. Private notes carry an empty
    # body_md, so they contribute only their title (harmless) to the index.
    op.execute(
        "ALTER TABLE brain_notes ADD COLUMN tsv tsvector "
        "GENERATED ALWAYS AS ("
        "to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body_md,''))"
        ") STORED"
    )
    op.create_index("ix_brain_notes_tsv", "brain_notes", ["tsv"], postgresql_using="gin")
    # Trigram index on title for fuzzy fallback matching.
    op.execute(
        "CREATE INDEX ix_brain_notes_title_trgm ON brain_notes "
        "USING gin (title gin_trgm_ops)"
    )

    op.create_table(
        "brain_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "src_note_id",
            sa.Integer(),
            sa.ForeignKey("brain_notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dst_path", sa.Text(), nullable=False),
        sa.Column(
            "dst_note_id",
            sa.Integer(),
            sa.ForeignKey("brain_notes.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_brain_links_src", "brain_links", ["src_note_id"])
    op.create_index("ix_brain_links_dst", "brain_links", ["dst_note_id"])


def downgrade() -> None:
    op.drop_table("brain_links")
    op.drop_table("brain_notes")
    # pg_trgm extension left in place (harmless, may be shared).
