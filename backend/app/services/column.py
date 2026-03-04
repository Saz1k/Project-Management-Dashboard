from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.column import Column
from app.schemas.column import ColumnCreate, ColumnUpdate


async def get_all(db: AsyncSession, board_id: int) -> list[Column]:
    result = await db.execute(
        select(Column).where(Column.board_id == board_id).order_by(Column.position)
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, column_id: int) -> Column | None:
    result = await db.execute(select(Column).where(Column.id == column_id))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, payload: ColumnCreate, board_id: int) -> Column:
    result = await db.execute(select(func.count()).select_from(Column).where(Column.board_id == board_id))
    position = result.scalar() or 0
    column = Column(title=payload.title, board_id=board_id, position=position)
    db.add(column)
    await db.commit()
    await db.refresh(column)
    return column


async def update(db: AsyncSession, column: Column, payload: ColumnUpdate) -> Column:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(column, key, value)
    await db.commit()
    await db.refresh(column)
    return column


async def delete(db: AsyncSession, column: Column) -> None:
    await db.delete(column)
    await db.commit()
