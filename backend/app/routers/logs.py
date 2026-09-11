from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.schemas.consumption_log import LogsResponse, ConsumptionLogOut
from app.services.log_service import get_logs
from app.utils.security import require_admin

router = APIRouter()


@router.get("", response_model=LogsResponse)
def list_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    tipo: Optional[str] = Query(None, description="validacion | pedido"),
    resultado: Optional[str] = Query(None, description="OK | ERROR"),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    total, registros = get_logs(db, skip=skip, limit=limit, tipo=tipo, resultado=resultado)
    return LogsResponse(total=total, registros=registros)
