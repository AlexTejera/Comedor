# Contexto del Proyecto para Claude
## Sistema Comedor — Aluminios del Uruguay S.A.

> **Propósito**: Proveer contexto completo para retomar el trabajo sin re-explicar la arquitectura.  
> **Última actualización**: 2026-09-11 — estado pre-deploy Ubuntu, todo funcional en PC de desarrollo (10.10.32.3:11546).

---

## Descripción general

Aplicación web de kiosko para el comedor de la empresa. Los empleados ingresan su número de
legajo y seleccionan productos de una botonera configurable. El sistema valida y registra
el consumo en el servidor SUMMA (MSSQL) y genera un ticket de impresión para la impresora
térmica del kiosko (Chrome en modo kiosko, imprime en la impresora por defecto del sistema).

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | Python + FastAPI | 0.115.x |
| ORM | SQLAlchemy 2.0 | 2.0.x |
| Migraciones | Alembic | 1.14.x |
| MSSQL client | pyodbc | 5.1.x |
| Auth (admin) | JWT (python-jose) + bcrypt (passlib) | — |
| Frontend | React 18 + Vite 5 | — |
| UI Components | Ant Design 5 | 5.x |
| DB local | SQLite (comedor.db) | — |
| Contenedor | Docker multi-stage → Ubuntu | — |
| Puerto | **11546:8000** | — |
| TZ | America/Montevideo | — |

> ⚠️ **Python 3.12** — no usar `spyne` (incompatible con Python 3.12, falla con `ModuleNotFoundError: spyne.util.six.moves`). El servicio SOAP está implementado manualmente en FastAPI.

---

## Estructura de directorios

```
Comedor_web_docker/
├── backend/
│   ├── app/
│   │   ├── main.py                  ← Punto de entrada FastAPI + sirve frontend/dist + SOAP router
│   │   ├── config.py                ← Settings (pydantic-settings, lee .env)
│   │   ├── database.py              ← Engine SQLAlchemy, SessionLocal, get_db()
│   │   ├── models/                  ← user, botonera, boton, consumption_log, settings
│   │   ├── schemas/                 ← Pydantic schemas (validación request/response)
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── botoneras.py
│   │   │   ├── kiosko.py            ← Incluye /config y /total-consumo/{nro}
│   │   │   ├── logs.py
│   │   │   ├── settings.py
│   │   │   ├── backup.py
│   │   │   └── soap_estado.py       ← SOAP watchdog (ConsultarEstado)
│   │   ├── services/
│   │   │   ├── summa_service.py     ← Conexión MSSQL + llamadas a SPs
│   │   │   ├── log_service.py       ← Historial de eventos (auto-limpieza 2000 reg)
│   │   │   ├── backup_service.py    ← Backup/restore SQLite
│   │   │   └── auth_service.py      ← Login admin
│   │   └── utils/
│   │       └── security.py          ← JWT, hash, get_current_user, require_admin
│   ├── alembic/                     ← Migraciones de BD
│   ├── data/                        ← comedor.db (SQLite) — NO en git
│   ├── backups/                     ← Archivos .db de backup — NO en git
│   ├── logs/                        ← Logs de uvicorn — NO en git
│   ├── init_db.py                   ← Crea admin + settings por defecto al startup
│   ├── .env                         ← NO en git — crear manualmente en Ubuntu
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── KioskoPage.jsx       ← Máquina de estados principal del kiosko
│       │   ├── AdminLoginPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── BotonerasPage.jsx
│       │   ├── LogsPage.jsx
│       │   ├── SettingsPage.jsx     ← Config SUMMA + test conexión + toggle numpad
│       │   ├── UsersPage.jsx
│       │   └── BackupPage.jsx
│       ├── services/
│       │   ├── kioskService.js      ← validarEmpleado, confirmarPedido, getConfig, getTotalConsumo
│       │   └── botoneraService.js
│       ├── index.css                ← Estilos globales + @media print para ticket POS
│       └── context/AuthContext.jsx
├── sql/                             ← Scripts SQL para crear SPs en SUMMA
│   ├── sp_comedor_validar_empleado.sql
│   ├── sp_comedor_registrar_consumo.sql
│   └── sp_comedor_precio_consumo.sql
├── Dockerfile
├── docker-compose.yml
└── docs/CLAUDE_CONTEXT.md          ← Este archivo
```

---

## Modelos SQLite (BD local)

### User (admin panel)
- `id`, `username`, `email`, `hashed_password`, `role` (admin/user), `is_active`

