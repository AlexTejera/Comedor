"""
backup_service.py
Copia de seguridad y restauración de la base de datos SQLite.
"""

import shutil
import os
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException

# Rutas base (relativas al WORKDIR /app/backend dentro del contenedor)
DB_PATH      = Path("data/comedor.db")
BACKUPS_DIR  = Path("backups")


def _ensure_backups_dir() -> None:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)


def create_backup() -> str:
    """Crea una copia de la BD y retorna el nombre del archivo."""
    _ensure_backups_dir()
    if not DB_PATH.exists():
        raise HTTPException(status_code=404, detail="Base de datos no encontrada.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"comedor_backup_{timestamp}.db"
    backup_path = BACKUPS_DIR / backup_name

    shutil.copy2(DB_PATH, backup_path)
    return backup_name


def list_backups() -> list[dict]:
    """Lista los backups disponibles ordenados por fecha (más reciente primero)."""
    _ensure_backups_dir()
    backups = []
    for f in sorted(BACKUPS_DIR.glob("*.db"), key=os.path.getmtime, reverse=True):
        backups.append({
            "nombre": f.name,
            "tamaño_kb": round(f.stat().st_size / 1024, 1),
            "fecha": datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        })
    return backups


def restore_backup(filename: str) -> None:
    """Restaura un backup sobre la BD actual."""
    backup_path = BACKUPS_DIR / filename
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Archivo de backup no encontrado.")
    if not filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Archivo inválido.")

    shutil.copy2(backup_path, DB_PATH)


def delete_backup(filename: str) -> None:
    """Elimina un archivo de backup."""
    backup_path = BACKUPS_DIR / filename
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Archivo de backup no encontrado.")
    if not filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Archivo inválido.")
    backup_path.unlink()
