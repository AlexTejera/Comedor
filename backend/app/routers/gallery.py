"""
gallery.py
Galería de imágenes local (backend/data/uploads/) reutilizable como logo de
la empresa o como ícono de botones/opciones de combo. No pasa por SUMMA.

Endpoints (todos requieren admin):
- GET    /api/gallery      : Lista todas las imágenes subidas.
- POST   /api/gallery      : Sube una imagen nueva (multipart/form-data).
- DELETE /api/gallery/{id} : Elimina una imagen (bloqueada si está en uso).
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.gallery import GalleryImageOut
from app.services import gallery_service
from app.utils.security import require_admin

router = APIRouter()


@router.get("", response_model=list[GalleryImageOut])
def list_gallery(db: Session = Depends(get_db), _=Depends(require_admin)):
    return gallery_service.list_images(db)


@router.post("", response_model=GalleryImageOut, status_code=status.HTTP_201_CREATED)
async def upload_gallery_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    try:
        return await gallery_service.save_upload(file, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{image_id}")
def delete_gallery_image(image_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    try:
        gallery_service.delete_image(image_id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return {"ok": True}
