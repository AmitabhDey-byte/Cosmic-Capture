"""Local FastAPI development entry point that honours PORT from .env."""
import uvicorn

from backend.app.config import get_settings


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=settings.port)
