"""
prefijo_waf.py
Middleware ASGI puro (corre antes que el router) para que el sitio arme
bien sus propias URLs (el WSDL del watchdog SOAP, las rutas de assets de
index.html) tanto en acceso interno directo como a través del WAF de la
DMZ (Nginx Proxy Manager).

CONFIRMADO contra la config real (2026-09-18): el WAF recorta el prefijo
antes de reenviar acá — la location de /comedor tiene
"rewrite ^/comedor/?(.*)$ /$1 break;" — así que la ruta que le llega a este
proceso YA VIENE SIN el prefijo, sea acceso interno o externo por WAF.
Como no hay nada distinto en la ruta entrante para diferenciar un modo del
otro, el WAF tiene que avisar con un header — leemos X-Forwarded-Prefix.

Agregar en el snippet nginx de la location /comedor (mismo lugar que ya
tiene el rewrite y el auth_request de Authelia):

    proxy_set_header X-Forwarded-Prefix /comedor;

Sin ese header (acceso interno directo, o si todavía no se agregó en el
WAF) no se toca nada — mismo comportamiento que sin este middleware.

Nota de seguridad: se confía en el header tal cual venga, sin validar que
la request pase realmente por el WAF. El peor caso de que alguien lo
falsifique a mano es que su propia página le cargue mal un par de rutas de
assets — no es una superficie de control de acceso, así que no vale la
pena una lista de proxies confiables para esto (mismo criterio que
frontend/src/lib/redUsuario.ts en PortalApp-Aluminios).

Ver también frontend/src/utils/wafPrefix.js, la contraparte del lado del
navegador (el WAF no reescribe lo que ve el cliente, así que el frontend
necesita su propia detección para armar sus URLs).

OJO — por qué esto NO usa scope["root_path"]: root_path es el campo
estándar de ASGI, y Starlette asume que scope["path"] YA lo trae como
prefijo (para poder recortarlo de forma consistente en cada Mount
anidado, ver starlette._utils.get_route_path). Acá no es así: nginx ya
sacó el prefijo antes de reenviar, así que scope["path"] llega limpio.
Setear root_path de todos modos rompe cualquier app.mount() (ej. el de
StaticFiles para /uploads) — Starlette intenta recortar el prefijo de
un path que nunca lo tuvo y termina buscando el archivo en una ruta
duplicada ("uploads/uploads/..."), 404 total. Por eso el prefijo detectado
se guarda en scope["state"], una clave propia que no interfiere con nada
del ruteo interno — soap_estado.py y main.py lo leen de ahí.
"""

HEADER_PREFIJO = b"x-forwarded-prefix"


class PrefijoWafMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            for nombre, valor in scope.get("headers", []):
                if nombre.lower() == HEADER_PREFIJO:
                    prefijo = valor.decode("latin-1").rstrip("/")
                    if prefijo:
                        scope.setdefault("state", {})["waf_prefix"] = prefijo
                    break

        await self.app(scope, receive, send)
