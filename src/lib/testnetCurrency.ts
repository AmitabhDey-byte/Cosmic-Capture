import { Asset, Horizon, Memo, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'
import { signTransaction } from '@stellar/freighter-api'
import albedo from '@albedo-link/intent'
import type { WalletSession } from './wallets'
import type { Powerup } from './powerups'

const assetCode = import.meta.env.VITE_GAME_ASSET_CODE || 'ASTRA'
const issuer = import.meta.env.VITE_GAME_ASSET_ISSUER
const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'
const powerupTreasury = import.meta.env.VITE_POWERUP_TREASURY_ADDRESS

export function configuredAstraAsset() {
  return Boolean(issuer && assetCode)
}

export function configuredPowerupTreasury() {
  return Boolean(powerupTreasury)
}

export async function purchasePowerupWithXlm(wallet: WalletSession, powerup: Powerup) {
  if (!powerupTreasury) throw new Error('Set VITE_POWERUP_TREASURY_ADDRESS before enabling XLM power-up purchases.')
  const amount = powerup.priceXlm.toFixed(7)
  const memo = `SA-PWR:${powerup.id}`
  if (wallet.provider === 'Albedo') {
    const result = await albedo.pay({ amount, destination: powerupTreasury, memo, memo_type: 'text', pubkey: wallet.address, network: 'testnet', submit: true })
    if (!result.tx_hash) throw new Error('Albedo did not return a Testnet payment hash.')
    return result.tx_hash
  }
  const server = new Horizon.Server(horizonUrl)
  const account = await server.loadAccount(wallet.address)
  const transaction = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: powerupTreasury, asset: Asset.native(), amount }))
    .addMemo(Memo.text(memo))
    .setTimeout(60)
    .build()
  const signed = await signTransaction(transaction.toXDR(), { address: wallet.address, networkPassphrase: Networks.TESTNET })
  if (signed.error || !signed.signedTxXdr) throw new Error(signed.error?.message || 'Freighter did not sign the XLM purchase.')
  const submitted = await server.submitTransaction(TransactionBuilder.fromXDR(signed.signedTxXdr, Networks.TESTNET))
  return submitted.hash
}

export async function createAstraTrustline(wallet: WalletSession) {
  if (!issuer) throw new Error('Set VITE_GAME_ASSET_ISSUER before enabling ASTRA rewards.')
  if (wallet.provider === 'Albedo') {
    const result = await albedo.trust({ asset_code: assetCode, asset_issuer: issuer, pubkey: wallet.address, network: 'testnet', submit: true })
    if (!result.tx_hash) throw new Error('Albedo did not return a Testnet transaction hash.')
    return result.tx_hash
  }
  const server = new Horizon.Server(horizonUrl)
  const account = await server.loadAccount(wallet.address)
  const transaction = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: new Asset(assetCode, issuer) }))
    .setTimeout(60)
    .build()
  const signed = await signTransaction(transaction.toXDR(), { address: wallet.address, networkPassphrase: Networks.TESTNET })
  if (signed.error || !signed.signedTxXdr) throw new Error(signed.error?.message || 'Freighter did not sign the ASTRA trustline transaction.')
  const submitted = await server.submitTransaction(TransactionBuilder.fromXDR(signed.signedTxXdr, Networks.TESTNET))
  return submitted.hash
}
