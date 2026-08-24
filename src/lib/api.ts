export const gameApiBase = import.meta.env.VITE_GAME_API_URL?.replace(/\/$/, '') || ''

type PlayerPayload = { walletAddress: string; displayName: string; age?: number; walletProvider: string; avatarKey?: string }

async function post(path: string, data: Record<string, unknown>) {
  const response = await fetch(`${gameApiBase}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; detail?: string } | null
    throw new Error(body?.error || body?.detail || `API request failed: ${response.status}`)
  }
  return response.json()
}

export function persistPlayer(payload: PlayerPayload) {
  return post('/api/players/upsert', payload)
}

export async function fetchPlayerProfile(walletAddress: string): Promise<{ display_name: string; age: number | null; wallet_provider: string } | null> {
  const response = await fetch(`${gameApiBase}/api/players/${walletAddress}`)
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  const payload = await response.json() as { player?: { display_name: string; age: number | null; wallet_provider: string } | null }
  return payload.player || null
}

export async function persistLocalMatch(payload: PlayerPayload & { mode: 'solo' | 'duo' | 'tournament'; cores: number; placement: number; durationSeconds: number; matchRef: string }) {
  return post('/api/matches', payload) as Promise<{ match: { match_ref: string; verified: boolean } }>
}

export async function claimTestnetWinXlm(payload: PlayerPayload & { matchRef: string }) {
  return post('/api/rewards/win-claim', payload) as Promise<{ transactionHash: string; amount: string; assetCode: string; status: string }>
}

export type DuoQueueStatus = { status: 'idle' | 'queued' | 'matched'; lobbyCode?: string; partner?: string }

export function joinDuoQueue(payload: PlayerPayload) {
  return post('/api/duo/join', payload) as Promise<DuoQueueStatus>
}

export async function fetchDuoQueue(walletAddress: string): Promise<DuoQueueStatus> {
  const response = await fetch(`${gameApiBase}/api/duo/${walletAddress}`)
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<DuoQueueStatus>
}

export function leaveDuoQueue(walletAddress: string) {
  return post(`/api/duo/${walletAddress}/leave`, {}) as Promise<DuoQueueStatus>
}

export type AdminDashboard = {
  totals: { players: number; matches: number; powerup_purchases: number; win_payouts: number; xlm_paid: string; active_24h: number }
  recentPlayers: Array<{ wallet_address: string; display_name: string; age: number | null; wallet_provider: string; created_at: string; last_seen_at: string }>
  recentMatches: Array<{ match_ref: string; mode: string; cores: number; placement: number | null; duration_seconds: number; created_at: string; display_name: string; wallet_address: string }>
  purchases: Array<{ powerup_id: string; xlm_amount: string; tx_hash: string; purchased_at: string; display_name: string; wallet_address: string }>
  transactions: Array<{ tx_hash: string; action: string; network: string; status: string; metadata: Record<string, unknown>; created_at: string; confirmed_at: string | null; display_name: string; wallet_address: string }>
  feedback: Array<{ score: number | null; message: string; created_at: string; wallet_address: string | null }>
}

export async function fetchAdminDashboard(token: string): Promise<AdminDashboard> {
  const response = await fetch(`${gameApiBase}/api/admin/overview`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `Admin request failed: ${response.status}`)
  }
  return response.json() as Promise<AdminDashboard>
}

export function persistStellarTransaction(payload: PlayerPayload & { txHash: string; action: string; contractId?: string; status?: string; metadata?: Record<string, unknown> }) {
  return post('/api/transactions', { ...payload, network: 'testnet', status: 'confirmed', ...payload })
}

export function verifyPowerupPurchase(payload: PlayerPayload & { txHash: string; powerupId: string }) {
  return post('/api/powerups/verify', { ...payload, txHash: payload.txHash, powerupId: payload.powerupId })
}

export async function fetchOwnedPowerups(walletAddress: string): Promise<string[]> {
  const response = await fetch(`${gameApiBase}/api/powerups/${walletAddress}`)
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  const payload = await response.json() as { powerups?: { powerup_id?: string }[] }
  return payload.powerups?.map((powerup) => powerup.powerup_id).filter((id): id is string => Boolean(id)) || []
}

export type LeaderboardEntry = {
  display_name: string
  avatar_key: string
  cores: number
  matches: number
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await fetch(gameApiBase + '/api/leaderboard')
  if (!response.ok) throw new Error('Leaderboard request failed: ' + response.status)
  const payload = await response.json() as { leaderboard?: LeaderboardEntry[] }
  return payload.leaderboard || []
}
