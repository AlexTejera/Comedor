from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Seguridad
    secret_key: str = "dev-secret-key-CAMBIAR-en-produccion"
    access_token_expire_hours: int = 8

    # Base de datos SQLite local
    database_url: str = "sqlite:///./data/comedor.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
