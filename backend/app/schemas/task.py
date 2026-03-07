from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.label import LabelResponse

_VALID_PRIORITIES = {"low", "medium", "high", "critical"}


def _validate_priority(v: str | None) -> str | None:
    if v is None:
        return v
    if v not in _VALID_PRIORITIES:
        raise ValueError(f"priority must be one of {sorted(_VALID_PRIORITIES)} or null")
    return v


class TaskCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str
    description: str | None = None
    assignee_id: int | None = None
    due_date: datetime | None = None
    priority: str | None = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str | None) -> str | None:
        return _validate_priority(v)


class TaskUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = None
    description: str | None = None
    assignee_id: int | None = None
    due_date: datetime | None = None
    priority: str | None = None

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str | None) -> str | None:
        return _validate_priority(v)


class TaskMove(BaseModel):
    column_id: int
    position: int


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    title: str
    description: str | None
    column_id: int
    position: int
    assignee_id: int | None
    due_date: datetime | None
    created_at: datetime
    priority: str | None = None
    labels: list[LabelResponse] = []
    checklist: list["ChecklistItemResponse"] = Field(default=[], validation_alias="checklist_items")


from app.schemas.checklist import ChecklistItemResponse  # noqa: E402

TaskResponse.model_rebuild()
