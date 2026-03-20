from pydantic import BaseModel, ConfigDict


class ChecklistItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str


class ChecklistItemUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str | None = None
    completed: bool | None = None


class ChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    text: str
    completed: bool
    position: int
