"""
summa_service.py
Maneja la conexión al servidor MSSQL SUMMA y las llamadas a las
stored procedures del sistema Comedor.

Los parámetros de conexión se leen de SystemSetting en SQLite.
"""

import json
import logging
from typing import Optional

import pyodbc
from sqlalchemy.orm import Session

from app.models.settings import SystemSetting

logger = logging.getLogger(__name__)


# ── Helpers de configuración ─────────────────────────────────────────────────

def _get_settings(db: Session) -> dict:
    """Lee todos los settings de SUMMA desde SQLite."""
    rows = db.query(SystemSetting).filter(
        SystemSetting.key.in_([
            "summa_server", "summa_port", "summa_database",
            "summa_user", "summa_password", "summa_driver",
        ])
    ).all()
    return {r.key: r.value for r in rows}


def _build_conn_string(cfg: dict) -> str:
    server = cfg.get("summa_server", "").strip()
    if not server:
        raise ValueError(
            "El servidor SUMMA no está configurado. "
            "Completá los datos de conexión en el panel de administración."
        )
    port   = cfg.get("summa_port",   "1433").strip() or "1433"
    db     = cfg.get("summa_database","Comedor").strip() or "Comedor"
    user   = cfg.get("summa_user",   "").strip()
    pwd    = cfg.get("summa_password","").strip()
    driver = cfg.get("summa_driver", "ODBC Driver 18 for SQL Server").strip()

    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={server},{port};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={pwd};"
        "TrustServerCertificate=yes;"
        "Encrypt=yes;"
    )


def _connect(db: Session) -> pyodbc.Connection:
    cfg = _get_settings(db)
    conn_str = _build_conn_string(cfg)
    return pyodbc.connect(conn_str, timeout=10)


class SummaConnectionError(Exception):
    """
    Error al comunicarse con SUMMA (config incompleta, ODBC, o respuesta con
    formato inesperado). Usado por los *_listar() de artículos/categorías/
    subcategorías — a diferencia de crear/editar/eliminar, un listado no
    tiene un {"Estado":"ERROR",...} propio al que degradar, así que el
    router necesita distinguir "til vacía" de "no se pudo conectar" para
    devolver un 503 en vez de mostrar una lista vacía engañosa.
    """
    pass


# ── Helpers genéricos para los CRUD de artículos/categorías/subcategorías ─────
# (validar_empleado/registrar_consumo/obtener_total_consumo de abajo tienen su
# propio shape de respuesta y no usan estos helpers — quedan como estaban.)

def _exec_status_sp(sp_name: str, db: Session, **params) -> dict:
    """
    Ejecuta un SP que sigue la convención {"Estado":"OK"|"ERROR","Mensaje":...}
    en una sola fila/columna — usado por los *_crear/*_editar/*_eliminar.
    """
    try:
        conn = _connect(db)
        cursor = conn.cursor()
        placeholders = ", ".join(f"@{k}=?" for k in params)
        cursor.execute(f"EXEC dbo.{sp_name} {placeholders}", tuple(params.values()))
        row = cursor.fetchone()
        conn.commit()
        conn.close()

        if row is None:
            return {"Estado": "ERROR", "Mensaje": "La consulta al servidor no retornó datos."}
        return json.loads(row[0])

    except ValueError as e:
        logger.warning("Configuración SUMMA incompleta: %s", e)
        return {"Estado": "ERROR", "Mensaje": str(e)}
    except pyodbc.Error as e:
        logger.error("Error ODBC en %s: %s", sp_name, e)
        return {"Estado": "ERROR", "Mensaje": f"Error de comunicación con SUMMA: {str(e)[:200]}"}
    except (json.JSONDecodeError, TypeError) as e:
        logger.error("Respuesta inválida de SUMMA en %s: %s", sp_name, e)
        return {"Estado": "ERROR", "Mensaje": "La respuesta del servidor no tiene el formato esperado."}


