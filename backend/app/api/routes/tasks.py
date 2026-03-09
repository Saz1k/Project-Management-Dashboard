from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.task import TaskCreate, TaskMove, TaskResponse, TaskUpdate
from app.services import board as board_service
from app.services import column as column_service
from app.services import task as task_service

router = APIRouter(tags=["tasks"])


async def _check_column_access(column_id: int, user_id: int, db: DbDep):
    column = await column_service.get_by_id(db, column_id)
    if not column:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    if not await board_service.is_accessible(db, column.board_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this board")
    return column


async def _get_task_and_check_access(task_id: int, user_id: int, db: DbDep):
    task = await task_service.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await _check_column_access(task.column_id, user_id, db)
    return task


@router.get("/columns/{column_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(column_id: int, current_user: CurrentUserDep, db: DbDep) -> list[TaskResponse]:
    await _check_column_access(column_id, current_user.id, db)
    return await task_service.get_all(db, column_id)


@router.post("/columns/{column_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    column_id: int, payload: TaskCreate, current_user: CurrentUserDep, db: DbDep
) -> TaskResponse:
    await _check_column_access(column_id, current_user.id, db)
    return await task_service.create(db, payload, column_id)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, current_user: CurrentUserDep, db: DbDep) -> TaskResponse:
    return await _get_task_and_check_access(task_id, current_user.id, db)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int, payload: TaskUpdate, current_user: CurrentUserDep, db: DbDep
) -> TaskResponse:
    task = await _get_task_and_check_access(task_id, current_user.id, db)
    return await task_service.update(db, task, payload)


@router.post("/tasks/{task_id}/move", response_model=TaskResponse)
async def move_task(task_id: int, payload: TaskMove, current_user: CurrentUserDep, db: DbDep) -> TaskResponse:
    task = await _get_task_and_check_access(task_id, current_user.id, db)
    await _check_column_access(payload.column_id, current_user.id, db)
    return await task_service.move(db, task, payload)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    task = await _get_task_and_check_access(task_id, current_user.id, db)
    await task_service.delete(db, task)
