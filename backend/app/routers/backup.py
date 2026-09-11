from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pathlib import Path

from app.services.backup_service import create_backup, list_backups, restore_backup, delete_backup, BACKUPS_DIR
from app.utils.security import require_admin

router = APIRouter()


@router.get("")
def get_backups(_=Depends(require_admin)):
    return list_backups()


@router.post("/crear")
def crear_backup(_=Depends(require_admin)):
    nombre = create_backup()
    return {"nombre": nombre, "mensaje": "Backup creado correctamente."}


@router.get("/descargar/{filename}")
def descargar_backup(filename: str, _=Depends(require_admin)):
    path = BACKUPS_DIR / filename
    if not path.exists() or not filename.endswith(".db"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    return FileResponse(path=str(path), filename=filename, media_type="application/octet-stream")


@router.post("/restaurar/{filename}")
def restaurar_backup(filename: str, _=Depends(require_admin)):
    restore_backup(filename)
    return {"mensaje": f"Base de datos restaurada desde '{filename}'. Reiniciá el servicio para aplicar los cambios."}


@router.delete("/{filename}", status_code=204)
def eliminar_backup(filename: str, _=Depends(require_admin)):
    delete_backup(filename)
