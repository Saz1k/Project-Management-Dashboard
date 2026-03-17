from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.label import LabelCreate, LabelResponse, LabelUpdate
from app.services import board as board_service
from app.services import column as column_service
from app.services import label as label_service
from app.services import task as task_service

router = APIRouter(tags=["labels"])


async def _get_board_and_check_access(board_id: int, user_id: int, db: DbDep):
    board = await board_service.get_by_id(db, board_id)
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if not await board_service.is_accessible(db, board_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this board")
    return board


async def _get_label_and_check_access(label_id: int, user_id: int, db: DbDep):
    label = await label_service.get_by_id(db, label_id)
    if not label:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    await _get_board_and_check_access(label.board_id, user_id, db)
    return label


@router.get("/boards/{board_id}/labels", response_model=list[LabelResponse])
async def list_labels(board_id: int, current_user: CurrentUserDep, db: DbDep) -> list[LabelResponse]:
    await _get_board_and_check_access(board_id, current_user.id, db)
    return await label_service.get_all(db, board_id)


@router.post("/boards/{board_id}/labels", response_model=LabelResponse, status_code=status.HTTP_201_CREATED)
async def create_label(
    board_id: int, payload: LabelCreate, current_user: CurrentUserDep, db: DbDep
) -> LabelResponse:
    await _get_board_and_check_access(board_id, current_user.id, db)
    return await label_service.create(db, payload, board_id)


@router.patch("/labels/{label_id}", response_model=LabelResponse)
async def update_label(
    label_id: int, payload: LabelUpdate, current_user: CurrentUserDep, db: DbDep
) -> LabelResponse:
    label = await _get_label_and_check_access(label_id, current_user.id, db)
    return await label_service.update(db, label, payload)


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label(label_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    label = await _get_label_and_check_access(label_id, current_user.id, db)
    await label_service.delete(db, label)


@router.post("/tasks/{task_id}/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def assign_label(task_id: int, label_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    task = await task_service.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    column = await column_service.get_by_id(db, task.column_id)
    await _get_board_and_check_access(column.board_id, current_user.id, db)
    label = await _get_label_and_check_access(label_id, current_user.id, db)
    await label_service.assign_to_task(db, task, label)


@router.delete("/tasks/{task_id}/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_label(task_id: int, label_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    task = await task_service.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    column = await column_service.get_by_id(db, task.column_id)
    await _get_board_and_check_access(column.board_id, current_user.id, db)
    label = await _get_label_and_check_access(label_id, current_user.id, db)
    await label_service.remove_from_task(db, task, label)
