from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_all(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, payload: UserCreate, verification_token: str | None = None) -> User:
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        name=payload.name,
        is_verified=verification_token is None,
        verification_token=verification_token,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def verify(db: AsyncSession, user: User) -> User:
    user.is_verified = True
    user.verification_token = None
    await db.commit()
    await db.refresh(user)
    return user


async def get_by_verification_token(db: AsyncSession, token: str) -> User | None:
    result = await db.execute(select(User).where(User.verification_token == token))
    return result.scalar_one_or_none()
