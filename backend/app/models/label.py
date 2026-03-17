from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.associations import task_labels
from app.models.base import Base


class Label(Base):
    __tablename__ = "labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"))

    board: Mapped[Board] = relationship(back_populates="labels")
    tasks: Mapped[list[Task]] = relationship(secondary=task_labels, back_populates="labels")


from app.models.board import Board  # noqa: E402
from app.models.task import Task  # noqa: E402
