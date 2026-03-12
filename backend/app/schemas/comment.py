from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CommentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str


class CommentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content: str


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    task_id: int
    author_id: int
    created_at: datetime
