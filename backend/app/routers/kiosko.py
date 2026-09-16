"""
kiosko.py
Endpoints públicos del kiosko (sin autenticación admin).
El único "control de acceso" es la validación del número de empleado contra SUMMA.
"""

from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.botonera import Botonera
from app.models.boton import Boton
from app.models.settings import SystemSetting
from app.schemas.botonera import BotoneraConBotones
from app.services import summa_service, log_service

router = APIRouter()

TZ = pytz.timezone("America/Montevideo")


# ── Schemas internos ─────────────────────────────────────────────────────────

class ValidarEmpleadoRequest(BaseModel):
    numero_empleado: int


class ItemPedido(BaseModel):
    articulo: str
    nombre: str
    cantidad: int


class ConfirmarPedidoRequest(BaseModel):
    numero_empleado: int
    nombre_empleado: str
    items: list[ItemPedido]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_botonera_activa(db: Session) -> Optional[Botonera]:
    """Devuelve la botonera cuyo rango horario incluye la hora actual (Montevideo)."""
    ahora = datetime.now(TZ).strftime("%H:%M")
    botoneras = (
        db.query(Botonera)
        .filter(Botonera.activa == True)
        .order_by(Botonera.orden)
        .all()
    )
    for b in botoneras:
        if b.hora_inicio <= ahora <= b.hora_fin:
            return b
    return None


def _serializar_opcion(op) -> dict:
    return {
        "id":              op.id,
        "nombre":          op.nombre,
        "producto_codigo": op.producto_codigo,
        "orden":           op.orden,
        "max_unidades":    op.max_unidades if op.max_unidades is not None else 1,
        "icono_url":       f"/uploads/{op.icono_url}" if op.icono_url else None,
    }


def _serializar_botonera(botonera: Botonera) -> dict:
    botones_visibles = [b for b in botonera.botones if b.visible]
    return {
        "id":           botonera.id,
        "nombre":       botonera.nombre,
        "hora_inicio":  botonera.hora_inicio,
        "hora_fin":     botonera.hora_fin,
        "num_columnas": botonera.num_columnas or 3,
        "num_filas":    botonera.num_filas    or 3,
        "botones": [
            {
                "id":              b.id,
                "nombre":          b.nombre,
                "producto_codigo": b.producto_codigo,
                "max_unidades":    b.max_unidades,
                "color":           b.color,
                "orden":           b.orden,
                "fila":            b.fila,
                "columna":         b.columna,
                "col_span":        b.col_span or 1,
                "row_span":        b.row_span or 1,
                "tipo":            b.tipo or "simple",
                "icono_url":       f"/uploads/{b.icono_url}" if b.icono_url else None,
                "opciones": [
                    _serializar_opcion(op)
                    for op in sorted(b.opciones, key=lambda o: o.orden)
                ],
            }
            for b in sorted(botones_visibles, key=lambda x: x.orden)
        ],
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/config")
def kiosko_config(db: Session = Depends(get_db)):
    """Configuración pública del kiosko (sin datos sensibles, sin autenticación)."""
    PUBLIC_KEYS = {"mostrar_numpad", "logo_url"}
    settings = db.query(SystemSetting).filter(SystemSetting.key.in_(PUBLIC_KEYS)).all()
    result = {s.key: s.value for s in settings}
    # logo_url en la BD es solo el nombre de archivo — acá se arma la ruta pública completa
    if result.get("logo_url"):
        result["logo_url"] = f"/uploads/{result['logo_url']}"
    return result


@router.post("/validar-empleado")
def validar_empleado(data: ValidarEmpleadoRequest, db: Session = Depends(get_db)):
    """
    Valida el número de empleado contra SUMMA.
    Si es válido, también retorna la botonera activa para el horario actual.
    """
    resultado = summa_service.validar_empleado(data.numero_empleado, db)

    nombre = resultado.get("NombreEmpleado", "")

    log_service.registrar_validacion(
        db=db,
        empleado_cod=data.numero_empleado,
        nombre_empleado=nombre,
        resultado=resultado.get("Estado", "ERROR"),
        mensaje=resultado.get("Mensaje", ""),
    )

    if resultado.get("Estado") != "OK":
        return resultado

    botonera = _get_botonera_activa(db)
    botonera_data = _serializar_botonera(botonera) if botonera else None

    return {**resultado, "botonera": botonera_data}


@router.post("/confirmar-pedido")
def confirmar_pedido(data: ConfirmarPedidoRequest, db: Session = Depends(get_db)):
    """Envía el pedido a SUMMA para su registro."""
    items_summa = [{"articulo": item.articulo, "cantidad": item.cantidad} for item in data.items]

    resultado = summa_service.registrar_consumo(data.numero_empleado, items_summa, db)

    items_log = [
        {"articulo": item.articulo, "nombre": item.nombre, "cantidad": item.cantidad}
        for item in data.items
    ]
    log_service.registrar_pedido(
        db=db,
        empleado_cod=data.numero_empleado,
        nombre_empleado=data.nombre_empleado,
        items=items_log,
        resultado=resultado.get("Estado", "ERROR"),
        mensaje=resultado.get("Mensaje", ""),
    )

    return resultado


@router.get("/total-consumo/{numero_empleado}")
def total_consumo(numero_empleado: int, db: Session = Depends(get_db)):
    """Retorna el costo total de los artículos pendientes de contabilizar para el empleado."""
    return summa_service.obtener_total_consumo(numero_empleado, db)


@router.get("/botonera-activa")
def botonera_activa(db: Session = Depends(get_db)):
    """Retorna la botonera activa para el horario actual (o null si no hay ninguna)."""
    botonera = _get_botonera_activa(db)
    return {"botonera": _serializar_botonera(botonera) if botonera else None}
