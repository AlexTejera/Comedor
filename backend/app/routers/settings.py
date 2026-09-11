from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import SystemSetting
from app.schemas.settings import SettingOut, SettingsBulkUpdate, TestConnectionResult
from app.services.summa_service import test_connection
from app.utils.security import require_admin

router = APIRouter()

# Claves cuyo valor NO se devuelve en claro (se oculta en la respuesta)
SENSITIVE_KEYS = {"summa_password"}


@router.get("", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db), _=Depends(require_admin)):
    settings = db.query(SystemSetting).order_by(SystemSetting.key).all()
    result = []
    for s in settings:
        value = "********" if s.key in SENSITIVE_KEYS and s.value else s.value
        result.append(SettingOut(key=s.key, value=value, descripcion=s.descripcion))
    return result


@router.put("")
def update_settings(data: SettingsBulkUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Actualiza múltiples settings en una sola llamada."""
    for key, value in data.settings.items():
        # Si el valor enviado es "********" (placeholder), no actualizar ese campo
        if value == "********":
            continue
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting:
            setting.value = value
        else:
            db.add(SystemSetting(key=key, value=value))
    db.commit()
    return {"ok": True, "mensaje": "Configuración guardada correctamente."}


@router.post("/test-connection", response_model=TestConnectionResult)
def test_summa_connection(db: Session = Depends(get_db), _=Depends(require_admin)):
    """Prueba la conexión al servidor SUMMA con los parámetros actuales."""
    result = test_connection(db)
    return TestConnectionResult(**result)
