from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Stellar Arena API"
    environment: str = "development"
    port: int = 3001
    client_origin: str = "http://localhost:5173"
    database_url: str
    database_ssl: bool = False
    database_pool_min: int = Field(default=1, ge=1)
    database_pool_max: int = Field(default=10, ge=1)
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    stellar_network: str = "testnet"
    stellar_horizon_url: str = "https://horizon-testnet.stellar.org"
    stellar_game_asset_code: str = "ASTRA"
    stellar_game_asset_issuer: str | None = None
    stellar_reward_issuer_secret: str | None = None
    stellar_powerup_treasury_address: str | None = None
    soroban_rpc_url: str = "https://soroban-testnet.stellar.org"
    result_verifier_secret: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
