from typing import Optional
from pydantic import BaseModel


class ArticuloCreate(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    categoria: str
    sub_categoria: str
    precio: float = 0


class ArticuloUpdate(BaseModel):
    """
    Sin `codigo` ni `nombre` — son inmutables una vez creado el artículo
    (ver sql/sp_comedor_articulos.sql: evita romper la trazabilidad
    contable de consumos ya registrados).
    """
    descripcion: Optional[str] = None
    categoria: str
    sub_categoria: str
    precio: float = 0


class ArticuloOut(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    categoria: str
    subCategoria: str
    precio: float
