import asyncio
from contextlib import asynccontextmanager
from decimal import Decimal, InvalidOperation
import json
import logging
from uuid import uuid4

import httpx
from asyncpg import Pool
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .database import database_lifespan
from .schemas import DuoQueueInput, FeedbackInput, KiraInput, MatchInput, PlayerInput, PowerupPurchaseInput, RewardClaimInput, STELLAR_PUBLIC_KEY, TransactionInput
from .stellar import pay_astra, pay_testnet_xlm

logger = logging.getLogger("stellar_arena.api")
settings = get_settings()

POWERUP_PRICES = {
    "aegis-bloom": Decimal("1.5000000"),
    "blink-shift": Decimal("2.2500000"),
    "emp-bloom": Decimal("2.7500000"),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = settings
    async with database_lifespan(app):
        yield


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.client_origin.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store" if request.method == "POST" else "public, max-age=30"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    logger.info("Rejected invalid request: %s", exc.errors())
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"error": "Invalid request payload."})


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(Exception)
async def server_error(_: Request, exc: Exception):
    logger.exception("Unhandled API error", exc_info=exc)
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"error": "Unexpected server error"})


async def register_player(pool: Pool, player: PlayerInput) -> dict[str, object]:
    row = await pool.fetchrow(
        """
        INSERT INTO players (wallet_address, display_name, age, wallet_provider, avatar_key)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (wallet_address) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            age = COALESCE(EXCLUDED.age, players.age),
            wallet_provider = EXCLUDED.wallet_provider,
            avatar_key = EXCLUDED.avatar_key,
            last_seen_at = NOW()
        RETURNING wallet_address, display_name, age
        """,
        player.wallet_address,
        player.display_name,
        player.age,
        player.wallet_provider,
        player.avatar_key,
    )
    return {"walletAddress": row["wallet_address"], "displayName": row["display_name"], "age": row["age"]}


def pool_for(request: Request) -> Pool:
    return request.app.state.db


