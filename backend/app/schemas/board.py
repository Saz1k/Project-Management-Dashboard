from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BoardCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str
    description: str | None = None


class BoardUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = None
    description: str | None = None


class MemberShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None
    email: str


class BoardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    owner_id: int
    created_at: datetime
    members: list[MemberShort] = []
