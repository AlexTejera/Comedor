"""
categorias.py
CRUD de categorías y subcategorías del comedor — viven en SUMMA
(dbo.categoria, dbo.sub_categoria), no en la BD local SQLite. Todas las
operaciones pasan por Stored Procedures (ver sql/sp_comedor_categorias.sql
y sql/sp_comedor_subcategorias.sql).

Endpoints (todos requieren admin):
- GET    /api/categorias                                : Árbol categoría → subcategorías.
- POST   /api/categorias                                : Crea una categoría.
- PUT    /api/categorias/{categoria}                     : Renombra una categoría (cascada).
- DELETE /api/categorias/{categoria}                     : Elimina una categoría (bloqueada si tiene artículos).
- POST   /api/categorias/{categoria}/subcategorias       : Crea una subcategoría.
- PUT    /api/categorias/{categoria}/subcategorias/{sub} : Renombra una subcategoría (cascada).
- DELETE /api/categorias/{categoria}/subcategorias/{sub} : Elimina una subcategoría (bloqueada si tiene artículos).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.categoria import (
    CategoriaCreate, CategoriaRename, CategoriaArbolOut,
    SubCategoriaCreate, SubCategoriaRename,
)
from app.services import summa_service
from app.services.summa_service import SummaConnectionError
from app.utils.security import require_admin

router = APIRouter()


@router.get("", response_model=list[CategoriaArbolOut])
def list_categorias_arbol(db: Session = Depends(get_db), _=Depends(require_admin)):
    """Árbol completo categoría → subcategorías, para la pantalla de tipo árbol."""
    try:
        return summa_service.listar_categorias_arbol(db)
    except SummaConnectionError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_categoria(data: CategoriaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    resultado = summa_service.crear_categoria(data.categoria, db)
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado


@router.put("/{categoria}")
def update_categoria(categoria: str, data: CategoriaRename, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Renombra una categoría. Actualiza en cascada sub_categoria y Articulos (ver .sql)."""
    resultado = summa_service.editar_categoria(categoria, data.categoria_nueva, db)
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado


@router.delete("/{categoria}")
def delete_categoria(categoria: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Elimina una categoría (y sus subcategorías). Bloqueada si tiene artículos asociados."""
    resultado = summa_service.eliminar_categoria(categoria, db)
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado


# ── Subcategorías (anidadas bajo una categoría) ───────────────────────────────

@router.post("/{categoria}/subcategorias", status_code=status.HTTP_201_CREATED)
def create_subcategoria(categoria: str, data: SubCategoriaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    resultado = summa_service.crear_subcategoria(categoria, data.sub_categoria, db)
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado


@router.put("/{categoria}/subcategorias/{sub_categoria}")
def update_subcategoria(
    categoria: str, sub_categoria: str, data: SubCategoriaRename,
    db: Session = Depends(get_db), _=Depends(require_admin),
):
    """Renombra una subcategoría. Actualiza en cascada Articulos (ver .sql)."""
    resultado = summa_service.editar_subcategoria(categoria, sub_categoria, data.sub_categoria_nueva, db)
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado


@router.delete("/{categoria}/subcategorias/{sub_categoria}")
def delete_subcategoria(categoria: str, sub_categoria: str, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Elimina una subcategoría. Bloqueada si tiene artículos asociados."""
    resultado = summa_service.eliminar_subcategoria(categoria, sub_categoria, db)
    if resultado.get("Estado") != "OK":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=resultado.get("Mensaje"))
    return resultado
