from pydantic import BaseModel
from typing import Optional
from app.schemas.boton_opcion import BotonOpcionOut


class BotonCreate(BaseModel):
    botonera_id: int
    nombre: str
    producto_codigo: str = ""   # vacío permitido para tipo "combo" (el código va en cada opción)
    max_unidades: int = 1
    visible: bool = True
    orden: int = 0
    color: str = "#1677ff"
    fila: Optional[int] = None      # fila en la cuadrícula (1-based, None = auto)
    columna: Optional[int] = None   # columna en la cuadrícula (1-based, None = auto)
    col_span: int = 1               # ancho en columnas
    row_span: int = 1               # alto en filas
    tipo: str = "simple"            # "simple" | "combo"


class BotonUpdate(BaseModel):
    nombre: Optional[str] = None
    producto_codigo: Optional[str] = None
    max_unidades: Optional[int] = None
    visible: Optional[bool] = None
    orden: Optional[int] = None
    color: Optional[str] = None
    fila: Optional[int] = None
    columna: Optional[int] = None
    col_span: Optional[int] = None
    row_span: Optional[int] = None
    tipo: Optional[str] = None


class BotonOut(BaseModel):
    id: int
    botonera_id: int
    nombre: str
    producto_codigo: str
    max_unidades: int
    visible: bool
    orden: int
    color: str
    fila: Optional[int] = None
    columna: Optional[int] = None
    col_span: int = 1
    row_span: int = 1
    tipo: str = "simple"
    opciones: list[BotonOpcionOut] = []

    model_config = {"from_attributes": True}
