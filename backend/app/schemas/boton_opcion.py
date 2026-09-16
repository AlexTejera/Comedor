from pydantic import BaseModel
from typing import Optional


class BotonOpcionCreate(BaseModel):
    nombre: str
    producto_codigo: str
    orden: int = 0
    max_unidades: int = 1
    icono_url: Optional[str] = None  # nombre de archivo en la galería


class BotonOpcionUpdate(BaseModel):
    nombre: Optional[str] = None
    producto_codigo: Optional[str] = None
    orden: Optional[int] = None
    max_unidades: Optional[int] = None
    icono_url: Optional[str] = None


class BotonOpcionOut(BaseModel):
    id: int
    boton_id: int
    nombre: str
    producto_codigo: str
    orden: int
    max_unidades: int = 1
    icono_url: Optional[str] = None

    model_config = {"from_attributes": True}
