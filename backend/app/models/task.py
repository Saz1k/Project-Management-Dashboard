from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.associations import task_labels
from app.models.base import Base, TimestampMixin


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    column_id: Mapped[int] = mapped_column(ForeignKey("columns.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    priority: Mapped[str | None] = mapped_column(String(20), nullable=True)

    column: Mapped[Column] = relationship(back_populates="tasks")
    assignee: Mapped[User | None] = relationship(back_populates="assigned_tasks")
    comments: Mapped[list[Comment]] = relationship(back_populates="task", cascade="all, delete-orphan")
    labels: Mapped[list[Label]] = relationship(secondary=task_labels, back_populates="tasks")
    checklist_items: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="ChecklistItem.position",
    )


from app.models.column import Column  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.comment import Comment  # noqa: E402
from app.models.label import Label  # noqa: E402
from app.models.checklist_item import ChecklistItem  # noqa: E402