### Botonera
- `id`, `nombre`, `hora_inicio` (HH:MM), `hora_fin` (HH:MM), `activa`, `orden`

### Boton
- `id`, `botonera_id`, `nombre`, `producto_codigo`, `max_unidades`, `visible`, `orden`, `color`
- `producto_codigo` → se envía a SUMMA como `articulo` en el JSON de items

### ConsumptionLog (historial, máx 2000)
- `id`, `empleado_cod`, `nombre_empleado`, `tipo`, `items_json`, `resultado`, `mensaje`, `fecha_hora`

### SystemSetting (clave/valor)
| Clave | Descripción |
|-------|-------------|
| `summa_server` | IP del servidor MSSQL SUMMA |
| `summa_port` | Puerto (default: 1433) |
| `summa_database` | Nombre de la BD (default: Comedor) |
| `summa_user` | Usuario SQL |
| `summa_password` | Contraseña SQL |
| `summa_driver` | ODBC Driver 18 for SQL Server |
| `log_max_records` | Máximo registros en historial (default: 2000) |
| `mostrar_numpad` | `"true"` / `"false"` — muestra/oculta teclado numérico en pantalla de login del kiosko |

---

## Endpoints de la API

### Kiosko (públicos, sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/kiosko/validar-empleado` | Valida número de empleado + retorna botonera activa |
| POST | `/api/kiosko/confirmar-pedido` | Registra consumo en SUMMA |
| GET  | `/api/kiosko/botonera-activa` | Botonera activa para el horario actual |
| GET  | `/api/kiosko/config` | Config pública del kiosko (solo `mostrar_numpad`) |
| GET  | `/api/kiosko/total-consumo/{numero_empleado}` | Total consumido en el día (llama a SP SUMMA) |

### Admin (requieren JWT Bearer)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login admin |
| GET/PUT | `/api/settings` | Leer/actualizar settings (incl. `mostrar_numpad`) |
| POST | `/api/settings/test-connection` | Probar conexión a SUMMA |
| GET/POST/PUT/DELETE | `/api/botoneras` | CRUD botoneras |
| GET/POST/PUT/DELETE | `/api/botoneras/{id}/botones` | CRUD botones |
| GET | `/api/logs` | Historial |
| GET/POST | `/api/backup` | Listar / crear backup |
| GET | `/api/backup/descargar/{file}` | Descargar backup |
| POST | `/api/backup/restaurar/{file}` | Restaurar backup |
| DELETE | `/api/backup/{file}` | Eliminar backup |
| GET | `/api/health` | Health check (HTTP 200 ok / HTTP 503 error) |

### SOAP Watchdog (sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/soap/estado?wsdl` | Retorna el WSDL del servicio |
| POST | `/soap/estado` | Operación `ConsultarEstado` → `<estado>ok</estado>` |

---

## Conexión MSSQL SUMMA

**Base de datos:** `[Comedor]`  
**Tabla de empleados:** `[Comedor].[dbo].[Usuario]`  
- `cod_tarjeta` → número de legajo del empleado  
- `nombre_usuario` → nombre completo  
- `Habilitado` → `'S'` = habilitado para consumir  

### Stored Procedures en SUMMA — **YA CREADOS** ✅

#### `dbo.sp_comedor_validar_empleado(@numero_empleado INT)`
```json
{"Estado": "OK", "Mensaje": "...", "NombreEmpleado": "Juan Pérez"}
{"Estado": "ERROR", "Mensaje": "El empleado no está habilitado."}
```

#### `dbo.sp_comedor_registrar_consumo(@numero_empleado INT, @items NVARCHAR(MAX))`
`@items` es un JSON array: `[{"articulo":"MENU01","cantidad":1}]`

> ⚠️ **IMPORTANTE**: No usar `OPENJSON...WITH` ni `OPENJSON` básico si el nivel de compatibilidad
> de la BD es < 130. Usar WHILE loop con `JSON_VALUE(@items, '$[N].campo')` — funciona en SQL Server 2016+
> independientemente del compat level.

```json
{"Estado": "OK", "Mensaje": "Consumo registrado correctamente."}
```
Tabla de destino: `dbo.Consumo_v1` (usuario, Articulo_consumo, cantidad, fecha, validado='Pendiente', Contabilizado='No')

#### `dbo.sp_comedor_precio_consumo(@numero_empleado INT)`
```json
{"Estado": "OK", "Total": 1234.50, "Mensaje": "OK"}
```
Usa OUTER APPLY para calcular el total del día actual desde `Consumo_v1` + tabla `Articulos`.

