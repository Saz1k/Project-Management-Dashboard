from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invitation import Invitation


def _load_relations():
    return (
        selectinload(Invitation.board),
        selectinload(Invitation.inviter),
        selectinload(Invitation.invitee),
    )


async def get_pending_for_user(db: AsyncSession, user_id: int) -> list[Invitation]:
    result = await db.execute(
        select(Invitation)
        .where(Invitation.invitee_id == user_id, Invitation.status == "pending")
        .options(*_load_relations())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, invitation_id: int) -> Invitation | None:
    result = await db.execute(
        select(Invitation).where(Invitation.id == invitation_id).options(*_load_relations())
    )
    return result.scalar_one_or_none()


async def get_pending_for_board(db: AsyncSession, board_id: int) -> list[Invitation]:
    result = await db.execute(
        select(Invitation)
        .where(Invitation.board_id == board_id, Invitation.status == "pending")
        .options(*_load_relations())
    )
    return list(result.scalars().all())


async def already_invited(db: AsyncSession, board_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(Invitation).where(
            Invitation.board_id == board_id,
            Invitation.invitee_id == user_id,
            Invitation.status == "pending",
        )
    )
    return result.scalar_one_or_none() is not None


async def create(db: AsyncSession, board_id: int, invitee_id: int, inviter_id: int) -> Invitation:
    inv = Invitation(board_id=board_id, invitee_id=invitee_id, inviter_id=inviter_id, status="pending")
    db.add(inv)
    await db.commit()
    return (await get_by_id(db, inv.id))  # type: ignore[return-value]


async def set_status(db: AsyncSession, invitation: Invitation, status: str) -> Invitation:
    invitation.status = status
    await db.commit()
    return (await get_by_id(db, invitation.id))  # type: ignore[return-value]
