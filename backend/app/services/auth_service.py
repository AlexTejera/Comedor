from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.security import verify_password, create_access_token


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def login(db: Session, username: str, password: str) -> dict | None:
    user = authenticate_user(db, username, password)
    if not user:
        return None
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer"}
