from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checklist_item import ChecklistItem
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskMove, TaskUpdate


def _with_relations():
    return (selectinload(Task.labels), selectinload(Task.checklist_items))


async def get_all(db: AsyncSession, column_id: int) -> list[Task]:
    result = await db.execute(
        select(Task).where(Task.column_id == column_id).order_by(Task.position).options(*_with_relations())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, task_id: int) -> Task | None:
    result = await db.execute(select(Task).where(Task.id == task_id).options(*_with_relations()))
    return result.scalar_one_or_none()


async def _refresh_with_relations(db: AsyncSession, task: Task) -> Task:
    await db.refresh(task)
    result = await db.execute(select(Task).where(Task.id == task.id).options(*_with_relations()))
    return result.scalar_one()


async def create(db: AsyncSession, payload: TaskCreate, column_id: int) -> Task:
    result = await db.execute(select(func.count()).select_from(Task).where(Task.column_id == column_id))
    position = result.scalar() or 0
    task = Task(**payload.model_dump(), column_id=column_id, position=position)
    db.add(task)
    await db.commit()
    return await _refresh_with_relations(db, task)


async def update(db: AsyncSession, task: Task, payload: TaskUpdate) -> Task:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    await db.commit()
    return await _refresh_with_relations(db, task)


async def move(db: AsyncSession, task: Task, payload: TaskMove) -> Task:
    task.column_id = payload.column_id
    task.position = payload.position
    await db.commit()
    return await _refresh_with_relations(db, task)


async def delete(db: AsyncSession, task: Task) -> None:
    await db.delete(task)
    await db.commit()
