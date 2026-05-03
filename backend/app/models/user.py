from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(100))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    verification_token: Mapped[str | None] = mapped_column(String(128), nullable=True)

    boards: Mapped[list[Board]] = relationship(back_populates="owner")
    member_boards: Mapped[list[Board]] = relationship(secondary="board_members", back_populates="members")
    assigned_tasks: Mapped[list[Task]] = relationship(back_populates="assignee")
    comments: Mapped[list[Comment]] = relationship(back_populates="author")


from app.models.board import Board  # noqa: E402
from app.models.task import Task  # noqa: E402
from app.models.comment import Comment  # noqa: E402
