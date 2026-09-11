from typing import Optional

from sqlalchemy import Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Boton(Base):
    """Botón individual dentro de una botonera (asociado a un producto SUMMA)."""

    __tablename__ = "botones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    botonera_id: Mapped[int] = mapped_column(Integer, ForeignKey("botoneras.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    producto_codigo: Mapped[str] = mapped_column(String(50), nullable=False)
    max_unidades: Mapped[int] = mapped_column(Integer, default=1)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(20), default="#1677ff")  # Ant Design primary
    # Posición explícita en la cuadrícula (1-based). NULL = auto-placement CSS.
    fila: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    columna: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Tamaño del botón en la cuadrícula (cuántas celdas ocupa).
    col_span: Mapped[int] = mapped_column(Integer, default=1)  # ancho en columnas
    row_span: Mapped[int] = mapped_column(Integer, default=1)  # alto en filas
    # Tipo: "simple" (un solo producto) | "combo" (elige una opción de una lista)
    tipo: Mapped[str] = mapped_column(String(10), default="simple")

    botonera: Mapped["Botonera"] = relationship("Botonera", back_populates="botones")
    opciones: Mapped[list["BotonOpcion"]] = relationship(
        "BotonOpcion",
        back_populates="boton",
        order_by="BotonOpcion.orden",
        cascade="all, delete-orphan",
    )
