"""
articulos.py
CRUD de artículos del comedor — viven en SUMMA (dbo.Articulos), no en la
BD local SQLite. Todas las operaciones pasan por Stored Procedures (ver
sql/sp_comedor_articulos.sql), igual que el resto de la integración con
SUMMA (summa_service.py).

Endpoints (todos requieren admin):
- GET    /api/articulos          : Lista todos los artículos.
- POST   /api/articulos          : Crea un artículo nuevo.
- PUT    /api/articulos/{codigo} : Edita un artículo (NO su código ni nombre).
- DELETE /api/articulos/{codigo} : Elimina un artículo (bloqueado si tiene consumos).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.articulo import ArticuloCreate, ArticuloUpdate, ArticuloOut
from app.services import summa_service
from app.services.summa_service import SummaConnectionError
from app.utils.security import require_admin

router = APIRouter()


@router.get("", response_model=list[ArticuloOut])
def list_articulos(db: Session = Depends(get_db), _=Depends(require_admin)):
    """Lista todos los artículos cargados en SUMMA."""
    try:
        return summa_service.listar_articulos(db)
    except SummaConnectionError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_articulo(data: ArticuloCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    """
    Crea un artículo nuevo en SUMMA.

    Errores (dentro del body, con HTTP 200 — igual que el resto de las
    respuestas de SUMMA en esta app): código duplicado, categoría/
    subcategoría inexistente. Ver sql/sp_comedor_articulos.sql.
    """
    resultado = summa_service.crear_articulo(
        codigo=data.codigo,
        nombre=data.nombre,
        descripcion=data.descripcion,
        categoria=data.categoria,
        sub_categoria=data.sub_categoria,
        precio=data.precio,
        db=db,
    )
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado


@router.put("/{codigo}")
def update_articulo(codigo: str, data: ArticuloUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    """
    Edita un artículo existente. NO permite cambiar código ni nombre —
    son inmutables (ver ArticuloUpdate y sql/sp_comedor_articulos.sql).
    """
    resultado = summa_service.editar_articulo(
        codigo=codigo,
        descripcion=data.descripcion,
        categoria=data.categoria,
        sub_categoria=data.sub_categoria,
        precio=data.precio,
        db=db,
    )
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado


@router.delete("/{codigo}")
def delete_articulo(codigo: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Elimina un artículo. Bloqueado si tiene consumos registrados en el historial."""
    resultado = summa_service.eliminar_articulo(codigo, db)
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado
