# syntax=docker/dockerfile:1
#
# Sistema Comedor - Aluminios del Uruguay S.A.
# Build multi-etapa:
#   1. Compila el frontend React + Vite
#   2. Empaqueta todo en una imagen Python (FastAPI + pyodbc + MSSQL ODBC driver)
#
# Build:  docker build -t comedor:latest .
# Run:    docker compose up -d   (ver docker-compose.yml)

# ══════════════════════════════════════════════════════════════════════════════
# Etapa 1: build del frontend (React + Vite + Ant Design)
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim AS frontend-build

WORKDIR /app/frontend

# npm install genera el lockfile dentro del contenedor (no necesita Node en el host)
COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build


# ══════════════════════════════════════════════════════════════════════════════
# Etapa 2: runtime (FastAPI + SQLite + MSSQL ODBC Driver 18)
# ══════════════════════════════════════════════════════════════════════════════
FROM python:3.12-slim-bookworm AS runtime

ENV TZ=America/Montevideo

# ── Sistema: tzdata + compilador C++ + MSSQL ODBC Driver 18 ──────────────────
# g++ y unixodbc-dev son necesarios para compilar pyodbc desde fuente.
# Todo en un solo RUN para minimizar capas y limpiar apt cache al final.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tzdata curl gnupg2 g++ \
    && ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime \
    && echo "$TZ" > /etc/timezone \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
       | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
       > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Usuario sin privilegios ───────────────────────────────────────────────────
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

# ── Dependencias Python (pyodbc ya tiene g++ y unixodbc-dev disponibles) ──────
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# ── Código del backend + build del frontend ───────────────────────────────────
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# ── Directorios de estado persistente ────────────────────────────────────────
RUN mkdir -p backend/data backend/backups backend/logs \
    && chown -R appuser:appuser /app

USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app/backend
EXPOSE 8000

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
