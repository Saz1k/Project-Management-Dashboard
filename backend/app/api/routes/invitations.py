from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUserDep, DbDep
from app.models.user import User
from app.schemas.invitation import InvitationCreate, InvitationResponse
from app.services import board as board_service
from app.services import invitation as invitation_service

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.get("/", response_model=list[InvitationResponse])
async def my_invitations(current_user: CurrentUserDep, db: DbDep) -> list[InvitationResponse]:
    return await invitation_service.get_pending_for_user(db, current_user.id)


@router.post("/boards/{board_id}", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def send_invitation(
    board_id: int, payload: InvitationCreate, current_user: CurrentUserDep, db: DbDep
) -> InvitationResponse:
    board = await board_service.get_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can invite members")

    invitee = await db.scalar(select(User).where(User.id == payload.user_id))
    if not invitee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if invitee.id == board.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner is already a member")
    if any(m.id == invitee.id for m in board.members):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a member")
    if await invitation_service.already_invited(db, board_id, invitee.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation already sent")

    return await invitation_service.create(db, board_id, invitee.id, current_user.id)


@router.post("/{invitation_id}/accept", response_model=InvitationResponse)
async def accept_invitation(invitation_id: int, current_user: CurrentUserDep, db: DbDep) -> InvitationResponse:
    inv = await invitation_service.get_by_id(db, invitation_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if inv.invitee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your invitation")
    if inv.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation already resolved")

    board = await board_service.get_by_id(db, inv.board_id)
    if board:
        await board_service.add_member(db, board, inv.invitee)

    return await invitation_service.set_status(db, inv, "accepted")


@router.post("/{invitation_id}/reject", response_model=InvitationResponse)
async def reject_invitation(invitation_id: int, current_user: CurrentUserDep, db: DbDep) -> InvitationResponse:
    inv = await invitation_service.get_by_id(db, invitation_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if inv.invitee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your invitation")
    if inv.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation already resolved")

    return await invitation_service.set_status(db, inv, "rejected")


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(invitation_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    inv = await invitation_service.get_by_id(db, invitation_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    board = await board_service.get_by_id(db, inv.board_id)
    if not board or board.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the board owner can cancel invitations")
    await invitation_service.set_status(db, inv, "cancelled")
