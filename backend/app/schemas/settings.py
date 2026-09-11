from pydantic import BaseModel
from typing import Optional


class SettingOut(BaseModel):
    key: str
    value: str
    descripcion: str

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: str


class SettingsBulkUpdate(BaseModel):
    settings: dict[str, str]


class TestConnectionResult(BaseModel):
    ok: bool
    mensaje: str
