from sqlalchemy import Integer, String, Boolean, DateTime, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Botonera(Base):
    """Panel de botones activo durante un rango horario."""

    __tablename__ = "botoneras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    hora_inicio: Mapped[str] = mapped_column(String(5), nullable=False)  # "HH:MM"
    hora_fin: Mapped[str] = mapped_column(String(5), nullable=False)      # "HH:MM"
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    num_columnas: Mapped[int] = mapped_column(Integer, default=3)  # columnas del CSS grid
    num_filas:    Mapped[int] = mapped_column(Integer, default=3)  # filas del CSS grid
    created_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    botones: Mapped[list["Boton"]] = relationship(
        "Boton", back_populates="botonera", order_by="Boton.orden", cascade="all, delete-orphan"
    )
