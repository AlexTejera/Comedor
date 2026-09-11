from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.botonera import Botonera
from app.models.boton import Boton
from app.models.boton_opcion import BotonOpcion
from app.schemas.botonera import BotoneraCreate, BotoneraUpdate, BotoneraOut, BotoneraConBotones
from app.schemas.boton import BotonCreate, BotonUpdate, BotonOut
from app.schemas.boton_opcion import BotonOpcionCreate, BotonOpcionUpdate, BotonOpcionOut
from app.utils.security import require_admin

router = APIRouter()


# ── Helpers de validación ─────────────────────────────────────────────────────

def _validar_posicion_boton(
    botonera: Botonera,
    fila: int | None,
    columna: int | None,
    col_span: int,
    row_span: int,
    db: Session,
    excluir_boton_id: int | None = None,
) -> None:
    """
    Valida dos cosas antes de crear/actualizar un botón:
      1. Que fila + row_span y columna + col_span no superen los límites de la botonera.
      2. Que ninguna de las celdas que ocuparía ya esté tomada por otro botón.
    Lanza HTTPException 422 con un mensaje descriptivo si hay conflicto.
    Sólo aplica cuando fila y columna tienen valor (posición explícita).
    """
    if fila is None or columna is None:
        return  # posición automática → sin restricción de cuadrícula

    cs = col_span or 1
    rs = row_span or 1
    col_fin = columna + cs - 1
    fil_fin = fila    + rs - 1

    # ── 1. Límites de la cuadrícula ──────────────────────────────────────────
    msgs: list[str] = []
    if col_fin > botonera.num_columnas:
        msgs.append(
            f"la columna final ({col_fin}) supera el ancho de la cuadrícula ({botonera.num_columnas} col)"
        )
    if fil_fin > botonera.num_filas:
        msgs.append(
            f"la fila final ({fil_fin}) supera el alto de la cuadrícula ({botonera.num_filas} fil)"
        )
    if msgs:
        raise HTTPException(status_code=422, detail="Posición inválida: " + "; ".join(msgs) + ".")

    # ── 2. Colisión con otros botones de la misma botonera ───────────────────
    q = (
        db.query(Boton)
        .filter(
            Boton.botonera_id == botonera.id,
            Boton.fila.isnot(None),
            Boton.columna.isnot(None),
        )
    )
    if excluir_boton_id:
        q = q.filter(Boton.id != excluir_boton_id)

    # Celdas que ocuparía el botón nuevo/editado
    celdas_nuevas = {
        (fila + dr, columna + dc)
        for dr in range(rs)
        for dc in range(cs)
    }

    colisiones: list[str] = []
    for b in q.all():
        celdas_b = {
            (b.fila + dr, b.columna + dc)
            for dr in range(b.row_span or 1)
            for dc in range(b.col_span or 1)
        }
        overlap = celdas_nuevas & celdas_b
        if overlap:
            coords = ", ".join(f"F{f}C{c}" for f, c in sorted(overlap))
            colisiones.append(f'"{b.nombre}" ({coords})')

    if colisiones:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Colisión de posiciones: "
                f"{'esa celda ya está ocupada' if len(colisiones) == 1 else 'esas celdas ya están ocupadas'} "
                f"por: {'; '.join(colisiones)}."
            ),
        )


