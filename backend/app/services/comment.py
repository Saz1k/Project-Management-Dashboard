from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentUpdate


async def get_all(db: AsyncSession, task_id: int) -> list[Comment]:
    result = await db.execute(select(Comment).where(Comment.task_id == task_id))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, comment_id: int) -> Comment | None:
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, payload: CommentCreate, task_id: int, author_id: int) -> Comment:
    comment = Comment(content=payload.content, task_id=task_id, author_id=author_id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def update(db: AsyncSession, comment: Comment, payload: CommentUpdate) -> Comment:
    comment.content = payload.content
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete(db: AsyncSession, comment: Comment) -> None:
    await db.delete(comment)
    await db.commit()
