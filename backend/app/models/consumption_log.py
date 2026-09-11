from sqlalchemy import Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ConsumptionLog(Base):
    """
    Historial de eventos del kiosko (validaciones y pedidos).
    Se mantienen solo los últimos MAX_LOG_RECORDS registros.
    """

    __tablename__ = "consumption_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Empleado
    empleado_cod: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    nombre_empleado: Mapped[str] = mapped_column(String(200), default="")

    # Tipo de evento: "validacion" | "pedido"
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Items seleccionados (solo para pedidos), formato JSON: [{"articulo":"X","cantidad":1}]
    items_json: Mapped[str] = mapped_column(Text, default="[]")

    # Resultado
    resultado: Mapped[str] = mapped_column(String(10), nullable=False, index=True)  # "OK" | "ERROR"
    mensaje: Mapped[str] = mapped_column(Text, default="")

    fecha_hora: Mapped[DateTime] = mapped_column(DateTime, default=func.now(), index=True)
