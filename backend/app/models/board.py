from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.associations import board_members
from app.models.base import Base, TimestampMixin


class Board(Base, TimestampMixin):
    __tablename__ = "boards"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    owner: Mapped[User] = relationship(back_populates="boards")
    members: Mapped[list[User]] = relationship(secondary=board_members, back_populates="member_boards")
    columns: Mapped[list[Column]] = relationship(
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="Column.position",
    )
    labels: Mapped[list[Label]] = relationship(back_populates="board", cascade="all, delete-orphan")


from app.models.user import User  # noqa: E402
from app.models.column import Column  # noqa: E402
from app.models.label import Label  # noqa: E402
