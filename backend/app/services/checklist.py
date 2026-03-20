from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.checklist_item import ChecklistItem
from app.schemas.checklist import ChecklistItemCreate, ChecklistItemUpdate


async def get_all(db: AsyncSession, task_id: int) -> list[ChecklistItem]:
    result = await db.execute(
        select(ChecklistItem)
        .where(ChecklistItem.task_id == task_id)
        .order_by(ChecklistItem.position)
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, item_id: int) -> ChecklistItem | None:
    result = await db.execute(select(ChecklistItem).where(ChecklistItem.id == item_id))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, payload: ChecklistItemCreate, task_id: int) -> ChecklistItem:
    result = await db.execute(
        select(func.count()).select_from(ChecklistItem).where(ChecklistItem.task_id == task_id)
    )
    position = result.scalar() or 0
    item = ChecklistItem(text=payload.text, task_id=task_id, position=position)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update(db: AsyncSession, item: ChecklistItem, payload: ChecklistItemUpdate) -> ChecklistItem:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


async def delete(db: AsyncSession, item: ChecklistItem) -> None:
    await db.delete(item)
    await db.commit()
