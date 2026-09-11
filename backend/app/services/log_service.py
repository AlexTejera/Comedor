"""
log_service.py
Gestiona el historial de eventos del kiosko.
Mantiene automáticamente los últimos MAX_RECORDS registros.
"""

import json
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.consumption_log import ConsumptionLog
from app.models.settings import SystemSetting

logger = logging.getLogger(__name__)

DEFAULT_MAX_RECORDS = 2000


def _get_max_records(db: Session) -> int:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "log_max_records").first()
    try:
        return int(setting.value) if setting and setting.value else DEFAULT_MAX_RECORDS
    except ValueError:
        return DEFAULT_MAX_RECORDS


def _cleanup(db: Session, max_records: int) -> None:
    """Elimina los registros más antiguos si se supera el límite."""
    count = db.query(ConsumptionLog).count()
    if count >= max_records:
        excess = count - max_records + 1  # +1 para dejar espacio al nuevo
        ids_to_delete = (
            db.query(ConsumptionLog.id)
            .order_by(ConsumptionLog.fecha_hora.asc())
            .limit(excess)
            .subquery()
        )
        db.query(ConsumptionLog).filter(ConsumptionLog.id.in_(ids_to_delete)).delete(
            synchronize_session=False
        )


def registrar_validacion(
    db: Session,
    empleado_cod: int,
    nombre_empleado: str,
    resultado: str,
    mensaje: str,
) -> None:
    """Registra un intento de validación de empleado."""
    try:
        max_records = _get_max_records(db)
        _cleanup(db, max_records)
        entry = ConsumptionLog(
            empleado_cod=empleado_cod,
            nombre_empleado=nombre_empleado,
            tipo="validacion",
            items_json="[]",
            resultado=resultado,
            mensaje=mensaje,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.error("Error al registrar validación en log: %s", e)
        db.rollback()


def registrar_pedido(
    db: Session,
    empleado_cod: int,
    nombre_empleado: str,
    items: list,
    resultado: str,
    mensaje: str,
) -> None:
    """Registra un pedido (confirmación de consumo)."""
    try:
        max_records = _get_max_records(db)
        _cleanup(db, max_records)
        entry = ConsumptionLog(
            empleado_cod=empleado_cod,
            nombre_empleado=nombre_empleado,
            tipo="pedido",
            items_json=json.dumps(items, ensure_ascii=False),
            resultado=resultado,
            mensaje=mensaje,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.error("Error al registrar pedido en log: %s", e)
        db.rollback()


def get_logs(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    tipo: str | None = None,
    resultado: str | None = None,
) -> tuple[int, list[ConsumptionLog]]:
    query = db.query(ConsumptionLog)
    if tipo:
        query = query.filter(ConsumptionLog.tipo == tipo)
    if resultado:
        query = query.filter(ConsumptionLog.resultado == resultado)
    total = query.count()
    registros = query.order_by(ConsumptionLog.fecha_hora.desc()).offset(skip).limit(limit).all()
    return total, registros
