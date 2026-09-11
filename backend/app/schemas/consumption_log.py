from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ConsumptionLogOut(BaseModel):
    id: int
    empleado_cod: int
    nombre_empleado: str
    tipo: str
    items_json: str
    resultado: str
    mensaje: str
    fecha_hora: datetime

    model_config = {"from_attributes": True}


class LogsResponse(BaseModel):
    total: int
    registros: list[ConsumptionLogOut]
