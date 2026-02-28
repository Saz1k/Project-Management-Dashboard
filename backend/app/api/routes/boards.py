from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUserDep, DbDep
from app.models.user import User
from app.schemas.board import BoardCreate, BoardResponse, BoardUpdate, MemberShort
from app.schemas.invitation import InvitationResponse
from app.services import board as board_service
from app.services import invitation as invitation_service

router = APIRouter(prefix="/boards", tags=["boards"])


def _check_owner(board_owner_id: int, user_id: int) -> None:
    if board_owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the board owner can do this")


async def _get_board_or_404(board_id: int, db: DbDep):
    board = await board_service.get_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    return board


async def _get_board_and_check_access(board_id: int, user_id: int, db: DbDep):
    board = await _get_board_or_404(board_id, db)
    if not await board_service.is_accessible(db, board_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this board")
    return board


@router.get("/", response_model=list[BoardResponse])
async def list_boards(current_user: CurrentUserDep, db: DbDep) -> list[BoardResponse]:
    return await board_service.get_all(db, current_user.id)


@router.post("/", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
async def create_board(payload: BoardCreate, current_user: CurrentUserDep, db: DbDep) -> BoardResponse:
    return await board_service.create(db, payload, current_user.id)


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(board_id: int, current_user: CurrentUserDep, db: DbDep) -> BoardResponse:
    return await _get_board_and_check_access(board_id, current_user.id, db)


@router.patch("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: int, payload: BoardUpdate, current_user: CurrentUserDep, db: DbDep
) -> BoardResponse:
    board = await _get_board_or_404(board_id, db)
    _check_owner(board.owner_id, current_user.id)
    return await board_service.update(db, board, payload)


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(board_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    board = await _get_board_or_404(board_id, db)
    _check_owner(board.owner_id, current_user.id)
    await board_service.delete(db, board)


@router.get("/{board_id}/members", response_model=list[MemberShort])
async def list_members(board_id: int, current_user: CurrentUserDep, db: DbDep) -> list[MemberShort]:
    await _get_board_and_check_access(board_id, current_user.id, db)
    board = await board_service.get_by_id(db, board_id)
    return board.members


@router.get("/{board_id}/invitations", response_model=list[InvitationResponse])
async def list_board_invitations(board_id: int, current_user: CurrentUserDep, db: DbDep) -> list[InvitationResponse]:
    board = await _get_board_or_404(board_id, db)
    _check_owner(board.owner_id, current_user.id)
    return await invitation_service.get_pending_for_board(db, board_id)


@router.delete("/{board_id}/members/{user_id}", response_model=BoardResponse)
async def remove_member(board_id: int, user_id: int, current_user: CurrentUserDep, db: DbDep) -> BoardResponse:
    board = await _get_board_or_404(board_id, db)
    _check_owner(board.owner_id, current_user.id)
    if user_id == board.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the owner")
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return await board_service.remove_member(db, board, user)
