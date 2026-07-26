import { getAddress, setAllowed } from '@stellar/freighter-api'
import albedo from '@albedo-link/intent'

export type WalletSession = { provider: 'Freighter' | 'Albedo'; address: string }

export async function connectFreighter(): Promise<WalletSession> {
  const permission = await setAllowed()
  if (permission.error || !permission.isAllowed) throw new Error('Freighter permission was not granted.')
  const result = await getAddress()
  if (result.error || !result.address) throw new Error('Freighter did not return an account address.')
  return { provider: 'Freighter', address: result.address }
}

export async function connectAlbedo(): Promise<WalletSession> {
  const result = await albedo.publicKey({ token: `stellar-arena:${crypto.randomUUID()}` })
  if (!result.pubkey) throw new Error('Albedo did not return an account address.')
  return { provider: 'Albedo', address: result.pubkey }
}
