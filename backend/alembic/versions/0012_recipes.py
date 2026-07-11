"""recipes

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(160), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("rating", sa.Numeric(3, 1), nullable=False, server_default="0"),
        sa.Column("ingredients", JSONB(), nullable=False, server_default="[]"),
        sa.Column("steps", JSONB(), nullable=False, server_default="[]"),
        sa.Column("photo_urls", JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "tags", ARRAY(sa.String()), nullable=False, server_default="{}"
        ),
        sa.Column("servings", sa.Integer(), nullable=True),
        sa.Column("cook_minutes", sa.Integer(), nullable=True),
        sa.Column("source_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("source_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("language", sa.String(5), nullable=False, server_default="en"),
        sa.Column("translations", JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "visibility",
            ENUM(
                "public",
                "passcode",
                "private",
                name="visibility",
                create_type=False,  # created in 0001
            ),
            nullable=False,
            server_default="public",
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


def downgrade() -> None:
    op.drop_table("recipes")
