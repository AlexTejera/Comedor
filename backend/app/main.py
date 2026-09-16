"""
main.py — Punto de entrada FastAPI
Sistema Comedor - Aluminios del Uruguay S.A.

FastAPI sirve el frontend React compilado como archivos estáticos.
Todos los endpoints de la API tienen el prefijo /api.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

from app.database import engine, Base, SessionLocal
from app.routers import auth, users, botoneras, kiosko, logs, settings, backup
from app.routers import soap_estado, articulos, categorias, gallery

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────
    logger.info("Iniciando Sistema Comedor...")
    Base.metadata.create_all(bind=engine)

    # Inicializar datos por defecto (usuario admin, settings)
    from init_db import init_db
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()

    logger.info("Sistema Comedor listo en :8000")
    yield
    # ── Shutdown ─────────────────────────────────────────────
    logger.info("Sistema Comedor detenido.")


app = FastAPI(
    title="Sistema Comedor — Aluminios del Uruguay",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS: solo necesario en desarrollo local (Vite corre en :5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers de la API ─────────────────────────────────────────────────────────
app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(users.router,     prefix="/api/users",     tags=["users"])
app.include_router(botoneras.router, prefix="/api/botoneras", tags=["botoneras"])
app.include_router(kiosko.router,    prefix="/api/kiosko",    tags=["kiosko"])
app.include_router(logs.router,      prefix="/api/logs",      tags=["logs"])
app.include_router(settings.router,  prefix="/api/settings",  tags=["settings"])
app.include_router(backup.router,    prefix="/api/backup",    tags=["backup"])
app.include_router(articulos.router,  prefix="/api/articulos",  tags=["articulos"])
app.include_router(categorias.router, prefix="/api/categorias", tags=["categorias"])
app.include_router(gallery.router,    prefix="/api/gallery",    tags=["gallery"])

# ── Servicio SOAP de estado (watchdog) ────────────────────────────────────────
app.include_router(soap_estado.router, prefix="/soap", tags=["soap"])

# ── Galería de imágenes subidas (logo, íconos de botones) ─────────────────────
# Igual que las rutas /api/* de arriba, este mount DEBE ir antes del catch-all
# del SPA (más abajo) — si no, el catch-all lo tapa y nunca sirve las imágenes.
_uploads_dir = Path(__file__).parent.parent / "data" / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/api/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    """
    Health check para monitoreo externo (watchdog).
    Verifica que el proceso responde Y que la base de datos local está operativa.
    Retorna HTTP 200 si todo está bien, HTTP 503 si la BD falla.
    """
    ahora = datetime.now(timezone.utc).isoformat()
    try:
        db.execute(text("SELECT 1"))
        return {
            "status":    "ok",
            "service":   "comedor",
            "version":   app.version,
            "timestamp": ahora,
            "db":        "ok",
        }
    except Exception as e:
        logger.error("Health check: BD no disponible — %s", e)
        return JSONResponse(
            status_code=503,
            content={
                "status":    "error",
                "service":   "comedor",
                "version":   app.version,
                "timestamp": ahora,
                "db":        "error",
                "detail":    str(e)[:200],
            },
        )


# ── Frontend estático (producción / Docker) ───────────────────────────────────
# En desarrollo, Vite sirve el frontend en :5173 y hace proxy de /api a :8000.
# En Docker, el Dockerfile compila el frontend y lo deja en /app/frontend/dist.
#
# IMPORTANTE: usamos un catch-all en lugar de StaticFiles(html=True) porque
# StaticFiles solo sirve index.html para "/", no para sub-rutas de la SPA
# como "/admin/login". Con el catch-all:
#   - Si el archivo existe en dist/ (assets/main.js, favicon.ico, etc.) → lo sirve
#   - Cualquier otra ruta (rutas React) → devuelve index.html
# Las rutas /api/* ya están registradas arriba y tienen prioridad absoluta.
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

    logger.info("Frontend servido desde %s", frontend_dist)
