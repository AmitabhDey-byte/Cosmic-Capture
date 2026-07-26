"""Apply the idempotent PostgreSQL schema migration used by Stellar Arena."""
import asyncio
from pathlib import Path

import asyncpg

from backend.app.config import get_settings
from backend.app.database import ssl_context


async def main() -> None:
    settings = get_settings()
    migration_path = Path(__file__).resolve().parents[2] / "db" / "migrations" / "001_initial.sql"
    sql = migration_path.read_text(encoding="utf-8")
    connection = await asyncpg.connect(settings.database_url, ssl=ssl_context(settings))
    try:
        await connection.execute(sql)
    finally:
        await connection.close()
    print("Database migration complete.")


if __name__ == "__main__":
    asyncio.run(main())
