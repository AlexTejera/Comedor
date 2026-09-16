from datetime import datetime
from pydantic import BaseModel


class GalleryImageOut(BaseModel):
    id: int
    filename: str
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime
    url: str  # ruta pública servible, ej: /uploads/<filename>

    model_config = {"from_attributes": True}
