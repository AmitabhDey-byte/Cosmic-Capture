from typing import Annotated, Literal
import re

from pydantic import BaseModel, Field, field_validator


STELLAR_PUBLIC_KEY = re.compile(r"^G[A-Z2-7]{55}$")
TX_HASH = re.compile(r"^[a-fA-F0-9]{64}$")


class PlayerInput(BaseModel):
    wallet_address: Annotated[str, Field(alias="walletAddress", min_length=56, max_length=56)]
    display_name: Annotated[str, Field(alias="displayName", default="Pilot", max_length=32)] = "Pilot"
    wallet_provider: Annotated[str, Field(alias="walletProvider", default="Unknown", max_length=32)] = "Unknown"
    avatar_key: Annotated[str, Field(alias="avatarKey", default="kira-pixel", max_length=64)] = "kira-pixel"

    model_config = {"populate_by_name": True}

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet_address(cls, value: str) -> str:
        if not STELLAR_PUBLIC_KEY.fullmatch(value):
            raise ValueError("A valid Stellar public address is required.")
        return value

    @field_validator("display_name", "wallet_provider", "avatar_key")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip() or "Pilot"


class MatchInput(PlayerInput):
    match_ref: Annotated[str | None, Field(alias="matchRef", max_length=128)] = None
    mode: Literal["solo", "duo", "tournament"] = "solo"
    cores: Annotated[int, Field(default=0, ge=0, le=9999)] = 0
    placement: Annotated[int | None, Field(default=None, gt=0)] = None
    duration_seconds: Annotated[int, Field(alias="durationSeconds", default=0, ge=0, le=3600)] = 0
    result_tx_hash: Annotated[str | None, Field(alias="resultTxHash", default=None)] = None

    @field_validator("result_tx_hash")
    @classmethod
    def validate_result_hash(cls, value: str | None) -> str | None:
        if value is not None and not TX_HASH.fullmatch(value):
            raise ValueError("A result transaction hash must be 64 hexadecimal characters.")
        return value


class TransactionInput(PlayerInput):
    tx_hash: Annotated[str, Field(alias="txHash")]
    action: Annotated[str, Field(default="unknown", max_length=64)] = "unknown"
    network: Annotated[str, Field(default="testnet", max_length=32)] = "testnet"
    contract_id: Annotated[str | None, Field(alias="contractId", default=None, max_length=128)] = None
    status: Annotated[str, Field(default="submitted", max_length=32)] = "submitted"
    metadata: dict[str, object] = Field(default_factory=dict)

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, value: str) -> str:
        if not TX_HASH.fullmatch(value):
            raise ValueError("A 64-character transaction hash is required.")
        return value


class PowerupPurchaseInput(PlayerInput):
    tx_hash: Annotated[str, Field(alias="txHash")]
    powerup_id: Literal["aegis-bloom", "blink-shift", "emp-bloom"] = Field(alias="powerupId")

    @field_validator("tx_hash")
    @classmethod
    def validate_powerup_hash(cls, value: str) -> str:
        if not TX_HASH.fullmatch(value):
            raise ValueError("A 64-character transaction hash is required.")
        return value


class FeedbackInput(BaseModel):
    wallet_address: Annotated[str | None, Field(alias="walletAddress", default=None)] = None
    score: Annotated[int | None, Field(default=None, ge=1, le=5)] = None
    message: Annotated[str, Field(min_length=1, max_length=2000)]

    model_config = {"populate_by_name": True}

    @field_validator("wallet_address")
    @classmethod
    def validate_optional_wallet(cls, value: str | None) -> str | None:
        if value is not None and not STELLAR_PUBLIC_KEY.fullmatch(value):
            raise ValueError("A valid Stellar public address is required.")
        return value

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Feedback cannot be empty.")
        return value


class KiraInput(BaseModel):
    prompt: Literal["route", "build", "lore", "briefing"]
    mode: Annotated[str | None, Field(default=None, max_length=24)] = None
    ability: Annotated[str | None, Field(default=None, max_length=48)] = None


class RewardClaimInput(PlayerInput):
    match_ref: Annotated[str, Field(alias="matchRef", min_length=1, max_length=128)]
