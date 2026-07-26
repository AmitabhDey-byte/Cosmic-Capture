"""Server-side Testnet utility-asset rewards. The issuer secret never reaches the browser."""
from stellar_sdk import Asset, Keypair, Network, Server, TransactionBuilder

from .config import Settings


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