def _exec_list_sp(sp_name: str, db: Session, **params) -> list:
    """
    Ejecuta un SP que retorna un array JSON en una sola fila/columna — usado
    por los *_listar(). A diferencia de _exec_status_sp, acá un error SÍ se
    propaga (SummaConnectionError) en vez de degradar a un valor por
    defecto: una lista de artículos vacía por error de conexión no debe
    verse igual que "no hay artículos cargados".
    """
    try:
        conn = _connect(db)
        cursor = conn.cursor()
        if params:
            placeholders = ", ".join(f"@{k}=?" for k in params)
            cursor.execute(f"EXEC dbo.{sp_name} {placeholders}", tuple(params.values()))
        else:
            cursor.execute(f"EXEC dbo.{sp_name}")
        row = cursor.fetchone()
        conn.close()

        if row is None or row[0] is None:
            return []
        return json.loads(row[0])

    except ValueError as e:
        logger.warning("Configuración SUMMA incompleta: %s", e)
        raise SummaConnectionError(str(e)) from e
    except pyodbc.Error as e:
        logger.error("Error ODBC en %s: %s", sp_name, e)
        raise SummaConnectionError(f"Error de comunicación con SUMMA: {str(e)[:200]}") from e
    except (json.JSONDecodeError, TypeError) as e:
        logger.error("Respuesta inválida de SUMMA en %s: %s", sp_name, e)
        raise SummaConnectionError("La respuesta del servidor no tiene el formato esperado.") from e


# ── API pública ──────────────────────────────────────────────────────────────

def validar_empleado(numero_empleado: int, db: Session) -> dict:
    """
    Llama a dbo.sp_comedor_validar_empleado en SUMMA.
    Retorna dict con al menos: {"Estado": "OK"|"ERROR", "Mensaje": str, "NombreEmpleado": str}
    En caso de error de comunicación también retorna la misma estructura.
    """
    try:
        conn   = _connect(db)
        cursor = conn.cursor()
        cursor.execute(
            "EXEC dbo.sp_comedor_validar_empleado @numero_empleado=?",
            (numero_empleado,)
        )
        row = cursor.fetchone()
        conn.close()

        if row is None:
            return {"Estado": "ERROR", "Mensaje": "La consulta al servidor no retornó datos.", "NombreEmpleado": ""}

        return json.loads(row[0])

    except ValueError as e:
        # Configuración incompleta
        logger.warning("Configuración SUMMA incompleta: %s", e)
        return {"Estado": "ERROR", "Mensaje": str(e), "NombreEmpleado": ""}

    except pyodbc.Error as e:
        logger.error("Error ODBC al validar empleado %d: %s", numero_empleado, e)
        return {
            "Estado": "ERROR",
            "Mensaje": f"Error de comunicación con SUMMA: {str(e)[:200]}",
            "NombreEmpleado": "",
        }

    except (json.JSONDecodeError, TypeError) as e:
        logger.error("Respuesta inválida de SUMMA al validar empleado %d: %s", numero_empleado, e)
        return {"Estado": "ERROR", "Mensaje": "La respuesta del servidor no tiene el formato esperado.", "NombreEmpleado": ""}


def registrar_consumo(numero_empleado: int, items: list, db: Session) -> dict:
    """
    Llama a dbo.sp_comedor_registrar_consumo en SUMMA.
    items: [{"articulo": "CODIGO", "cantidad": 2}, ...]
    Retorna dict con al menos: {"Estado": "OK"|"ERROR", "Mensaje": str}
    """
    try:
        conn       = _connect(db)
        cursor     = conn.cursor()
        items_json = json.dumps(items, ensure_ascii=False)

        cursor.execute(
            "EXEC dbo.sp_comedor_registrar_consumo @numero_empleado=?, @items=?",
            (numero_empleado, items_json)
        )
        row = cursor.fetchone()
        conn.commit()
        conn.close()

        if row is None:
            return {"Estado": "ERROR", "Mensaje": "La consulta al servidor no retornó datos."}

        return json.loads(row[0])

    except ValueError as e:
        logger.warning("Configuración SUMMA incompleta: %s", e)
        return {"Estado": "ERROR", "Mensaje": str(e)}

    except pyodbc.Error as e:
        logger.error("Error ODBC al registrar consumo empleado %d: %s", numero_empleado, e)
        return {"Estado": "ERROR", "Mensaje": f"Error de comunicación con SUMMA: {str(e)[:200]}"}

    except (json.JSONDecodeError, TypeError) as e:
        logger.error("Respuesta inválida de SUMMA al registrar consumo empleado %d: %s", numero_empleado, e)
        return {"Estado": "ERROR", "Mensaje": "La respuesta del servidor no tiene el formato esperado."}


