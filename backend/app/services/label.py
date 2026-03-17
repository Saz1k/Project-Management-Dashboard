from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.label import Label
from app.models.task import Task
from app.schemas.label import LabelCreate, LabelUpdate


async def get_all(db: AsyncSession, board_id: int) -> list[Label]:
    result = await db.execute(select(Label).where(Label.board_id == board_id))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, label_id: int) -> Label | None:
    result = await db.execute(select(Label).where(Label.id == label_id))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, payload: LabelCreate, board_id: int) -> Label:
    label = Label(**payload.model_dump(), board_id=board_id)
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return label


async def update(db: AsyncSession, label: Label, payload: LabelUpdate) -> Label:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(label, key, value)
    await db.commit()
    await db.refresh(label)
    return label


async def delete(db: AsyncSession, label: Label) -> None:
    await db.delete(label)
    await db.commit()


async def assign_to_task(db: AsyncSession, task: Task, label: Label) -> None:
    if label not in task.labels:
        task.labels.append(label)
        await db.commit()


async def remove_from_task(db: AsyncSession, task: Task, label: Label) -> None:
    if label in task.labels:
        task.labels.remove(label)
        await db.commit()