**Contrato:** todas las SPs retornan siempre una fila con el JSON en la primera columna (SELECT sin FOR JSON).

---

## Servicio SOAP Watchdog

Implementado manualmente en FastAPI (sin spyne — incompatible con Python 3.12).  
Archivo: `backend/app/routers/soap_estado.py`  
Montado en `main.py`: `app.include_router(soap_estado.router, prefix="/soap", tags=["soap"])`

### Configuración para el formulario del watchdog externo

| Campo | Valor |
|-------|-------|
| URL del WSDL | `http://<ip-servidor>:11546/soap/estado?wsdl` |
| Nombre de la operación SOAP | `ConsultarEstado` |
| SOAPAction | `ConsultarEstado` |
| Namespace | `http://aluminios.com.uy/comedor` |
| URL del endpoint | `http://<ip-servidor>:11546/soap/estado` |
| Campo de respuesta | `estado` (valor esperado: `ok`) |

> ⚠️ **Gotcha WSDL**: el `xmlns` default del elemento `<definitions>` DEBE ser
> `http://schemas.xmlsoap.org/wsdl/` (no el namespace propio). Si se pone el namespace
> propio como default, los parsers WSDL rechazan el WSDL con
> `"Expected element '{wsdl/}definitions'"`.

---

## Soporte para WAF/DMZ con prefijo de ruta

Aluminios está armando una DMZ con WAF para exponer el sitio hacia afuera
como `https://aluminios.com.uy/comedor` (mapeado a este container). El WAF
**preserva el prefijo** al reenviar la request (no lo recorta) — le llega
al backend `/comedor/api/...` tal cual.

El acceso interno directo (`http://10.25.1.165:11546/...`, sin prefijo)
sigue funcionando exactamente igual, sin cambios — la misma corrida del
container soporta ambos modos a la vez.

**Piezas:**
- `WAF_PATH_PREFIX` en `.env` (default `/comedor`) — vacío desactiva el soporte.
- `backend/app/middleware/prefijo_waf.py`: si la request trae el prefijo, lo
  saca antes de que el router la matchee y setea `scope["root_path"]` (así
  `request.base_url` de Starlette ya lo incorpora solo — no sumarlo dos
  veces, ver el comentario en `soap_estado.py`).
- `serve_spa()` en `main.py`: reescribe al vuelo las rutas `/assets/...` y
  `/favicon.svg` de `index.html` con el prefijo, cuando corresponde.
  **A propósito NO se usa Vite `base` relativa** (`./`) para esto — con un
  SPA de rutas anidadas (`/admin/botoneras`) un link profundo cargado
  directo resolvería mal las rutas relativas (ver el comentario en
  `vite.config.js`).
- `frontend/src/utils/wafPrefix.js`: contraparte del lado del navegador —
  el WAF no reescribe lo que ve el cliente, así que el frontend detecta el
  prefijo mirando `window.location.pathname` y lo usa para el `basename`
  del router, el `baseURL` de axios, y las imágenes servidas desde `/uploads`.

---

## Flujo del kiosko

```
Login → validar-empleado (SUMMA) → botonera activa → selección →
confirmar-pedido (SUMMA) → obtener-total-consumo (SUMMA) → imprimir ticket → volver a login
```

- **Timeout inactividad:** 60 segundos (vuelve al login automáticamente)
- **Post-impresión:** vuelve al login a los 5 segundos
- **Impresión:** `window.print()` → impresora por defecto del sistema (Chrome kiosko)

### Ticket de impresión (impresora térmica POS 80mm)
- CSS `@media print` en `frontend/src/index.css`
- `@page { margin: 0 }` para eliminar encabezado/pie del navegador (URL, fecha, n° de hoja)
- Se oculta `.kiosko-header, .kiosko-body` (NO `body > *` — causaría herencia que oculta el ticket)
- Fuente: `Courier New`, `font-weight: bold` global (las térmicas de baja resolución imprimen mucho mejor en negrita)
- Separadores con `::before { content: '--------------------------------' }` (más confiable que CSS borders en térmicas)
- Ancho: 80mm, font-size base 14px

### Numpad en login
- Setting `mostrar_numpad` controla si se muestra el teclado numérico en pantalla
- Cuando está oculto, el empleado tipea desde teclado físico y presiona Enter
- El kiosko siempre escucha eventos de teclado físico (independientemente del numpad)

---

## Docker