def obtener_total_consumo(numero_empleado: int, db: Session) -> dict:
    """
    Llama a dbo.sp_comedor_precio_consumo en SUMMA.
    Retorna dict con al menos: {"Estado": "OK"|"ERROR", "Total": float, "Mensaje": str}
    """
    try:
        conn   = _connect(db)
        cursor = conn.cursor()
        cursor.execute(
            "EXEC dbo.sp_comedor_precio_consumo @numero_empleado=?",
            (numero_empleado,)
        )
        row = cursor.fetchone()
        conn.close()

        if row is None:
            return {"Estado": "ERROR", "Total": 0, "Mensaje": "La consulta no retornó datos."}

        return json.loads(row[0])

    except ValueError as e:
        logger.warning("Configuración SUMMA incompleta: %s", e)
        return {"Estado": "ERROR", "Total": 0, "Mensaje": str(e)}

    except pyodbc.Error as e:
        logger.error("Error ODBC al obtener total empleado %d: %s", numero_empleado, e)
        return {"Estado": "ERROR", "Total": 0, "Mensaje": f"Error de comunicación con SUMMA: {str(e)[:200]}"}

    except (json.JSONDecodeError, TypeError) as e:
        logger.error("Respuesta inválida de SUMMA al obtener total empleado %d: %s", numero_empleado, e)
        return {"Estado": "ERROR", "Total": 0, "Mensaje": "La respuesta del servidor no tiene el formato esperado."}


# ── Artículos ─────────────────────────────────────────────────────────────────

def listar_articulos(db: Session) -> list:
    """Llama a dbo.sp_comedor_articulos_listar. Puede lanzar SummaConnectionError."""
    return _exec_list_sp("sp_comedor_articulos_listar", db)


def crear_articulo(
    codigo: str, nombre: str, descripcion: Optional[str],
    categoria: str, sub_categoria: str, precio: float, db: Session,
) -> dict:
    """Llama a dbo.sp_comedor_articulos_crear."""
    return _exec_status_sp(
        "sp_comedor_articulos_crear", db,
        codigo=codigo, nombre=nombre, descripcion=descripcion or "",
        categoria=categoria, sub_categoria=sub_categoria, precio=precio,
    )


def editar_articulo(
    codigo: str, descripcion: Optional[str],
    categoria: str, sub_categoria: str, precio: float, db: Session,
) -> dict:
    """
    Llama a dbo.sp_comedor_articulos_editar. NO recibe nombre — el código y
    el nombre de un artículo son inmutables (ver sql/sp_comedor_articulos.sql).
    """
    return _exec_status_sp(
        "sp_comedor_articulos_editar", db,
        codigo=codigo, descripcion=descripcion or "",
        categoria=categoria, sub_categoria=sub_categoria, precio=precio,
    )


def eliminar_articulo(codigo: str, db: Session) -> dict:
    """Llama a dbo.sp_comedor_articulos_eliminar."""
    return _exec_status_sp("sp_comedor_articulos_eliminar", db, codigo=codigo)


# ── Categorías y subcategorías ──────────────────────────────────────────────

