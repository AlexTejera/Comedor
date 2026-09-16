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
    icono_url: Optional[str] = None      # nombre de archivo en la galería
    imagen_ajuste: str = "cover"          # CSS background-size: cover | contain | "100% 100%"
    imagen_posicion: str = "center"       # CSS background-position: center | top | bottom | left | right | "top left" | ...
    texto_posicion: str = "center"        # dónde se ancla el título (mismos 9 valores)
    controles_posicion: str = "bottom"    # dónde se ancla el stepper −/+ (solo tipo "simple")
    texto_fuente: str = "inherit"         # CSS font-family
    texto_tamano: int = 18                # px del título (el stepper usa el mismo valor)


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
    icono_url: Optional[str] = None
    imagen_ajuste: Optional[str] = None
    imagen_posicion: Optional[str] = None
    texto_posicion: Optional[str] = None
    controles_posicion: Optional[str] = None
    texto_fuente: Optional[str] = None
    texto_tamano: Optional[int] = None


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
    icono_url: Optional[str] = None
    imagen_ajuste: str = "cover"
    imagen_posicion: str = "center"
    texto_posicion: str = "center"
    controles_posicion: str = "bottom"
    texto_fuente: str = "inherit"
    texto_tamano: int = 18
    opciones: list[BotonOpcionOut] = []

    model_config = {"from_attributes": True}