async def verify_powerup_payment(payload: PowerupPurchaseInput) -> Decimal:
    """Confirm a native-XLM Testnet payment before granting a game power-up."""
    treasury = settings.stellar_powerup_treasury_address
    if not treasury:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="XLM power-up treasury is not configured.")
    expected = POWERUP_PRICES[payload.powerup_id]
    base = settings.stellar_horizon_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            transaction_response = await client.get(f"{base}/transactions/{payload.tx_hash}")
            transaction_response.raise_for_status()
            transaction = transaction_response.json()
            operations_response = await client.get(f"{base}/transactions/{payload.tx_hash}/operations", params={"limit": 200})
            operations_response.raise_for_status()
            operations = operations_response.json().get("_embedded", {}).get("records", [])
    except httpx.HTTPError as exc:
        logger.warning("Could not verify power-up payment %s: %s", payload.tx_hash, type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not verify the Stellar Testnet payment.") from exc

    if not transaction.get("successful") or transaction.get("source_account") != payload.wallet_address:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The payment does not belong to this connected wallet.")
    expected_memo = f"SA-PWR:{payload.powerup_id}"
    if transaction.get("memo") != expected_memo:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The payment memo does not match this power-up.")

    for operation in operations:
        if operation.get("type") != "payment" or operation.get("to") != treasury or operation.get("asset_type") != "native":
            continue
        try:
            amount = Decimal(operation.get("amount", "0"))
        except (InvalidOperation, TypeError):
            continue
        if amount == expected:
            return expected
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No matching XLM payment was found in this transaction.")


@app.get("/health")
@app.get("/api/health")
async def health(request: Request):
    await pool_for(request).execute("SELECT 1")
    return {"ok": True, "database": "connected", "service": "fastapi"}


@app.get("/api/leaderboard")
async def leaderboard(request: Request):
    rows = await pool_for(request).fetch(
        """
        SELECT p.display_name, p.avatar_key,
            COALESCE(SUM(m.cores), 0)::int AS cores,
            COUNT(m.id)::int AS matches
        FROM players p
        LEFT JOIN matches m ON m.wallet_address = p.wallet_address
        GROUP BY p.wallet_address
        ORDER BY cores DESC, matches DESC
        LIMIT 25
        """
    )
    return {"leaderboard": [dict(row) for row in rows]}


@app.post("/api/players/upsert")
async def upsert_player(payload: PlayerInput, request: Request):
    return {"player": await register_player(pool_for(request), payload)}


@app.get("/api/players/{wallet_address}")
async def get_player_profile(wallet_address: str, request: Request):
    if not STELLAR_PUBLIC_KEY.fullmatch(wallet_address):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A valid Stellar public address is required.")
    player = await pool_for(request).fetchrow(
        "SELECT display_name, age, wallet_provider FROM players WHERE wallet_address = $1",
        wallet_address,
    )
    return {"player": dict(player) if player else None}


async def duo_queue_status(pool: Pool, wallet_address: str) -> dict[str, object]:
    entry = await pool.fetchrow(
        "SELECT status, lobby_code, queued_at FROM duo_queue_entries WHERE wallet_address = $1",
        wallet_address,
    )
    if not entry:
        return {"status": "idle"}
    if entry["status"] == "queued":
        return {"status": "queued", "queuedAt": entry["queued_at"].isoformat()}
    lobby = await pool.fetchrow(
        """SELECT l.lobby_code, l.pilot_one_wallet, l.pilot_two_wallet, p1.display_name AS pilot_one, p2.display_name AS pilot_two
           FROM duo_lobbies l
           JOIN players p1 ON p1.wallet_address = l.pilot_one_wallet
           JOIN players p2 ON p2.wallet_address = l.pilot_two_wallet
           WHERE l.lobby_code = $1 AND l.status = 'ready'""",
        entry["lobby_code"],
    )
    if not lobby:
        return {"status": "idle"}
    partner = lobby["pilot_two"] if lobby["pilot_one_wallet"] == wallet_address else lobby["pilot_one"]
    return {"status": "matched", "lobbyCode": str(lobby["lobby_code"]), "partner": partner}


@app.post("/api/duo/join")
async def join_duo_queue(payload: DuoQueueInput, request: Request):
    """Pair two eligible registered pilots using Postgres as a durable lobby queue."""
    pool = pool_for(request)
    player = await register_player(pool, payload)
    if player["age"] is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Complete the pilot profile before joining Duo matchmaking.")
    async with pool.acquire() as connection:
        async with connection.transaction():
            existing = await connection.fetchrow("SELECT status, lobby_code FROM duo_queue_entries WHERE wallet_address = $1 FOR UPDATE", payload.wallet_address)
            if existing and existing["status"] == "matched":
                lobby = await connection.fetchrow(
                    """SELECT l.lobby_code, l.pilot_one_wallet, p1.display_name AS pilot_one, p2.display_name AS pilot_two
                       FROM duo_lobbies l JOIN players p1 ON p1.wallet_address = l.pilot_one_wallet
                       JOIN players p2 ON p2.wallet_address = l.pilot_two_wallet WHERE l.lobby_code = $1""",
                    existing["lobby_code"],
                )
                if lobby:
                    partner = lobby["pilot_two"] if lobby["pilot_one_wallet"] == payload.wallet_address else lobby["pilot_one"]
                    return {"status": "matched", "lobbyCode": str(lobby["lobby_code"]), "partner": partner}
            partner = await connection.fetchrow(
                """SELECT wallet_address, display_name FROM duo_queue_entries
                   WHERE status = 'queued' AND wallet_address <> $1
                   ORDER BY queued_at ASC FOR UPDATE SKIP LOCKED LIMIT 1""",
                payload.wallet_address,
            )
            if partner:
                lobby_code = uuid4()
                await connection.execute(
                    "INSERT INTO duo_lobbies (lobby_code, pilot_one_wallet, pilot_two_wallet) VALUES ($1, $2, $3)",
                    lobby_code, partner["wallet_address"], payload.wallet_address,
                )
                await connection.execute(
                    "UPDATE duo_queue_entries SET status = 'matched', lobby_code = $1, updated_at = NOW() WHERE wallet_address = $2",
                    lobby_code, partner["wallet_address"],
                )
                await connection.execute(
                    """INSERT INTO duo_queue_entries (wallet_address, display_name, status, lobby_code)
                       VALUES ($1, $2, 'matched', $3)
                       ON CONFLICT (wallet_address) DO UPDATE SET display_name = EXCLUDED.display_name, status = 'matched', lobby_code = $3, updated_at = NOW()""",
                    payload.wallet_address, player["displayName"], lobby_code,
                )
                return {"status": "matched", "lobbyCode": str(lobby_code), "partner": partner["display_name"]}
            await connection.execute(
                """INSERT INTO duo_queue_entries (wallet_address, display_name, status, lobby_code, queued_at, updated_at)
                   VALUES ($1, $2, 'queued', NULL, NOW(), NOW())
                   ON CONFLICT (wallet_address) DO UPDATE SET display_name = EXCLUDED.display_name, status = 'queued', lobby_code = NULL, queued_at = NOW(), updated_at = NOW()""",
                payload.wallet_address, player["displayName"],
            )
    return {"status": "queued"}


@app.get("/api/duo/{wallet_address}")
async def get_duo_queue(wallet_address: str, request: Request):
    if not STELLAR_PUBLIC_KEY.fullmatch(wallet_address):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A valid Stellar public address is required.")
    return await duo_queue_status(pool_for(request), wallet_address)


@app.post("/api/duo/{wallet_address}/leave")
async def leave_duo_queue(wallet_address: str, request: Request):
    if not STELLAR_PUBLIC_KEY.fullmatch(wallet_address):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A valid Stellar public address is required.")
    await pool_for(request).execute("DELETE FROM duo_queue_entries WHERE wallet_address = $1 AND status = 'queued'", wallet_address)
    return {"status": "idle"}


@app.post("/api/matches", status_code=status.HTTP_201_CREATED)
async def record_match(payload: MatchInput, request: Request):
    pool = pool_for(request)
    player = await register_player(pool, payload)
    if player["age"] is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Complete the pilot profile before entering the arena.")
    match_ref = payload.match_ref or f"practice-{payload.wallet_address}-{uuid4()}"
    row = await pool.fetchrow(
        """
        INSERT INTO matches (match_ref, wallet_address, mode, cores, placement, duration_seconds, verified, result_tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
        ON CONFLICT (match_ref) DO UPDATE SET cores = EXCLUDED.cores
        RETURNING id, match_ref, verified
        """,
        match_ref,
        player["walletAddress"],
        payload.mode,
        payload.cores,
        payload.placement,
        payload.duration_seconds,
        payload.result_tx_hash,
    )
    return {"match": dict(row)}


@app.post("/api/transactions", status_code=status.HTTP_201_CREATED)
async def record_transaction(payload: TransactionInput, request: Request):
    pool = pool_for(request)
    player = await register_player(pool, payload)
    row = await pool.fetchrow(
        """
        INSERT INTO stellar_transactions (tx_hash, wallet_address, action, network, contract_id, status, metadata, confirmed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, CASE WHEN $6 = 'confirmed' THEN NOW() ELSE NULL END)
        ON CONFLICT (tx_hash) DO UPDATE SET status = EXCLUDED.status, metadata = EXCLUDED.metadata
        RETURNING tx_hash, status
        """,
        payload.tx_hash,
        player["walletAddress"],
        payload.action,
        payload.network,
        payload.contract_id,
        payload.status,
        json.dumps(payload.metadata),
    )
    return {"transaction": dict(row)}


@app.post("/api/powerups/verify", status_code=status.HTTP_201_CREATED)
async def verify_and_grant_powerup(payload: PowerupPurchaseInput, request: Request):
    """Verify a wallet-signed XLM payment and persist the unlocked item."""
    pool = pool_for(request)
    player = await register_player(pool, payload)
    existing = await pool.fetchrow(
        "SELECT powerup_id, xlm_amount, tx_hash, equipped FROM powerup_purchases WHERE wallet_address = $1 AND powerup_id = $2",
        player["walletAddress"], payload.powerup_id,
    )
    if existing:
        return {"purchase": dict(existing), "status": "already_owned"}

    amount = await verify_powerup_payment(payload)
    async with pool.acquire() as connection:
        async with connection.transaction():
            prior_hash = await connection.fetchrow("SELECT wallet_address, powerup_id FROM powerup_purchases WHERE tx_hash = $1", payload.tx_hash)
            if prior_hash:
                if prior_hash["wallet_address"] == player["walletAddress"] and prior_hash["powerup_id"] == payload.powerup_id:
                    return {"purchase": {"powerup_id": payload.powerup_id, "tx_hash": payload.tx_hash, "equipped": True}, "status": "already_owned"}
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That Stellar transaction has already been used for another power-up.")
            await connection.execute(
                """
                INSERT INTO stellar_transactions (tx_hash, wallet_address, action, network, status, metadata, confirmed_at)
                VALUES ($1, $2, 'powerup_purchase', 'testnet', 'confirmed', $3::jsonb, NOW())
                ON CONFLICT (tx_hash) DO UPDATE SET status = 'confirmed', metadata = EXCLUDED.metadata
                """,
                payload.tx_hash,
                player["walletAddress"],
                json.dumps({"powerupId": payload.powerup_id, "xlmAmount": str(amount), "treasury": settings.stellar_powerup_treasury_address}),
            )
            purchase = await connection.fetchrow(
                """
                INSERT INTO powerup_purchases (wallet_address, powerup_id, xlm_amount, tx_hash, equipped)
                VALUES ($1, $2, $3, $4, TRUE)
                RETURNING powerup_id, xlm_amount, tx_hash, equipped, purchased_at
                """,
                player["walletAddress"], payload.powerup_id, amount, payload.tx_hash,
            )
    return {"purchase": dict(purchase), "status": "confirmed"}


@app.get("/api/powerups/{wallet_address}")
async def list_owned_powerups(wallet_address: str, request: Request):
    if not STELLAR_PUBLIC_KEY.fullmatch(wallet_address):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A valid Stellar public address is required.")
    rows = await pool_for(request).fetch(
        "SELECT powerup_id, xlm_amount, tx_hash, equipped, purchased_at FROM powerup_purchases WHERE wallet_address = $1 ORDER BY purchased_at",
        wallet_address,
    )
    return {"powerups": [dict(row) for row in rows]}


@app.post("/api/feedback", status_code=status.HTTP_201_CREATED)
async def record_feedback(payload: FeedbackInput, request: Request):
    await pool_for(request).execute(
        "INSERT INTO feedback (wallet_address, score, message) VALUES ($1, $2, $3)",
        payload.wallet_address,
        payload.score,
        payload.message.strip(),
    )
    return {"ok": True}


@app.post("/api/rewards/claim", status_code=status.HTTP_201_CREATED)
async def claim_testnet_astra(payload: RewardClaimInput, request: Request):
    """Mint a verified match's ASTRA reward after the player has established a trustline."""
    if not settings.stellar_game_asset_issuer or not settings.stellar_reward_issuer_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ASTRA Testnet issuer is not configured.")
    pool = pool_for(request)
    await register_player(pool, payload)
    match = await pool.fetchrow(
        "SELECT match_ref, cores FROM matches WHERE match_ref = $1 AND wallet_address = $2 AND verified = TRUE",
        payload.match_ref, payload.wallet_address,
    )
    if not match:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only verified match results can claim ASTRA.")
    already_claimed = await pool.fetchval("SELECT tx_hash FROM reward_claims WHERE match_ref = $1", payload.match_ref)
    if already_claimed:
        return {"transactionHash": already_claimed, "status": "already_claimed"}
    amount = f"{max(1, min(int(match['cores']) * 2, 1000)):.7f}"
    transaction_hash = await asyncio.to_thread(pay_astra, settings, payload.wallet_address, amount)
    async with pool.acquire() as connection:
        async with connection.transaction():
            await connection.execute(
                """INSERT INTO reward_claims (match_ref, wallet_address, asset_code, asset_issuer, amount, tx_hash)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                payload.match_ref, payload.wallet_address, settings.stellar_game_asset_code, settings.stellar_game_asset_issuer, amount, transaction_hash,
            )
            await connection.execute(
                """INSERT INTO stellar_transactions (tx_hash, wallet_address, action, network, contract_id, status, metadata, confirmed_at)
                   VALUES ($1, $2, 'astra_reward', 'testnet', NULL, 'confirmed', $3::jsonb, NOW())""",
                transaction_hash, payload.wallet_address, json.dumps({"matchRef": payload.match_ref, "amount": amount, "asset": settings.stellar_game_asset_code}),
            )
    return {"transactionHash": transaction_hash, "amount": amount, "assetCode": settings.stellar_game_asset_code, "status": "claimed"}


@app.post("/api/rewards/win-claim", status_code=status.HTTP_201_CREATED)
async def claim_testnet_win_xlm(payload: RewardClaimInput, request: Request):
    """Deliver one native-XLM Testnet prize for a first-place local MVP result.

    This remains deliberately Testnet-only until the planned authoritative multiplayer
    service signs final results; browser gameplay must never authorize Mainnet payouts.
    """
    if not settings.stellar_win_reward_treasury_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Testnet winner treasury is not configured.")
    try:
        amount_decimal = Decimal(settings.stellar_win_reward_amount)
    except InvalidOperation as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Testnet winner prize amount is invalid.") from exc
    if amount_decimal <= 0 or amount_decimal > Decimal("100"):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Testnet winner prize amount is outside the allowed range.")
    amount = f"{amount_decimal:.7f}"
    pool = pool_for(request)
    await register_player(pool, payload)
    match = await pool.fetchrow(
        "SELECT match_ref, placement FROM matches WHERE match_ref = $1 AND wallet_address = $2",
        payload.match_ref, payload.wallet_address,
    )
    if not match or match["placement"] != 1:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only a recorded first-place arena result can claim this Testnet prize.")
    already_claimed = await pool.fetchval("SELECT tx_hash FROM reward_claims WHERE match_ref = $1", payload.match_ref)
    if already_claimed:
        return {"transactionHash": already_claimed, "amount": amount, "assetCode": "XLM", "status": "already_claimed"}
    try:
        transaction_hash = await asyncio.to_thread(pay_testnet_xlm, settings, payload.wallet_address, amount)
    except Exception as exc:
        logger.warning("Testnet winner prize failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The Testnet prize could not be sent. Check the funded treasury and try again.") from exc
    async with pool.acquire() as connection:
        async with connection.transaction():
            await connection.execute(
                """INSERT INTO reward_claims (match_ref, wallet_address, asset_code, asset_issuer, amount, tx_hash)
                   VALUES ($1, $2, 'XLM', 'native', $3, $4)""",
                payload.match_ref, payload.wallet_address, amount, transaction_hash,
            )
            await connection.execute(
                """INSERT INTO stellar_transactions (tx_hash, wallet_address, action, network, contract_id, status, metadata, confirmed_at)
                   VALUES ($1, $2, 'testnet_xlm_win_prize', 'testnet', NULL, 'confirmed', $3::jsonb, NOW())""",
                transaction_hash, payload.wallet_address, json.dumps({"matchRef": payload.match_ref, "amount": amount, "asset": "XLM"}),
            )
    return {"transactionHash": transaction_hash, "amount": amount, "assetCode": "XLM", "status": "claimed"}


KIRA_PROMPTS = {
    "route": "Give a concise, wholesome tactical route for a 90-second Stellar Arena solo practice. Mention one safe core rotation. Keep it under 45 words.",
    "build": "Give a concise, wholesome Stellar Arena ability-kit suggestion. Mention Shield, Teleport and EMP. Keep it under 45 words.",
    "lore": "Tell one original, wholesome lore fact about Stellar Arena Cosmic Capture. Keep it under 45 words.",
    "briefing": "You are Kira, the warm but sharp tactical director for an original anime space arena game. Write one concise, actionable pre-flight directive for the selected mode and ability. Mention a safe opening route, when to use the ability, and one survival reminder. Keep it under 58 words. Never mention financial advice, real-world rewards, or private keys.",
}


@app.post("/api/kira")
async def ask_kira(payload: KiraInput):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GEMINI_API_KEY is not configured.")
    model_name = settings.gemini_model.removeprefix("models/")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    context = ""
    if payload.prompt == "briefing":
        context = f" Selected mode: {payload.mode or 'Solo'}. Selected ability: {payload.ability or 'Aegis Bloom'}."
    body = {
        "contents": [{"role": "user", "parts": [{"text": KIRA_PROMPTS[payload.prompt] + context}]}],
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 100},
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, params={"key": settings.gemini_api_key}, json=body)
    except httpx.RequestError as exc:
        logger.warning("Gemini uplink failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Kira's uplink is temporarily unavailable.") from exc
    if response.is_error:
        logger.warning("Gemini returned %s", response.status_code)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gemini rejected the guide request.")
    result = response.json()
    text = "".join(part.get("text", "") for part in result.get("candidates", [{}])[0].get("content", {}).get("parts", []))
    return {"reply": text.strip() or "The star map came back fuzzy. Try another route, pilot!"}
