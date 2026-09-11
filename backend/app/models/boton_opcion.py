from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BotonOpcion(Base):
    """Opción individual de un botón tipo 'combo'."""

    __tablename__ = "boton_opciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    boton_id: Mapped[int] = mapped_column(Integer, ForeignKey("botones.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    producto_codigo: Mapped[str] = mapped_column(String(50), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    max_unidades: Mapped[int] = mapped_column(Integer, default=1)

    boton: Mapped["Boton"] = relationship("Boton", back_populates="opciones")
