from datetime import datetime
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class GalleryImage(Base):
    """
    Imagen subida por un admin a la galería local (backend/data/uploads/),
    reutilizable como logo de la empresa (kiosko) o como ícono de un botón /
    opción de combo. No vive en SUMMA — es puramente de esta app.
    """
    __tablename__ = "gallery_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)      # nombre real en disco
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)              # nombre que subió el admin
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
