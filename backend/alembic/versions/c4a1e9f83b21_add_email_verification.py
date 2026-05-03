"""add email verification

Revision ID: c4a1e9f83b21
Revises: 10332de35f4e
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = "c4a1e9f83b21"
down_revision = "10332de35f4e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("users", sa.Column("verification_token", sa.String(128), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "verification_token")
    op.drop_column("users", "is_verified")
