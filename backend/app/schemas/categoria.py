from pydantic import BaseModel


class CategoriaCreate(BaseModel):
    categoria: str


class CategoriaRename(BaseModel):
    categoria_nueva: str


class SubCategoriaCreate(BaseModel):
    sub_categoria: str


class SubCategoriaRename(BaseModel):
    sub_categoria_nueva: str


class CategoriaArbolOut(BaseModel):
    """Un nodo del árbol categoría → subcategorías, tal como lo espera el frontend."""
    categoria: str
    subCategorias: list[str] = []
