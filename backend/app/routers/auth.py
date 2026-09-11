from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import LoginRequest, Token
from app.services.auth_service import login

router = APIRouter()


@router.post("/login", response_model=Token)
def admin_login(data: LoginRequest, db: Session = Depends(get_db)):
    result = login(db, data.username, data.password)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )
    return result
