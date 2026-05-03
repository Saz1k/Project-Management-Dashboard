import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUserDep, DbDep
from app.core.email import send_verification_email
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserResponse, UserShort
from app.services import user as user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: DbDep) -> UserResponse:
    if await user_service.get_by_email(db, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    verification_token = secrets.token_urlsafe(32) if settings.smtp_host else None
    user = await user_service.create(db, payload, verification_token=verification_token)

    if verification_token:
        import asyncio
        asyncio.create_task(send_verification_email(user.email, verification_token))

    return user


@router.post("/login", response_model=Token)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbDep,
) -> Token:
    user = await user_service.get_by_email(db, form.username)
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Check your inbox.",
        )
    return Token(access_token=create_access_token(str(user.id)))


@router.get("/verify/{token}", response_model=UserResponse)
async def verify_email(token: str, db: DbDep) -> UserResponse:
    user = await user_service.get_by_verification_token(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired verification token")
    return await user_service.verify(db, user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUserDep) -> UserResponse:
    return current_user


@router.get("/users", response_model=list[UserShort])
async def list_users(current_user: CurrentUserDep, db: DbDep) -> list[UserShort]:
    return await user_service.get_all(db)
