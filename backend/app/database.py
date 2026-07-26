import ssl
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI

from .config import Settings


def ssl_context(settings: Settings) -> ssl.SSLContext | None:
    return ssl.create_default_context() if settings.database_ssl else None


@asynccontextmanager
async def database_lifespan(app: FastAPI):
    settings: Settings = app.state.settings
    app.state.db = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.database_pool_min,
        max_size=settings.database_pool_max,
        ssl=ssl_context(settings),
        command_timeout=10,
    )
    yield
    await app.state.db.close()


def get_pool(app: FastAPI) -> asyncpg.Pool:
    return app.state.db