### Nombre del servicio en docker-compose.yml
El servicio se llama **`comedor`** (no `backend`).

```bash
# Build
docker compose build comedor

# Arrancar / recrear contenedor
docker compose up -d

# Build + arrancar en un paso
docker compose up -d --build

# Ver logs en vivo
docker compose logs -f

# Reiniciar sin rebuild
docker compose restart
```

> ⚠️ En PowerShell 5.1 NO usar `&&` — separar en comandos distintos o usar `;`

---

## Deploy en Ubuntu — Pasos completos

### Pre-requisitos en el servidor Ubuntu
- Docker + Docker Compose instalados
- Git instalado

### 1. Clonar el repositorio
```bash
git clone <url-del-repo> /opt/comedor
cd /opt/comedor
```

### 2. Crear el archivo `.env`
```bash
nano backend/.env
```
Contenido:
```
SECRET_KEY=<clave-larga-y-aleatoria-minimo-32-caracteres>
ACCESS_TOKEN_EXPIRE_HOURS=8
DATABASE_URL=sqlite:///./data/comedor.db
```
> La clave puede generarse con: `python3 -c "import secrets; print(secrets.token_hex(32))"`

### 3. Crear directorios y permisos
```bash
mkdir -p backend/data backend/backups backend/logs
sudo chown -R 1000:1000 backend/data backend/backups backend/logs
```

### 4. Build y arranque
```bash
docker compose up -d --build
```
Primera vez tarda varios minutos (descarga imagen base, instala ODBC Driver, compila frontend).

### 5. Verificar que levantó
```bash
curl http://localhost:11546/api/health
# Debe retornar: {"status":"ok","service":"comedor",...}
```

### 6. Configurar conexión SUMMA
- Abrir `http://<ip-ubuntu>:11546/admin`
- Login: `admin` / `Admin1234!` → **cambiar contraseña inmediatamente**
- Ir a Configuración → completar datos del servidor SUMMA
- Hacer clic en "Probar conexión"

### 7. Configurar el watchdog externo
- WSDL: `http://<ip-ubuntu>:11546/soap/estado?wsdl`
- Endpoint: `http://<ip-ubuntu>:11546/soap/estado`
- Operación: `ConsultarEstado`
- Campo respuesta: `estado` = `ok`

---

## Proyecto de referencia
- `Ejecucion_de_tareas_programadas_docker` (puerto 11544) — mismo patrón Docker: multi-stage, bind mounts, appuser UID 1000

---

## Credenciales por defecto

- **Admin:** `admin` / `Admin1234!` — **CAMBIAR INMEDIATAMENTE EN PRODUCCIÓN**

---

## Lo que NO está en git (y por qué)

| Ruta | Razón |
|------|-------|
| `backend/.env` | Contiene SECRET_KEY — crear manualmente en cada servidor |
| `backend/data/` | BD SQLite con datos reales |
| `backend/backups/` | Backups locales |
| `backend/logs/` | Logs de runtime |
| `frontend/dist/` | Build compilado (se genera en el Dockerfile) |
| `frontend/node_modules/` | Dependencias npm |

---

## Estado del proyecto (2026-09-11)

### ✅ Completado
- Estructura completa backend + frontend + Docker
- Sistema de login kiosko con numpad y soporte teclado físico
- Botoneras configurables por horario (tipo, color, máx. unidades, combos)
- Validación de empleados contra SUMMA (`sp_comedor_validar_empleado`) ✅ SP creado
- Registro de consumo en SUMMA (`sp_comedor_registrar_consumo`) ✅ SP creado
- Cálculo de total consumido (`sp_comedor_precio_consumo`) ✅ SP creado
- Ticket de impresión diseñado para impresora térmica POS 80mm
- Panel admin completo (botoneras, logs, settings, backup, usuarios)
- Health check REST (`/api/health`)
- Servicio SOAP watchdog (`/soap/estado`) — ConsultarEstado → `<estado>ok</estado>`
- Setting `mostrar_numpad` (toggle visible desde panel admin)
- Gestión de límites de consumo por artículo (`Limite_consumo`) desde el panel
- Soporte para WAF/DMZ con prefijo de ruta (`/comedor`), conviviendo con el acceso interno directo

### ⏳ Pendiente
- Deploy en servidor Ubuntu de producción
- Test de flujo completo con conexión SUMMA real en producción
- Cambiar contraseña admin por defecto
- Configurar datos de SUMMA desde el panel admin en producción
- Configurar watchdog externo con la IP de producción
