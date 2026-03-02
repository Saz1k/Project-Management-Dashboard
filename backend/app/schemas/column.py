from pydantic import BaseModel, ConfigDict


class ColumnCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str


class ColumnUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = None
    position: int | None = None


class ColumnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    board_id: int
    position: int
