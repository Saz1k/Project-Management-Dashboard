from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.column import ColumnCreate, ColumnResponse, ColumnUpdate
from app.services import board as board_service
from app.services import column as column_service

router = APIRouter(tags=["columns"])


async def _get_board_and_check_access(board_id: int, user_id: int, db: DbDep):
    board = await board_service.get_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if not await board_service.is_accessible(db, board_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this board")
    return board


async def _get_column_and_check_access(column_id: int, user_id: int, db: DbDep):
    column = await column_service.get_by_id(db, column_id)
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    await _get_board_and_check_access(column.board_id, user_id, db)
    return column


@router.get("/boards/{board_id}/columns", response_model=list[ColumnResponse])
async def list_columns(board_id: int, current_user: CurrentUserDep, db: DbDep) -> list[ColumnResponse]:
    await _get_board_and_check_access(board_id, current_user.id, db)
    return await column_service.get_all(db, board_id)


@router.post("/boards/{board_id}/columns", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(
    board_id: int, payload: ColumnCreate, current_user: CurrentUserDep, db: DbDep
) -> ColumnResponse:
    await _get_board_and_check_access(board_id, current_user.id, db)
    return await column_service.create(db, payload, board_id)


@router.patch("/columns/{column_id}", response_model=ColumnResponse)
async def update_column(
    column_id: int, payload: ColumnUpdate, current_user: CurrentUserDep, db: DbDep
) -> ColumnResponse:
    column = await _get_column_and_check_access(column_id, current_user.id, db)
    return await column_service.update(db, column, payload)


@router.delete("/columns/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(column_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    column = await _get_column_and_check_access(column_id, current_user.id, db)
    await column_service.delete(db, column)