def listar_categorias(db: Session) -> list:
    """Llama a dbo.sp_comedor_categorias_listar. Puede lanzar SummaConnectionError."""
    return _exec_list_sp("sp_comedor_categorias_listar", db)


def crear_categoria(categoria: str, db: Session) -> dict:
    """Llama a dbo.sp_comedor_categorias_crear."""
    return _exec_status_sp("sp_comedor_categorias_crear", db, categoria=categoria)


def editar_categoria(categoria_actual: str, categoria_nueva: str, db: Session) -> dict:
    """Llama a dbo.sp_comedor_categorias_editar (renombra en cascada, ver .sql)."""
    return _exec_status_sp(
        "sp_comedor_categorias_editar", db,
        categoria_actual=categoria_actual, categoria_nueva=categoria_nueva,
    )


def eliminar_categoria(categoria: str, db: Session) -> dict:
    """Llama a dbo.sp_comedor_categorias_eliminar (bloqueada si tiene artículos)."""
    return _exec_status_sp("sp_comedor_categorias_eliminar", db, categoria=categoria)


def listar_subcategorias(db: Session, categoria: Optional[str] = None) -> list:
    """Llama a dbo.sp_comedor_subcategorias_listar. Puede lanzar SummaConnectionError."""
    if categoria:
        return _exec_list_sp("sp_comedor_subcategorias_listar", db, categoria=categoria)
    return _exec_list_sp("sp_comedor_subcategorias_listar", db)


def crear_subcategoria(categoria: str, sub_categoria: str, db: Session) -> dict:
    """Llama a dbo.sp_comedor_subcategorias_crear."""
    return _exec_status_sp(
        "sp_comedor_subcategorias_crear", db,
        categoria=categoria, sub_categoria=sub_categoria,
    )


def editar_subcategoria(
    categoria: str, sub_categoria_actual: str, sub_categoria_nueva: str, db: Session,
) -> dict:
    """Llama a dbo.sp_comedor_subcategorias_editar (renombra en cascada, ver .sql)."""
    return _exec_status_sp(
        "sp_comedor_subcategorias_editar", db,
        categoria=categoria, sub_categoria_actual=sub_categoria_actual,
        sub_categoria_nueva=sub_categoria_nueva,
    )


def eliminar_subcategoria(categoria: str, sub_categoria: str, db: Session) -> dict:
    """Llama a dbo.sp_comedor_subcategorias_eliminar (bloqueada si tiene artículos)."""
    return _exec_status_sp(
        "sp_comedor_subcategorias_eliminar", db,
        categoria=categoria, sub_categoria=sub_categoria,
    )


def listar_categorias_arbol(db: Session) -> list:
    """
    Combina listar_categorias() + listar_subcategorias() en el árbol que
    espera el frontend, en vez de anidar el JSON del lado de SQL Server:
        [{"categoria": "Bebidas", "subCategorias": ["Aguas", "Gaseosas"]}, ...]
    Puede lanzar SummaConnectionError (se propaga desde cualquiera de los dos).
    """
    categorias = listar_categorias(db)
    subcategorias = listar_subcategorias(db)

    por_categoria: dict[str, list[str]] = {}
    for sc in subcategorias:
        por_categoria.setdefault(sc["categoria"], []).append(sc["subCategoria"])

    return [
        {
            "categoria": c["categoria"],
            "subCategorias": sorted(por_categoria.get(c["categoria"], [])),
        }
        for c in categorias
    ]


def test_connection(db: Session) -> dict:
    """
    Prueba la conexión a SUMMA sin ejecutar ninguna SP.
    Retorna {"ok": True|False, "mensaje": str}
    """
    try:
        conn = _connect(db)
        conn.close()
        return {"ok": True, "mensaje": "Conexión exitosa al servidor SUMMA."}
    except ValueError as e:
        return {"ok": False, "mensaje": str(e)}
    except pyodbc.Error as e:
        return {"ok": False, "mensaje": f"Error de conexión: {str(e)[:300]}"}
