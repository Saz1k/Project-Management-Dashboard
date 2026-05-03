from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.checklist import ChecklistItemCreate, ChecklistItemResponse, ChecklistItemUpdate
from app.services import board as board_service
from app.services import checklist as checklist_service
from app.services import column as column_service
from app.services import task as task_service

router = APIRouter(tags=["checklist"])


async def _get_task_or_404(task_id: int, user_id: int, db: DbDep):
    task = await task_service.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    column = await column_service.get_by_id(db, task.column_id)
    if not await board_service.is_accessible(db, column.board_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this board")
    return task, column.board_id


async def _require_checklist_permission(task_id: int, user_id: int, db: DbDep) -> None:
    task, board_id = await _get_task_or_404(task_id, user_id, db)
    board = await board_service.get_by_id(db, board_id)
    if task.assignee_id != user_id and (not board or board.owner_id != user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the task assignee or board owner can update checklist items",
        )


@router.get("/tasks/{task_id}/checklist", response_model=list[ChecklistItemResponse])
async def list_checklist(
    task_id: int, current_user: CurrentUserDep, db: DbDep
) -> list[ChecklistItemResponse]:
    await _get_task_or_404(task_id, current_user.id, db)
    return await checklist_service.get_all(db, task_id)


@router.post(
    "/tasks/{task_id}/checklist",
    response_model=ChecklistItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_checklist_item(
    task_id: int, payload: ChecklistItemCreate, current_user: CurrentUserDep, db: DbDep
) -> ChecklistItemResponse:
    await _get_task_or_404(task_id, current_user.id, db)
    return await checklist_service.create(db, payload, task_id)


@router.patch("/checklist/{item_id}", response_model=ChecklistItemResponse)
async def update_checklist_item(
    item_id: int, payload: ChecklistItemUpdate, current_user: CurrentUserDep, db: DbDep
) -> ChecklistItemResponse:
    item = await checklist_service.get_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found")
    await _require_checklist_permission(item.task_id, current_user.id, db)
    return await checklist_service.update(db, item, payload)


@router.delete("/checklist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist_item(item_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    item = await checklist_service.get_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found")
    await _get_task_or_404(item.task_id, current_user.id, db)
    await checklist_service.delete(db, item)
