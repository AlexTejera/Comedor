"""
init_db.py
Crea el usuario admin por defecto y los settings iniciales si no existen.
Se ejecuta automáticamente en el startup de la aplicación.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.user import User
from app.models.settings import SystemSetting
from app.models.boton_opcion import BotonOpcion  # registra la tabla con Base
from app.utils.security import hash_password


def _migrate_columns(db: Session) -> None:
    """
    Aplica ALTER TABLE para columnas nuevas en SQLite.
    SQLite no soporta IF NOT EXISTS en ALTER TABLE, así que capturamos el error
    'duplicate column name' y lo ignoramos — es el comportamiento esperado cuando
    la columna ya existe de una ejecución anterior.
    """
    migrations = [
        ("ALTER TABLE botones   ADD COLUMN fila         INTEGER",           "botones.fila"),
        ("ALTER TABLE botones   ADD COLUMN columna      INTEGER",           "botones.columna"),
        ("ALTER TABLE botones   ADD COLUMN col_span     INTEGER DEFAULT 1", "botones.col_span"),
        ("ALTER TABLE botones   ADD COLUMN row_span     INTEGER DEFAULT 1", "botones.row_span"),
        ("ALTER TABLE botoneras ADD COLUMN num_columnas INTEGER DEFAULT 3", "botoneras.num_columnas"),
        ("ALTER TABLE botoneras ADD COLUMN num_filas    INTEGER DEFAULT 3",      "botoneras.num_filas"),
        ("ALTER TABLE botones   ADD COLUMN tipo         VARCHAR(10) DEFAULT 'simple'", "botones.tipo"),
        ("ALTER TABLE boton_opciones ADD COLUMN max_unidades INTEGER DEFAULT 1",       "boton_opciones.max_unidades"),
    ]
    for sql, campo in migrations:
        try:
            db.execute(text(sql))
            db.commit()
        except Exception:
            db.rollback()   # la columna ya existe → ignorar


def init_db(db: Session) -> None:
    # ── Migraciones de esquema (columnas nuevas) ──────────────
    _migrate_columns(db)
    # ── Usuario admin por defecto ─────────────────────────────
    if not db.query(User).filter(User.username == "admin").first():
        admin = User(
            username="admin",
            email="admin@aluminios.com",
            hashed_password=hash_password("Admin1234!"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("✔ Usuario admin creado (admin / Admin1234!) — CAMBIAR INMEDIATAMENTE")

    # ── Settings por defecto ──────────────────────────────────
    defaults = [
        ("summa_server",   "",                              "Servidor MSSQL SUMMA (IP o hostname)"),
        ("summa_port",     "1433",                          "Puerto SQL Server"),
        ("summa_database", "Comedor",                       "Base de datos en SUMMA"),
        ("summa_user",     "",                              "Usuario SQL Server"),
        ("summa_password", "",                              "Contraseña SQL Server"),
        ("summa_driver",   "ODBC Driver 18 for SQL Server","Driver ODBC instalado en el servidor"),
        ("log_max_records","2000",                          "Máximo de registros en el historial"),
        ("mostrar_numpad",  "true",                          "Mostrar teclado numérico en la pantalla de login del kiosko"),
    ]
    for key, value, desc in defaults:
        if not db.query(SystemSetting).filter(SystemSetting.key == key).first():
            db.add(SystemSetting(key=key, value=value, descripcion=desc))
    db.commit()
