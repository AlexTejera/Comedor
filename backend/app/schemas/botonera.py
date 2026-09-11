from pydantic import BaseModel
from typing import Optional
from app.schemas.boton import BotonOut


class BotoneraCreate(BaseModel):
    nombre: str
    hora_inicio: str  # "HH:MM"
    hora_fin: str     # "HH:MM"
    activa: bool = True
    orden: int = 0
    num_columnas: int = 3   # columnas del CSS grid en el kiosko
    num_filas:    int = 3   # filas del CSS grid en el kiosko


class BotoneraUpdate(BaseModel):
    nombre: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    activa: Optional[bool] = None
    orden: Optional[int] = None
    num_columnas: Optional[int] = None
    num_filas:    Optional[int] = None


class BotoneraOut(BaseModel):
    id: int
    nombre: str
    hora_inicio: str
    hora_fin: str
    activa: bool
    orden: int
    num_columnas: int = 3
    num_filas:    int = 3

    model_config = {"from_attributes": True}


class BotoneraConBotones(BotoneraOut):
    botones: list[BotonOut] = []
