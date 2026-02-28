from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.associations import board_members
from app.models.board import Board
from app.models.user import User
from app.schemas.board import BoardCreate, BoardUpdate


def _with_members():
    return selectinload(Board.members)


async def get_all(db: AsyncSession, user_id: int) -> list[Board]:
    result = await db.execute(
        select(Board)
        .where(
            or_(
                Board.owner_id == user_id,
                Board.id.in_(select(board_members.c.board_id).where(board_members.c.user_id == user_id)),
            )
        )
        .options(_with_members())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, board_id: int) -> Board | None:
    result = await db.execute(
        select(Board).where(Board.id == board_id).options(_with_members())
    )
    return result.scalar_one_or_none()


async def is_accessible(db: AsyncSession, board_id: int, user_id: int) -> bool:
    board = await get_by_id(db, board_id)
    if not board:
        return False
    if board.owner_id == user_id:
        return True
    return any(m.id == user_id for m in board.members)


async def create(db: AsyncSession, payload: BoardCreate, owner_id: int) -> Board:
    board = Board(**payload.model_dump(), owner_id=owner_id)
    db.add(board)
    await db.commit()
    await db.refresh(board)
    result = await db.execute(select(Board).where(Board.id == board.id).options(_with_members()))
    return result.scalar_one()


async def update(db: AsyncSession, board: Board, payload: BoardUpdate) -> Board:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(board, key, value)
    await db.commit()
    result = await db.execute(select(Board).where(Board.id == board.id).options(_with_members()))
    return result.scalar_one()


async def delete(db: AsyncSession, board: Board) -> None:
    await db.delete(board)
    await db.commit()


async def add_member(db: AsyncSession, board: Board, user: User) -> Board:
    if not any(m.id == user.id for m in board.members):
        board.members.append(user)
        await db.commit()
    result = await db.execute(select(Board).where(Board.id == board.id).options(_with_members()))
    return result.scalar_one()


async def remove_member(db: AsyncSession, board: Board, user: User) -> Board:
    board.members = [m for m in board.members if m.id != user.id]
    await db.commit()
    result = await db.execute(select(Board).where(Board.id == board.id).options(_with_members()))
    return result.scalar_one()
