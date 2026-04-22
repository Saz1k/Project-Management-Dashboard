from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Invitation(Base, TimestampMixin):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))
    invitee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    inviter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="pending")

    board: Mapped[Board] = relationship(foreign_keys=[board_id])
    invitee: Mapped[User] = relationship(foreign_keys=[invitee_id])
    inviter: Mapped[User] = relationship(foreign_keys=[inviter_id])


from app.models.board import Board  # noqa: E402
from app.models.user import User  # noqa: E402
