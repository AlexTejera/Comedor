from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Seguridad
    secret_key: str = "dev-secret-key-CAMBIAR-en-produccion"
    access_token_expire_hours: int = 8

    # Base de datos SQLite local
    database_url: str = "sqlite:///./data/comedor.db"

    # Prefijo de ruta que agrega el WAF/reverse proxy de la DMZ al exponer
    # el sitio hacia afuera (ej. "/comedor" para https://aluminios.com.uy/comedor).
    # El WAF preserva el prefijo (no lo recorta) al reenviar la request acá.
    # Vacío ("") desactiva el soporte — el acceso directo interno (sin WAF)
    # sigue funcionando igual sin tocar nada, ver app/middleware/prefijo_waf.py.
    waf_path_prefix: str = "/comedor"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
