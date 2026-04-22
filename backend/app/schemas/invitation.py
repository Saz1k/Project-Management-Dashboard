from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserShort


class BoardInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str


class InvitationCreate(BaseModel):
    user_id: int


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    board_id: int
    status: str
    created_at: datetime
    board: BoardInfo
    inviter: UserShort
    invitee: UserShort
