from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DbDep
from app.schemas.comment import CommentCreate, CommentResponse, CommentUpdate
from app.services import board as board_service
from app.services import column as column_service
from app.services import comment as comment_service
from app.services import task as task_service

router = APIRouter(tags=["comments"])


async def _get_task_or_404(task_id: int, user_id: int, db: DbDep):
    task = await task_service.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    column = await column_service.get_by_id(db, task.column_id)
    if not await board_service.is_accessible(db, column.board_id, user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this board")
    return task


@router.get("/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(task_id: int, current_user: CurrentUserDep, db: DbDep) -> list[CommentResponse]:
    await _get_task_or_404(task_id, current_user.id, db)
    return await comment_service.get_all(db, task_id)


@router.post("/tasks/{task_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    task_id: int, payload: CommentCreate, current_user: CurrentUserDep, db: DbDep
) -> CommentResponse:
    await _get_task_or_404(task_id, current_user.id, db)
    return await comment_service.create(db, payload, task_id, current_user.id)


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int, payload: CommentUpdate, current_user: CurrentUserDep, db: DbDep
) -> CommentResponse:
    comment = await comment_service.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your comment")
    return await comment_service.update(db, comment, payload)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(comment_id: int, current_user: CurrentUserDep, db: DbDep) -> None:
    comment = await comment_service.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your comment")
    await comment_service.delete(db, comment)
