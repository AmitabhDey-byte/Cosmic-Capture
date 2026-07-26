const base = import.meta.env.VITE_GAME_API_URL?.replace(/\/$/, '')

type PlayerPayload = { walletAddress: string; displayName: string; walletProvider: string; avatarKey?: string }

async function post(path: string, data: Record<string, unknown>) {
  if (!base) return null
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json()
}

export function persistPlayer(payload: PlayerPayload) {
  return post('/api/players/upsert', payload)
}

export function persistLocalMatch(payload: PlayerPayload & { cores: number; durationSeconds: number }) {
  return post('/api/matches', { ...payload, mode: 'solo', cores: payload.cores, durationSeconds: payload.durationSeconds, matchRef: `practice-${payload.walletAddress}-${Date.now()}` })
}

export function persistStellarTransaction(payload: PlayerPayload & { txHash: string; action: string; contractId?: string; status?: string; metadata?: Record<string, unknown> }) {
  return post('/api/transactions', { ...payload, network: 'testnet', status: 'confirmed', ...payload })
}

export function verifyPowerupPurchase(payload: PlayerPayload & { txHash: string; powerupId: string }) {
  return post('/api/powerups/verify', { ...payload, txHash: payload.txHash, powerupId: payload.powerupId })
}

export async function fetchOwnedPowerups(walletAddress: string): Promise<string[]> {
  if (!base) return []
  const response = await fetch(`${base}/api/powerups/${walletAddress}`)
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  const payload = await response.json() as { powerups?: { powerup_id?: string }[] }
  return payload.powerups?.map((powerup) => powerup.powerup_id).filter((id): id is string => Boolean(id)) || []
}
