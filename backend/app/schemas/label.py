import re

from pydantic import BaseModel, ConfigDict, field_validator


class LabelCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str
    color: str = "#6366f1"

    @field_validator("color")
    @classmethod
    def valid_hex(cls, v: str) -> str:
        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("Color must be a valid hex color, e.g. #6366f1")
        return v.lower()


class LabelUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = None
    color: str | None = None

    @field_validator("color")
    @classmethod
    def valid_hex(cls, v: str | None) -> str | None:
        if v and not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("Color must be a valid hex color, e.g. #6366f1")
        return v.lower() if v else v


class LabelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    board_id: int
