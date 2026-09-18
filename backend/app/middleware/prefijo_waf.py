"""
prefijo_waf.py
Middleware ASGI puro (corre antes que el router) para que el sitio funcione
tanto accedido directo (sin prefijo, como hoy: http://10.25.1.165:11546/...)
como a través del WAF/reverse proxy de la DMZ, que preserva el prefijo al
reenviar la request (ej. https://aluminios.com.uy/comedor/api/... le llega
al backend tal cual, con el "/comedor" incluido).

Si la ruta entrante empieza con el prefijo configurado, se lo saca antes de
que el router intente matchear (si no, "/comedor/api/auth/login" no
coincide con ninguna ruta registrada como "/api/auth/login" y da 404) y se
guarda en scope["root_path"] para que el código que arma URLs propias
absolutas (ej. el WSDL del watchdog SOAP, ver routers/soap_estado.py) sepa
que tiene que incluirlo de vuelta.

Si la ruta NO trae el prefijo (acceso interno directo), no se toca nada —
el comportamiento actual queda exactamente igual.

Ver también frontend/src/utils/wafPrefix.js, la contraparte del lado del
navegador (el WAF no reescribe lo que ve el cliente, así que el frontend
necesita su propia detección para armar sus URLs).
"""


class PrefijoWafMiddleware:
    def __init__(self, app, prefix: str):
        self.app = app
        self.prefix = prefix.rstrip("/") if prefix else ""

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not self.prefix:
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        if path == self.prefix or path.startswith(self.prefix + "/"):
            scope["path"] = path[len(self.prefix):] or "/"

            raw_path = scope.get("raw_path")
            if raw_path:
                prefix_bytes = self.prefix.encode("utf-8")
                if raw_path.startswith(prefix_bytes):
                    scope["raw_path"] = raw_path[len(prefix_bytes):] or b"/"

            scope["root_path"] = scope.get("root_path", "") + self.prefix

        await self.app(scope, receive, send)