# ── Botoneras ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[BotoneraConBotones])
def list_botoneras(db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(Botonera).order_by(Botonera.orden, Botonera.id).all()


@router.post("", response_model=BotoneraOut, status_code=status.HTTP_201_CREATED)
def create_botonera(data: BotoneraCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    botonera = Botonera(**data.model_dump())
    db.add(botonera)
    db.commit()
    db.refresh(botonera)
    return botonera


@router.put("/{botonera_id}", response_model=BotoneraOut)
def update_botonera(botonera_id: int, data: BotoneraUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    botonera = db.query(Botonera).filter(Botonera.id == botonera_id).first()
    if not botonera:
        raise HTTPException(status_code=404, detail="Botonera no encontrada.")

    cambios = data.model_dump(exclude_none=True)

    # ── Validar que el nuevo tamaño no deje botones fuera de la cuadrícula ───
    # Solo aplica cuando se modifica num_columnas o num_filas.
    if "num_columnas" in cambios or "num_filas" in cambios:
        nuevo_cols = cambios.get("num_columnas", botonera.num_columnas)
        nuevo_fils = cambios.get("num_filas",    botonera.num_filas)

        # Sólo los botones con posición fija pueden quedar fuera de rango.
        botones_fijos = (
            db.query(Boton)
            .filter(Boton.botonera_id == botonera_id, Boton.fila != None, Boton.columna != None)
            .all()
        )

        invalidos = []
        for b in botones_fijos:
            col_fin = b.columna + (b.col_span or 1) - 1
            fil_fin = b.fila    + (b.row_span or 1) - 1
            if col_fin > nuevo_cols or fil_fin > nuevo_fils:
                problemas = []
                if col_fin > nuevo_cols:
                    rango = f"columnas {b.columna}–{col_fin}" if col_fin > b.columna else f"columna {b.columna}"
                    problemas.append(f"{rango} (máx nuevo: {nuevo_cols})")
                if fil_fin > nuevo_fils:
                    rango = f"filas {b.fila}–{fil_fin}" if fil_fin > b.fila else f"fila {b.fila}"
                    problemas.append(f"{rango} (máx nuevo: {nuevo_fils})")
                invalidos.append(f'"{b.nombre}": {" / ".join(problemas)}')

        if invalidos:
            lista = "; ".join(invalidos)
            raise HTTPException(
                status_code=422,
                detail=(
                    f"No se puede reducir la cuadrícula a {nuevo_cols}×{nuevo_fils}: "
                    f"los siguientes botones quedarían fuera de rango → {lista}. "
                    f"Reubicá o eliminá esos botones primero."
                ),
            )

    for field, value in cambios.items():
        setattr(botonera, field, value)
    db.commit()
    db.refresh(botonera)
    return botonera


@router.delete("/{botonera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_botonera(botonera_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    botonera = db.query(Botonera).filter(Botonera.id == botonera_id).first()
    if not botonera:
        raise HTTPException(status_code=404, detail="Botonera no encontrada.")
    db.delete(botonera)
    db.commit()


# ── Botones ──────────────────────────────────────────────────────────────────

@router.get("/{botonera_id}/botones", response_model=list[BotonOut])
def list_botones(botonera_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    return (
        db.query(Boton)
        .options(selectinload(Boton.opciones))
        .filter(Boton.botonera_id == botonera_id)
        .order_by(Boton.orden)
        .all()
    )


@router.post("/{botonera_id}/botones", response_model=BotonOut, status_code=status.HTTP_201_CREATED)
def create_boton(botonera_id: int, data: BotonCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    botonera = db.query(Botonera).filter(Botonera.id == botonera_id).first()
    if not botonera:
        raise HTTPException(status_code=404, detail="Botonera no encontrada.")
    _validar_posicion_boton(
        botonera=botonera,
        fila=data.fila,
        columna=data.columna,
        col_span=data.col_span or 1,
        row_span=data.row_span or 1,
        db=db,
    )
    boton = Boton(**{**data.model_dump(), "botonera_id": botonera_id})
    db.add(boton)
    db.commit()
    db.refresh(boton)
    return boton


@router.put("/{botonera_id}/botones/{boton_id}", response_model=BotonOut)
def update_boton(botonera_id: int, boton_id: int, data: BotonUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    boton = db.query(Boton).filter(Boton.id == boton_id, Boton.botonera_id == botonera_id).first()
    if not boton:
        raise HTTPException(status_code=404, detail="Botón no encontrado.")
    botonera = db.query(Botonera).filter(Botonera.id == botonera_id).first()

    cambios = data.model_dump(exclude_none=True)

    # Calcular los valores resultantes (mezcla de cambios + estado actual)
    nueva_fila     = cambios.get("fila",     boton.fila)
    nueva_columna  = cambios.get("columna",  boton.columna)
    nuevo_col_span = cambios.get("col_span", boton.col_span or 1)
    nuevo_row_span = cambios.get("row_span", boton.row_span or 1)

    _validar_posicion_boton(
        botonera=botonera,
        fila=nueva_fila,
        columna=nueva_columna,
        col_span=nuevo_col_span,
        row_span=nuevo_row_span,
        db=db,
        excluir_boton_id=boton_id,   # no colisionar consigo mismo
    )

    for field, value in cambios.items():
        setattr(boton, field, value)
    db.commit()
    db.refresh(boton)
    return boton


@router.delete("/{botonera_id}/botones/{boton_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_boton(botonera_id: int, boton_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    boton = db.query(Boton).filter(Boton.id == boton_id, Boton.botonera_id == botonera_id).first()
    if not boton:
        raise HTTPException(status_code=404, detail="Botón no encontrado.")
    db.delete(boton)
    db.commit()


# ── Opciones de botón combo ───────────────────────────────────────────────────

def _get_boton_combo(botonera_id: int, boton_id: int, db: Session) -> Boton:
    boton = db.query(Boton).filter(Boton.id == boton_id, Boton.botonera_id == botonera_id).first()
    if not boton:
        raise HTTPException(status_code=404, detail="Botón no encontrado.")
    if boton.tipo != "combo":
        raise HTTPException(status_code=400, detail="El botón no es de tipo combo.")
    return boton


@router.get("/{botonera_id}/botones/{boton_id}/opciones", response_model=list[BotonOpcionOut])
def list_opciones(botonera_id: int, boton_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    _get_boton_combo(botonera_id, boton_id, db)
    return db.query(BotonOpcion).filter(BotonOpcion.boton_id == boton_id).order_by(BotonOpcion.orden).all()


@router.post("/{botonera_id}/botones/{boton_id}/opciones", response_model=BotonOpcionOut, status_code=status.HTTP_201_CREATED)
def create_opcion(botonera_id: int, boton_id: int, data: BotonOpcionCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    _get_boton_combo(botonera_id, boton_id, db)
    opcion = BotonOpcion(**data.model_dump(), boton_id=boton_id)
    db.add(opcion)
    db.commit()
    db.refresh(opcion)
    return opcion


@router.put("/{botonera_id}/botones/{boton_id}/opciones/{opcion_id}", response_model=BotonOpcionOut)
def update_opcion(botonera_id: int, boton_id: int, opcion_id: int, data: BotonOpcionUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    _get_boton_combo(botonera_id, boton_id, db)
    opcion = db.query(BotonOpcion).filter(BotonOpcion.id == opcion_id, BotonOpcion.boton_id == boton_id).first()
    if not opcion:
        raise HTTPException(status_code=404, detail="Opción no encontrada.")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(opcion, field, value)
    db.commit()
    db.refresh(opcion)
    return opcion


@router.delete("/{botonera_id}/botones/{boton_id}/opciones/{opcion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opcion(botonera_id: int, boton_id: int, opcion_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    _get_boton_combo(botonera_id, boton_id, db)
    opcion = db.query(BotonOpcion).filter(BotonOpcion.id == opcion_id, BotonOpcion.boton_id == boton_id).first()
    if not opcion:
        raise HTTPException(status_code=404, detail="Opción no encontrada.")
    db.delete(opcion)
    db.commit()
