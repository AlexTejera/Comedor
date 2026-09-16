"""
gallery_service.py
Maneja el almacenamiento en disco de las imágenes subidas a la galería
(backend/data/uploads/ — bind-mount ya persistente, mismo que scheduler.db
en el proyecto hermano, no hace falta agregar un volumen nuevo en
docker-compose.yml).

No usa SUMMA ni pasa por Stored Procedures — es 100% local a esta app,
igual que Botoneras/Botones.
"""
import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.gallery_image import GalleryImage
from app.models.boton import Boton
from app.models.boton_opcion import BotonOpcion
from app.models.settings import SystemSetting

logger = logging.getLogger(__name__)

_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"}
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB — suficiente para íconos/logos, evita llenar el disco por error

_UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"


def _ensure_uploads_dir() -> Path:
    _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    return _UPLOADS_DIR


def _to_out(image: GalleryImage) -> dict:
    return {
        "id": image.id,
        "filename": image.filename,
        "original_name": image.original_name,
        "content_type": image.content_type,
        "size_bytes": image.size_bytes,
        "created_at": image.created_at,
        "url": f"/uploads/{image.filename}",
    }


async def save_upload(file: UploadFile, db: Session) -> dict:
    """
    Guarda un archivo subido en disco (nombre único, generado — nunca se usa
    el nombre original para evitar colisiones y path traversal) y crea el
    registro en la BD.

    Raises:
        ValueError: tipo de archivo no permitido, o supera el tamaño máximo.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Tipo de archivo no permitido ({content_type or 'desconocido'}). "
            "Formatos aceptados: PNG, JPG, WEBP, GIF, SVG."
        )

    data = await file.read()
    if len(data) > _MAX_SIZE_BYTES:
        raise ValueError(f"El archivo supera el tamaño máximo permitido ({_MAX_SIZE_BYTES // (1024*1024)} MB).")
    if len(data) == 0:
        raise ValueError("El archivo está vacío.")

    ext = Path(file.filename or "").suffix.lower()
    if not ext or len(ext) > 10:
        # Fallback por tipo MIME si el nombre original no trae extensión usable
        ext = {
            "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg",
            "image/webp": ".webp", "image/svg+xml": ".svg", "image/gif": ".gif",
        }.get(content_type, "")

    filename = f"{uuid.uuid4().hex}{ext}"
    uploads_dir = _ensure_uploads_dir()
    dest_path = uploads_dir / filename

    dest_path.write_bytes(data)

    image = GalleryImage(
        filename=filename,
        original_name=file.filename or filename,
        content_type=content_type,
        size_bytes=len(data),
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    logger.info("[Gallery] Imagen subida: %s (%s, %d bytes)", filename, file.filename, len(data))
    return _to_out(image)


def list_images(db: Session) -> list[dict]:
    images = db.query(GalleryImage).order_by(GalleryImage.created_at.desc()).all()
    return [_to_out(i) for i in images]


def _usage_count(filename: str, db: Session) -> dict:
    """Cuenta dónde se está usando esta imagen, para bloquear el borrado si aplica."""
    botones = db.query(Boton).filter(Boton.icono_url == filename).count()
    opciones = db.query(BotonOpcion).filter(BotonOpcion.icono_url == filename).count()
    logo = db.query(SystemSetting).filter(
        SystemSetting.key == "logo_url", SystemSetting.value == filename
    ).count()
    return {"botones": botones, "opciones": opciones, "logo": logo}


def delete_image(image_id: int, db: Session) -> None:
    """
    Elimina una imagen de la galería (archivo + registro).

    Raises:
        ValueError: no existe, o está en uso (logo, algún botón u opción).
    """
    image = db.query(GalleryImage).filter(GalleryImage.id == image_id).first()
    if not image:
        raise ValueError("La imagen no existe.")

    uso = _usage_count(image.filename, db)
    total_en_uso = uso["botones"] + uso["opciones"] + uso["logo"]
    if total_en_uso > 0:
        partes = []
        if uso["logo"]:
            partes.append("es el logo de la empresa")
        if uso["botones"]:
            partes.append(f"{uso['botones']} botón(es)")
        if uso["opciones"]:
            partes.append(f"{uso['opciones']} opción(es) de combo")
        raise ValueError(f"No se puede eliminar: está en uso por {', '.join(partes)}.")

    file_path = _UPLOADS_DIR / image.filename
    try:
        if file_path.exists():
            file_path.unlink()
    except OSError as e:
        logger.warning("[Gallery] No se pudo borrar el archivo %s del disco: %s", image.filename, e)

    db.delete(image)
    db.commit()
    logger.info("[Gallery] Imagen eliminada: %s", image.filename)
