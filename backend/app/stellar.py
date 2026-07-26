"""Server-side Testnet utility-asset rewards. The issuer secret never reaches the browser."""
from stellar_sdk import Asset, Keypair, Network, Server, TransactionBuilder
from stellar_sdk.exceptions import BadRequestError, Ed25519SecretSeedInvalidError, NotFoundError

from .config import Settings


class TestnetPayoutConfigurationError(RuntimeError):
    """A safe, actionable payout setup failure suitable for the browser."""


class TestnetPayoutRejectedError(RuntimeError):
    """A Stellar network rejection that does not reveal a server secret."""


def pay_astra(settings: Settings, destination: str, amount: str) -> str:
    if not settings.stellar_game_asset_issuer or not settings.stellar_reward_issuer_secret:
        raise ValueError("ASTRA issuer configuration is incomplete.")
    issuer = Keypair.from_secret(settings.stellar_reward_issuer_secret)
    if issuer.public_key != settings.stellar_game_asset_issuer:
        raise ValueError("STELLAR_REWARD_ISSUER_SECRET does not match STELLAR_GAME_ASSET_ISSUER.")
    server = Server(settings.stellar_horizon_url)
    account = server.load_account(issuer.public_key)
    transaction = (
        TransactionBuilder(account, network_passphrase=Network.TESTNET, base_fee=100)
        .append_payment_op(destination=destination, asset=Asset(settings.stellar_game_asset_code, issuer.public_key), amount=amount)
        .set_timeout(45)
        .build()
    )
    transaction.sign(issuer)
    result = server.submit_transaction(transaction)
    return str(result["hash"])


def pay_testnet_xlm(settings: Settings, destination: str, amount: str) -> str:
    """Send a native-XLM Testnet prize from the backend-controlled treasury."""
    if not settings.stellar_win_reward_treasury_secret:
        raise ValueError("STELLAR_WIN_REWARD_TREASURY_SECRET is not configured.")
    try:
        treasury = Keypair.from_secret(settings.stellar_win_reward_treasury_secret)
    except Ed25519SecretSeedInvalidError as exc:
        raise TestnetPayoutConfigurationError("Winner treasury must be a Stellar Testnet secret key beginning with S, not a public G address.") from exc
    server = Server(settings.stellar_horizon_url)
    try:
        account = server.load_account(treasury.public_key)
    except NotFoundError as exc:
        raise TestnetPayoutConfigurationError("Winner treasury account is not funded on Stellar Testnet. Fund its public G address with Friendbot, then retry.") from exc
    try:
        server.load_account(destination)
    except NotFoundError as exc:
        raise TestnetPayoutConfigurationError("The connected player wallet is not funded on Stellar Testnet yet.") from exc
    transaction = (
        TransactionBuilder(account, network_passphrase=Network.TESTNET, base_fee=100)
        .append_payment_op(destination=destination, asset=Asset.native(), amount=amount)
        .add_text_memo("SA-WIN-PRIZE")
        .set_timeout(45)
        .build()
    )
    transaction.sign(treasury)
    try:
        result = server.submit_transaction(transaction)
    except BadRequestError as exc:
        raise TestnetPayoutRejectedError("Stellar rejected the prize transaction. Confirm the treasury has enough Testnet XLM for the prize and transaction fee.") from exc
    return str(result["hash"])
