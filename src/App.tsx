import { createElement, lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Bolt, Bot, ChevronRight, Crown, Crosshair, Gamepad2, Gem,
  Heart, Home, LockKeyhole, Medal, Menu,
  Orbit, PanelTop, Play, Radar, Rocket, Shield, ShoppingBag, Sparkles,
  Swords, Target, Trophy, Users, Wallet, X, Zap,
} from 'lucide-react'
import { connectAlbedo, connectFreighter, type WalletSession } from './lib/wallets'
import { fetchOwnedPowerups, persistLocalMatch, persistPlayer, persistStellarTransaction, verifyPowerupPurchase } from './lib/api'
import { track } from './lib/observability'
import type { ArenaRun } from './game/StellarArena'
import { configuredAstraAsset, configuredPowerupTreasury, createAstraTrustline, purchasePowerupWithXlm } from './lib/testnetCurrency'
import { powerupById, powerups, type Powerup, type PowerupId } from './lib/powerups'
import './App.css'

const StellarArena = lazy(() => import('./game/StellarArena').then(({ StellarArena: Arena }) => ({ default: Arena })))
const ArcadeLounge = lazy(() => import('./game/ArcadeLounge').then(({ ArcadeLounge: Lounge }) => ({ default: Lounge })))

type Page = 'home' | 'play' | 'missions' | 'hangar' | 'store' | 'crew' | 'arcade' | 'leaderboard' | 'profile' | 'lore'
type Mode = 'Solo' | 'Duo' | 'Tournament'
type TacticalDirective = { text: string; coreGoal: number; bonusShards: number; poweredByGemini: boolean }
type ArenaPosition = { x: number; y: number }

const nav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'play', label: 'Play', icon: Play },
  { id: 'missions', label: 'Quests', icon: Target },
  { id: 'hangar', label: 'Hangar', icon: Rocket },
  { id: 'store', label: 'Store', icon: ShoppingBag },
  { id: 'crew', label: 'Crew', icon: Users },
  { id: 'arcade', label: 'Arcade', icon: Gamepad2 },
  { id: 'lore', label: 'Lore', icon: PanelTop },
  { id: 'leaderboard', label: 'Rankings', icon: Trophy },
  { id: 'profile', label: 'Profile', icon: Users },
]

const modes: { name: Mode; players: string; note: string; color: string }[] = [
  { name: 'Solo', players: '4–8 pilots', note: 'Every core for yourself.', color: 'cyan' },
  { name: 'Duo', players: '4 teams', note: 'Sync, flank, survive.', color: 'pink' },
  { name: 'Tournament', players: 'Season 01', note: 'Climb the Neon Cup.', color: 'gold' },
]

const abilities = [
  { name: 'Aegis Bloom', icon: Shield, cool: '14s', copy: 'A star-petal shield that absorbs the next impact.', color: 'cyan' },
  { name: 'Blink Shift', icon: Zap, cool: '11s', copy: 'Teleport through a rift and leave a false trail.', color: 'pink' },
  { name: 'EMP Bloom', icon: Radar, cool: '18s', copy: 'Silence enemy gadgets in a solar shockwave.', color: 'gold' },
]

const rankings = [
  ['NOVA KITSUNE', '12,840', '47 WINS', 'N'],
  ['KIRA BYTE', '12,220', '44 WINS', 'K'],
  ['POLARIS', '11,960', '42 WINS', 'P'],
  ['YOU / SORA', '11,340', '39 WINS', 'S'],
  ['MISO COMET', '10,880', '36 WINS', 'M'],
]

const chapterCards = [
  { no: '00', title: 'THE STAR THAT FELL', text: 'A borrowed ship. A blue core. The arena calls.', scene: 'scene-fuji', tag: 'START HERE' },
  { no: '01', title: 'NEON OSAKA ORBIT', text: 'The rooftops glow. Rival squads already wait.', scene: 'scene-city', tag: 'UNLOCKED' },
  { no: '02', title: 'FROSTLINE FRONTIER', text: 'The storm goes silent before every final circle.', scene: 'scene-snow', tag: 'UNLOCKED' },
]

const chapterStories = [
  { label: 'CHAPTER 00', title: 'The Star That Fell', scene: 'scene-fuji', pages: [
    ['The shrine lanterns froze.', 'Sora only meant to fix a borrowed interceptor before sunrise. Then a blue core split the clouds and landed softly between the snow-lanterns.'],
    ['A signal in the light.', 'The core projected a fox-shaped star map. At its center: an arena gate, an invitation, and one blinking word — FLY.'],
    ['Kira arrives with snacks.', '“Good news,” Kira said, appearing in a cloud of pink pixels. “You are either chosen by destiny or extremely lost. Both are fixable.”'],
  ] },
  { label: 'CHAPTER 01', title: 'Neon Osaka Orbit', scene: 'scene-city', pages: [
    ['The city was already awake.', 'Sky-rails hummed above Osaka Orbit while pilots chased drifting Cores between shrine gates and rooftop gardens.'],
    ['First rule of the arena.', 'Take the Core if you can. Cover someone if you cannot. The scoreboard remembers points; your crew remembers the save.'],
    ['A rival sends a signal.', 'A magenta interceptor cut through the rain. Its pilot saluted, then stole a Core with a perfect blink. Sora grinned. Finally, a challenge.'],
  ] },
  { label: 'CHAPTER 02', title: 'Frostline Frontier', scene: 'scene-snow', pages: [
    ['The final circle narrows.', 'Mount Fuji glowed beneath the frost storm. Every engine sounded louder when the safe sky became small.'],
    ['A shield shared is stronger.', 'Sora raised the Aegis Bloom just as Kira’s decoy broke apart. The blast missed them both by a breath.'],
    ['The sky keeps calling.', 'At extraction, the Core hummed again. There would be another gate tomorrow — and another small, daring reason to fly.'],
  ] },
]

function App() {
  const [page, setPage] = useState<Page>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [walletModal, setWalletModal] = useState(false)
  const [wallet, setWallet] = useState<WalletSession | null>(null)
  const [displayName, setDisplayName] = useState('Sora Skyline')
  const [connecting, setConnecting] = useState<'freighter' | 'albedo' | null>(null)
  const [notice, setNotice] = useState('')
  const [selectedMode, setSelectedMode] = useState<Mode>('Solo')
  const [selectedAbility, setSelectedAbility] = useState(0)
  const [geminiOpen, setGeminiOpen] = useState(false)
  const [geminiReply, setGeminiReply] = useState('')
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [directive, setDirective] = useState<TacticalDirective | null>(null)
  const [directiveLoading, setDirectiveLoading] = useState(false)
  const [openChapter, setOpenChapter] = useState<number | null>(null)
  const [ownedPowerups, setOwnedPowerups] = useState<PowerupId[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('stellar-arena-powerups') || '[]') as string[]
      return saved.filter((id): id is PowerupId => Boolean(powerupById(id as PowerupId)))
    } catch { return [] }
  })
  const [purchasingPowerup, setPurchasingPowerup] = useState<PowerupId | null>(null)
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null))
  const [turn, setTurn] = useState<'X' | 'O'>('X')

  const matchScore = useMemo(() => board.filter(Boolean).length, [board])

  useEffect(() => { track('arena_opened') }, [])
  useEffect(() => { window.localStorage.setItem('stellar-arena-powerups', JSON.stringify(ownedPowerups)) }, [ownedPowerups])
  useEffect(() => {
    const openChapterFromCard = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.chapter-card button')
      if (!button) return
      const label = button.closest('.chapter-card')?.querySelector('span')?.textContent
      const index = label?.match(/(\d+)/)?.[1]
      if (index) setOpenChapter(Number(index))
    }
    document.addEventListener('click', openChapterFromCard)
    return () => document.removeEventListener('click', openChapterFromCard)
  }, [])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3600)
  }

  const go = (next: Page) => {
    setPage(next)
    track('page_view', { page: next })
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const connect = async (kind: 'freighter' | 'albedo') => {
    setConnecting(kind)
    try {
      const session = kind === 'freighter' ? await connectFreighter() : await connectAlbedo()
      setWallet(session)
      track('wallet_connected', { provider: session.provider })
      void persistPlayer({ walletAddress: session.address, walletProvider: session.provider, displayName, avatarKey: 'kira-pixel' }).catch(() => track('api_sync_failed', { event: 'player_upsert' }))
      void fetchOwnedPowerups(session.address)
        .then((ids) => setOwnedPowerups(ids.filter((id): id is PowerupId => Boolean(powerupById(id as PowerupId)))))
        .catch(() => track('api_sync_failed', { event: 'powerup_restore' }))
      setWalletModal(false)
      showNotice(`${session.provider} connected — identity verified on Stellar Testnet.`)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Wallet connection was cancelled.')
    } finally {
      setConnecting(null)
    }
  }

  const savePilotIdentity = () => {
    if (!wallet) return setWalletModal(true)
    void persistPlayer({ walletAddress: wallet.address, walletProvider: wallet.provider, displayName, avatarKey: 'kira-pixel' })
      .then(() => showNotice('Pilot identity saved to the arena registry.'))
      .catch(() => showNotice('Could not reach the registry. Your name stays local until the API is online.'))
  }

  const recordArenaRun = (run: ArenaRun) => {
    track('arena_run_completed', { cores: run.cores, shards: run.shards, score: run.score, mode: selectedMode })
    if (wallet) {
      void persistLocalMatch({ walletAddress: wallet.address, walletProvider: wallet.provider, displayName, avatarKey: 'kira-guide-v2', cores: run.cores, durationSeconds: run.durationSeconds })
        .then(() => showNotice(`Run saved: ${run.cores} cores and ${run.shards} Astra queued for verification.`))
        .catch(() => showNotice(`Run complete: ${run.cores} cores secured locally. API sync will retry when online.`))
    } else {
      showNotice(`Run complete: ${run.cores} cores secured. Connect a wallet to queue Testnet rewards.`)
    }
  }

  const enableAstraRewards = async () => {
    if (!wallet) return setWalletModal(true)
    try {
      const txHash = await createAstraTrustline(wallet)
      await persistStellarTransaction({ walletAddress: wallet.address, walletProvider: wallet.provider, displayName, avatarKey: 'kira-guide-v2', txHash, action: 'astra_trustline', metadata: { asset: import.meta.env.VITE_GAME_ASSET_CODE || 'ASTRA' } })
      showNotice('ASTRA trustline confirmed on Stellar Testnet. Verified rewards can now settle to your wallet.')
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'ASTRA trustline could not be created.')
    }
  }

  const buyPowerup = async (powerup: Powerup) => {
    if (!wallet) return setWalletModal(true)
    if (!configuredPowerupTreasury()) return showNotice('Set VITE_POWERUP_TREASURY_ADDRESS before opening XLM checkout.')
    if (!import.meta.env.VITE_GAME_API_URL) return showNotice('Set VITE_GAME_API_URL so the FastAPI verifier can unlock your purchase.')
    if (ownedPowerups.includes(powerup.id)) return showNotice(`${powerup.name} is already equipped.`)
    setPurchasingPowerup(powerup.id)
    try {
      const txHash = await purchasePowerupWithXlm(wallet, powerup)
      await verifyPowerupPurchase({ walletAddress: wallet.address, walletProvider: wallet.provider, displayName, avatarKey: 'kira-guide-v2', txHash, powerupId: powerup.id })
      setOwnedPowerups((current) => current.includes(powerup.id) ? current : [...current, powerup.id])
      track('powerup_purchased', { powerup: powerup.id, xlm: powerup.priceXlm, provider: wallet.provider })
      showNotice(`${powerup.name} equipped — XLM payment verified on Stellar Testnet.`)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'XLM checkout was cancelled.')
    } finally {
      setPurchasingPowerup(null)
    }
  }

  const playCell = (index: number) => {
    if (board[index]) return
    const next = [...board]
    next[index] = turn
    setBoard(next)
    setTurn(turn === 'X' ? 'O' : 'X')
  }

  const askKira = async (prompt: string) => {
    const responses: Record<string, string> = {
      route: 'Take the upper nebula lane. Two cores spawn behind the broken shrine at 02:10.',
      build: 'For Solo, equip Aegis Bloom + Blink Shift. Keep EMP for the final circle.',
      lore: 'The first Stellar Core was caught in a paper lantern above old Kyoto orbit. Cute, right?',
    }
    setGeminiLoading(true)
    try {
      const apiBase = import.meta.env.VITE_GAME_API_URL
      if (!apiBase) throw new Error('Local guide mode')
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/kira`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }),
      })
      if (!response.ok) throw new Error('Guide service unavailable')
      const payload = await response.json() as { reply?: string }
      setGeminiReply(payload.reply || responses[prompt])
      track('kira_prompted', { prompt, powered: 'gemini' })
    } catch {
      setGeminiReply(responses[prompt])
      track('kira_prompted', { prompt, powered: 'fallback' })
    } finally {
      setGeminiLoading(false)
    }
  }

  const generateMissionDirective = async () => {
    const coreGoal = selectedMode === 'Tournament' ? 10 : selectedMode === 'Duo' ? 8 : 6
    const bonusShards = selectedMode === 'Tournament' ? 40 : selectedMode === 'Duo' ? 30 : 24
    const fallback = `Kira directive: sweep the lantern arc, save ${abilities[selectedAbility].name} for pressure, then secure ${coreGoal} cores before extraction.`
    setDirectiveLoading(true)
    try {
      const apiBase = import.meta.env.VITE_GAME_API_URL
      if (!apiBase) throw new Error('Offline briefing')
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/kira`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'briefing', mode: selectedMode, ability: abilities[selectedAbility].name }),
      })
      if (!response.ok) throw new Error('Briefing unavailable')
      const payload = await response.json() as { reply?: string }
      setDirective({ text: payload.reply || fallback, coreGoal, bonusShards, poweredByGemini: true })
      track('kira_directive_generated', { mode: selectedMode, ability: abilities[selectedAbility].name, powered: 'gemini' })
    } catch {
      setDirective({ text: fallback, coreGoal, bonusShards, poweredByGemini: false })
      track('kira_directive_generated', { mode: selectedMode, ability: abilities[selectedAbility].name, powered: 'fallback' })
    } finally {
      setDirectiveLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="grain" />
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="Stellar Arena home">
          <span className="brand-mark"><Orbit size={24} /><i /></span>
          <span><b>STELLAR</b><em>ARENA</em></span>
        </button>
        <nav className="desktop-nav" aria-label="Main navigation">
          {nav.slice(1, 7).map(({ id, label }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}>{label}</button>)}
        </nav>
        <div className="top-actions">
          <button className="pill gem-pill" onClick={() => setGeminiOpen(true)}><Sparkles size={15} /> Kira AI</button>
          <button className="wallet-chip" onClick={() => setWalletModal(true)}><Wallet size={16} /> {wallet ? shortKey(wallet.address) : 'Connect'}</button>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      {menuOpen && <aside className="mobile-drawer">
        {nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}><Icon size={18} /> {label}</button>)}
      </aside>}

      <main>
        {page === 'home' && <HomePage go={go} setWalletModal={setWalletModal} />}
        {page === 'play' && <RealPlayPage selectedMode={selectedMode} setSelectedMode={setSelectedMode} selectedAbility={selectedAbility} setSelectedAbility={setSelectedAbility} wallet={wallet} equippedPowerups={ownedPowerups} onEnableAstra={enableAstraRewards} onComplete={recordArenaRun} directive={directive} directiveLoading={directiveLoading} onGenerateDirective={generateMissionDirective} />}
        {page === 'missions' && <MissionPage showNotice={showNotice} />}
        {page === 'hangar' && <HangarPage showNotice={showNotice} />}
        {page === 'store' && <StorePage wallet={wallet} ownedPowerups={ownedPowerups} purchasingPowerup={purchasingPowerup} onBuy={buyPowerup} setWalletModal={setWalletModal} />}
        {page === 'crew' && <CrewPage go={go} showNotice={showNotice} />}
        {page === 'arcade' && <ArcadePage />}
        {page === 'leaderboard' && <LeaderboardPage />}
        {page === 'profile' && <ProfilePage wallet={wallet} setWalletModal={setWalletModal} showNotice={showNotice} displayName={displayName} setDisplayName={setDisplayName} savePilotIdentity={savePilotIdentity} />}
        {page === 'lore' && <LorePage go={go} />}
      </main>
      {openChapter !== null && <ChapterReaderModal chapter={chapterStories[openChapter]} close={() => setOpenChapter(null)} />}

      <footer className="footer">
        <div className="footer-logo"><Orbit size={17} /> STELLAR ARENA</div>
        <span>Built for Stellar Testnet · Gameplay remains off-chain for speed.</span>
        <button onClick={() => go('lore')}>Read the prologue <ChevronRight size={15} /></button>
      </footer>

      <Kira geminiOpen={geminiOpen} setGeminiOpen={setGeminiOpen} geminiReply={geminiReply} geminiLoading={geminiLoading} askKira={askKira} />
      {walletModal && <WalletModal close={() => setWalletModal(false)} connect={connect} connecting={connecting} />}
      {notice && <div className="toast"><Sparkles size={17} /> {notice}</div>}

      <section className="mini-panel">
        <button className="mini-toggle" onClick={() => showNotice('Arcade lounge unlocked — Tic-Tac-Toe is ready!')}><Gamepad2 size={16} /> ARCADE</button>
        <div className="tiny-board" aria-label="Tic Tac Toe mini game">
          <div><span>NEBULA NINES</span><button onClick={() => { setBoard(Array(9).fill(null)); setTurn('X') }}>reset</button></div>
          <div className="board-grid">{board.map((cell, i) => <button key={i} onClick={() => playCell(i)}>{cell}</button>)}</div>
          <small>{matchScore === 9 ? 'Board full — reset for another orbit.' : `${turn}'s turn · earn a badge after 3 wins`}</small>
        </div>
      </section>
    </div>
  )
}

function HomePage({ go, setWalletModal }: { go: (page: Page) => void; setWalletModal: (value: boolean) => void }) {
  return <>
    <section className="hero-section">
      <div className="hero-bg" />
      <div className="hero-lines" />
      <div className="hero-copy">
        <div className="eyebrow"><span /> SEASON 01 · LIVE ON TESTNET</div>
        <h1><small>CAPTURE THE LIGHT.</small><span>OWN THE</span> <strong>ARENA.</strong></h1>
        <p>A fast, friendly space brawler where skill wins the stardust. Grab Stellar Cores, outsmart rivals, and make it home before the void closes.</p>
        <div className="hero-cta"><button className="primary-btn" onClick={() => go('play')}><Play fill="currentColor" size={17} /> Enter arena</button><button className="comic-btn" onClick={() => go('lore')}><PanelTop size={17} /> Read prologue</button></div>
        <div className="hero-proof"><span><Users /> 1,284 pilots online</span><span><Zap /> 3–5 minute matches</span><span><LockKeyhole /> Stellar-secure identity</span></div>
      </div>
      <div className="hero-card floating-card">
        <div className="card-tab">NEXT EVENT</div><span className="date">SAT · 19:00 UTC</span><b>THE NEON CUP</b><p>Top 32 pilots battle for the Comet Crest.</p><button onClick={() => setWalletModal(true)}>Register with wallet <ChevronRight size={15} /></button>
      </div>
      <div className="floating-core core-one"><Gem fill="currentColor" /></div><div className="floating-core core-two"><Gem fill="currentColor" /></div>
    </section>
    <section className="stat-strip">
      <div><b>06</b><span>abilities to master</span></div><div><b>08</b><span>pilots per arena</span></div><div><b>01</b><span>living galaxy</span></div><div><b>∞</b><span>cosmic stories</span></div>
    </section>
    <section className="section-wrap play-modes">
      <SectionHeading kicker="CHOOSE YOUR STORY" title="A match for every kind of pilot." side="No pay-to-win. Only good plays." />
      <div className="mode-grid">{modes.map((mode, i) => <article key={mode.name} className={`mode-card mode-${mode.color}`}><span className="issue">MODE 0{i + 1}</span><div className="mode-icon">{i === 0 ? <Crosshair /> : i === 1 ? <Users /> : <Crown />}</div><h3>{mode.name}</h3><p>{mode.note}</p><b>{mode.players}</b><button onClick={() => go('play')}>Play {mode.name} <ChevronRight size={15} /></button></article>)}</div>
    </section>
    <section className="world-section">
      <div className="world-copy"><span className="eyebrow"><span /> MADE FOR MOMENTS</span><h2>Every arena is a <i>postcard from another orbit.</i></h2><p>Rocket through neon city roofs, catch falling light above shrine valleys, and survive the snow-swept edge of Mount Fuji.</p><button className="text-btn" onClick={() => go('lore')}>Explore the galaxy <ChevronRight size={16} /></button></div>
      <div className="scene-stack"><div className="scene scene-fuji"><span>ORBITAL KYOTO</span></div><div className="scene scene-city"><span>NEON OSAKA</span></div><div className="scene scene-snow"><span>FROSTLINE</span></div></div>
    </section>
    <section className="section-wrap roadmap-row"><div className="roadmap-message"><div className="kira-portrait">K</div><div><span>KIRA / ARENA GUIDE</span><p>“Psst… there’s a hidden quest in every zone. Start by looking where the lanterns point.”</p></div></div><div className="chain-box"><span><Gem size={17} /> ON-CHAIN, ON PURPOSE</span><p>Wallet identity, seasonal results, badges and owned cosmetics settle with Soroban. Every movement stays in the game for crisp play.</p></div></section>
  </>
}

function PlayPage({ selectedMode, setSelectedMode, selectedAbility, setSelectedAbility, beginQueue, startSoloPractice, queueing, inMatch, matchFinished, matchTime, matchCores, playerPosition, corePosition, abilityActive, movePilot, useAbility, setInMatch }: { selectedMode: Mode; setSelectedMode: (mode: Mode) => void; selectedAbility: number; setSelectedAbility: (a: number) => void; beginQueue: () => void; startSoloPractice: () => void; queueing: boolean; inMatch: boolean; matchFinished: boolean; matchTime: number; matchCores: number; playerPosition: ArenaPosition; corePosition: ArenaPosition; abilityActive: boolean; movePilot: (x: number, y: number) => void; useAbility: () => void; setInMatch: (n: boolean) => void }) {
  const AbilityIcon = abilities[selectedAbility].icon
  const clock = `${String(Math.floor(matchTime / 60)).padStart(2, '0')}:${String(matchTime % 60).padStart(2, '0')}`
  return <section className="play-page section-wrap">
    <div className="page-intro"><span className="eyebrow"><span /> COMMAND DECK</span><h1>Pick a mode.<br /><i>Make a moment.</i></h1><p>Solo Practice is fully local: launch and play with zero wallet, account, API key, or backend setup.</p></div>
    <div className="play-layout">
      <section className="loadout-panel comic-panel">
        <div className="panel-label">01 / QUEUE TYPE</div><div className="mode-select">{modes.map(mode => <button key={mode.name} onClick={() => setSelectedMode(mode.name)} className={selectedMode === mode.name ? 'selected' : ''}><span>{mode.name === 'Solo' ? <Crosshair /> : mode.name === 'Duo' ? <Users /> : <Trophy />}</span><b>{mode.name}</b><small>{mode.players}</small></button>)}</div>
        <div className="panel-label">02 / SIGNATURE KIT</div><div className="ability-list">{abilities.map((ability, i) => { const Icon = ability.icon; return <button className={selectedAbility === i ? 'selected' : ''} key={ability.name} onClick={() => setSelectedAbility(i)}><span className={`ability-orb ${ability.color}`}><Icon size={18} /></span><span><b>{ability.name}</b><small>{ability.copy}</small></span><em>{ability.cool}</em></button> })}</div>
      </section>
      <section className="arena-preview">
        <div className="arena-hud"><span>ARENA // NEON OSAKA</span><b>{inMatch ? clock : '01:30'}</b><span>{inMatch ? `${matchCores} CORES SECURED` : 'LOCAL PRACTICE READY'}</span></div>
        <div className={`arena-map ${abilityActive ? 'ability-flash' : ''}`}><div className="map-grid" /><div className="storm-ring outer" /><div className="storm-ring inner" /><div className="player-ship" style={{ left: `${playerPosition.x}%`, top: `${playerPosition.y}%` }}><Rocket size={25} /></div><div className="core-dot local-core" style={{ left: `${corePosition.x}%`, top: `${corePosition.y}%` }}><Gem size={13} fill="currentColor" /></div><div className="enemy e1">N</div><div className="enemy e2">K</div><div className="enemy e3">P</div><div className="active-ability"><AbilityIcon size={18} /><span>{abilities[selectedAbility].name}</span></div></div>
        {inMatch && <div className="practice-deck"><div className="practice-status"><span className="live-dot" /> SOLO PRACTICE <b>{matchCores} CORES</b><button onClick={() => setInMatch(false)}>End run</button></div><div className="pilot-controls" aria-label="Pilot movement controls"><button onClick={() => movePilot(0, -10)} aria-label="Move up">UP</button><button onClick={() => movePilot(-10, 0)} aria-label="Move left">LEFT</button><button className="ability-trigger" onClick={useAbility} disabled={abilityActive}><AbilityIcon size={15} /> Use ability</button><button onClick={() => movePilot(10, 0)} aria-label="Move right">RIGHT</button><button onClick={() => movePilot(0, 10)} aria-label="Move down">DOWN</button></div></div>}
        {!inMatch && matchFinished && <div className="practice-result"><span>CORE RUN COMPLETE</span><b>{matchCores}</b><p>Stellar Cores secured in your 90-second local practice.</p><button className="queue-btn" onClick={startSoloPractice}>Play again <ChevronRight size={17} /></button></div>}
        {!inMatch && !matchFinished && selectedMode === 'Solo' && <button className="solo-practice-btn" onClick={startSoloPractice}><Play size={16} fill="currentColor" /> Launch Solo Practice — no wallet needed</button>}
        {inMatch ? <div className="match-actions"><span className="live-dot" /> LIVE MATCH · 5 CORES · PLACE 2/8 <button onClick={() => setInMatch(false)}>Leave simulation</button></div> : <button className="queue-btn" onClick={beginQueue} disabled={queueing}>{queueing ? 'FINDING PILOTS…' : `QUEUE FOR ${selectedMode.toUpperCase()}`} <ChevronRight size={17} /></button>}
      </section>
    </div>
    <div className="quick-rules"><b>QUICK READ</b><span><Gem /> Collect cores</span><span><Swords /> Outsmart rivals</span><span><Shield /> Survive the circle</span><span><Medal /> Seal your result</span></div>
  </section>
}

void PlayPage

function RealPlayPage({ selectedMode, setSelectedMode, selectedAbility, setSelectedAbility, wallet, equippedPowerups, onEnableAstra, onComplete, directive, directiveLoading, onGenerateDirective }: { selectedMode: Mode; setSelectedMode: (mode: Mode) => void; selectedAbility: number; setSelectedAbility: (ability: number) => void; wallet: WalletSession | null; equippedPowerups: PowerupId[]; onEnableAstra: () => void; onComplete: (run: ArenaRun) => void; directive: TacticalDirective | null; directiveLoading: boolean; onGenerateDirective: () => void }) {
  return <section className="real-play-page section-wrap">
    <div className="game-page-intro"><div><span className="eyebrow"><span /> ACTUAL PLAYABLE ARENA</span><h1>Fly the run.<br /><i>Own the sky.</i></h1><p>This is a real Canvas game loop: fly with keyboard or touch, aim and fire directly, capture Stellar Cores, and outscore rival scouts before the 90-second extraction.</p></div><div className="engine-badge"><Bolt size={20} /><span>CANVAS COMBAT ENGINE</span><b>90 SECOND RUN</b></div></div>
    <div className="game-loadout comic-panel"><div><span>MODE</span>{modes.map(mode => <button key={mode.name} className={selectedMode === mode.name ? 'selected' : ''} onClick={() => setSelectedMode(mode.name)}><b>{mode.name}</b><small>{mode.note}</small></button>)}</div><div><span>ACTIVE ABILITY</span>{abilities.map((ability, index) => { const Icon = ability.icon; return <button key={ability.name} className={selectedAbility === index ? 'selected' : ''} onClick={() => setSelectedAbility(index)}><Icon size={16} /><b>{ability.name}</b><small>{ability.cool}</small></button> })}</div><aside><Sparkles size={18} /><b>{wallet ? (configuredAstraAsset() ? 'ASTRA TESTNET READY' : 'PILOT LINKED / ASSET SETUP NEEDED') : 'GUEST LAUNCH MODE'}</b><p>{wallet ? 'Create your ASTRA trustline once, then verified arena results can settle as a real Stellar Testnet utility asset.' : 'You can play immediately. Connect Freighter or Albedo before enabling Testnet rewards.'}</p>{wallet && <button className="astra-button" onClick={onEnableAstra}>{configuredAstraAsset() ? 'Enable ASTRA rewards' : 'Configure ASTRA issuer'}</button>}</aside></div>
    <section className={`director-card comic-panel ${directive ? 'has-directive' : ''}`}><div className="director-portrait" /><div><span><Sparkles size={13} /> KIRA / GEMINI GAME DIRECTOR</span><h3>{directive ? 'Live flight contract locked.' : 'Draft a smarter flight plan.'}</h3><p>{directive ? directive.text : 'Kira reads your selected kit and writes a tactical route before launch. The contract becomes a real bonus objective in your arena run.'}</p>{directive && <div className="director-contract"><b>{directive.coreGoal} CORE CONTRACT</b><em>+{directive.bonusShards} ASTRA BONUS</em><small>{directive.poweredByGemini ? 'Generated by your secure Gemini service' : 'Offline tactical fallback'}</small></div>}</div><button onClick={onGenerateDirective} disabled={directiveLoading}>{directiveLoading ? 'KIRA IS PLOTTING…' : directive ? 'Reroll flight plan' : 'Generate flight plan'}</button></section>
    {equippedPowerups.length > 0 && <div className="equipped-powerups" aria-label="Equipped power-ups"><span><ShoppingBag size={15} /> XLM MODULES EQUIPPED</span>{equippedPowerups.map(id => <b key={id}>{powerupById(id)?.name}</b>)}</div>}
    <Suspense fallback={<GameSurfaceLoading label="Preparing the arena" />}>
      <StellarArena mode={selectedMode === 'Duo' ? 'duo' : 'solo'} walletConnected={!!wallet} equippedPowerups={equippedPowerups} directive={directive} onComplete={onComplete} />
    </Suspense>
  </section>
}

function MissionPage({ showNotice }: { showNotice: (s: string) => void }) {
  const quests = [
    ['LANTERN RUN', 'Collect 15 Stellar Cores in any mode.', '12 / 15', '100 XP'],
    ['SILENT COMET', 'Win a match without using an EMP.', '1 / 1', 'COMPLETED'],
    ['TOKYO DRIFT', 'Blink through three rifts in one match.', '0 / 3', '75 XP'],
    ['KITSUNE SIGNAL', 'Follow the fox constellation above the shrine.', '1 / 1', 'UNLOCKED'],
  ]
  return <section className="missions-page section-wrap"><div className="page-intro"><span className="eyebrow"><span /> KIRA'S NOTEBOOK</span><h1>Little adventures.<br /><i>Big constellations.</i></h1><p>Every quest, secret, and seasonal objective is open for the showcase build.</p></div><div className="all-access-banner"><Sparkles size={17} /><span>ALL ACCESS ONLINE</span><p>Every quest path is unlocked for your arena showcase.</p></div><div className="quest-layout"><div className="quest-list">{quests.map(([name, text, progress, reward], i) => <article className="quest-card" key={name}><span className="quest-number">0{i + 1}</span><div><h3>{name}</h3><p>{text}</p><div className="quest-progress"><i style={{ width: `${i === 0 ? 80 : i === 1 || i === 3 ? 100 : 18}%` }} /></div><small>{progress}</small></div><button onClick={() => showNotice(i === 1 || i === 3 ? 'Reward added to your showcase inventory.' : 'Quest pinned to your flight log.')}>{reward}</button></article>)}</div><aside className="comic-tips"><div className="tip-sticker">KIRA TIP!</div><div className="waifu-mini"><span>✦</span></div><h3>Some secrets only appear after midnight.</h3><p>Follow lanterns, listen for a chime, and never ignore a suspiciously friendly asteroid.</p><button onClick={() => showNotice('Hint saved: Explore the Kyoto arena after your first win.')}>Pin secret hint</button></aside></div></section>
}

function HangarPage({ showNotice }: { showNotice: (s: string) => void }) {
  const ships = [{ name: 'SORA-01', trait: 'Balanced interceptor', color: 'cyan', owned: true }, { name: 'KITSUNE MK-II', trait: 'Decoy specialist', color: 'pink', owned: true }, { name: 'FUJI GLIDER', trait: 'Shield architect', color: 'gold', owned: true }]
  return <section className="hangar-page section-wrap">
    <div className="page-intro"><span className="eyebrow"><span /> COSMETIC WORKSHOP</span><h1>Make your ship<br /><i>your signature.</i></h1><p>Everything is open in the showcase build. Cosmetics remain visual-only and can be registered as Soroban collectibles.</p></div>
    <div className="all-access-banner"><Sparkles size={17} /><span>FULL HANGAR UNLOCKED</span><p>All three signature ships are ready to equip.</p></div>
    <HoloDock />
    <div className="ship-grid">{ships.map((ship, i) => <article className={`ship-card ship-${ship.color}`} key={ship.name}><div className="ship-card-top"><span>HULL 0{i + 1}</span>{ship.owned && <b>OWNED</b>}</div><div className="ship-model"><Rocket size={76} /><i /></div><h3>{ship.name}</h3><p>{ship.trait}</p><div className="ship-actions"><button onClick={() => showNotice(`${ship.name} equipped. Ready for launch.`)}>Equip</button><button className="icon-btn" onClick={() => showNotice('Add a GLB link to VITE_HANGAR_MODEL_URL to activate the interactive 3D ship viewer.')}><Orbit size={17} /></button></div></article>)}</div>
    <div className="inventory-strip"><span><ShoppingBag /> INVENTORY</span><b>36 cosmetic pieces</b><small>All ships, trails, and emotes unlocked</small><button onClick={() => showNotice('Everything is already equipped for the showcase.')}>View inventory</button></div>
  </section>
}

function HoloDock() {
  const modelUrl = import.meta.env.VITE_HANGAR_MODEL_URL
  const [modelReady, setModelReady] = useState(false)
  useEffect(() => {
    if (!modelUrl) return
    let live = true
    void import('@google/model-viewer').then(({ ModelViewerElement }) => {
      if (live && customElements.get('model-viewer') === ModelViewerElement) setModelReady(true)
    })
    return () => { live = false }
  }, [modelUrl])
  return <section className="holo-dock comic-panel">
    <div className="holo-model">
      {modelUrl && modelReady
        ? createElement('model-viewer', { src: modelUrl, alt: 'Interactive Stellar Arena spacecraft', 'camera-controls': true, 'auto-rotate': true, 'shadow-intensity': '1', 'interaction-prompt': 'auto', 'aria-label': 'Interactive 3D Sora-01 ship model' })
        : <div className="holo-placeholder"><Rocket size={72} /><span>{modelUrl ? 'LOADING 3D SHIP' : '3D DOCK ONLINE'}</span></div>}
    </div>
    <div className="holo-copy"><span>TO3D / HOLOGRAPHIC BAY</span><h2>Spin the SORA-01.</h2><p>{modelUrl ? 'Drag to inspect the hull, scroll to zoom, and use this asset in the live hangar.' : 'The interactive viewer is ready. Generate or upload a GLB through To3D, then add its public URL to VITE_HANGAR_MODEL_URL.'}</p><small>MODEL VIEWER · MOBILE TOUCH CONTROLS</small></div>
  </section>
}

function StorePage({ wallet, ownedPowerups, purchasingPowerup, onBuy, setWalletModal }: { wallet: WalletSession | null; ownedPowerups: PowerupId[]; purchasingPowerup: PowerupId | null; onBuy: (powerup: Powerup) => void; setWalletModal: (open: boolean) => void }) {
  return <section className="store-page section-wrap">
    <div className="store-hero comic-panel"><div><span className="eyebrow"><span /> STELLAR TESTNET ARMORY</span><h1>Charge your<br /><i>next flight.</i></h1><p>Every module is a wallet-signed native XLM purchase on Stellar Testnet. FastAPI checks the transaction, then equips the item to your pilot record.</p></div><aside><ShoppingBag size={27} /><b>{wallet ? 'WALLET LINKED' : 'WALLET REQUIRED'}</b><small>{configuredPowerupTreasury() ? 'XLM checkout destination ready' : 'Treasury key still needed'}</small>{!wallet && <button onClick={() => setWalletModal(true)}>Connect Freighter or Albedo</button>}</aside></div>
    <div className="store-safety"><Shield size={17} /><span>TESTNET ONLY</span><p>Use test XLM. The purchase memo and on-chain payment are checked before a module unlocks.</p></div>
    <div className="powerup-grid">{powerups.map((powerup, index) => {
      const owned = ownedPowerups.includes(powerup.id)
      const buying = purchasingPowerup === powerup.id
      return <article className={`powerup-card tone-${powerup.tone}`} key={powerup.id}><div className="powerup-number">0{index + 1}</div><img src={powerup.image} alt={`${powerup.name} power-up`} /><div className="powerup-copy"><span>{powerup.kicker}</span><h2>{powerup.name}</h2><p>{powerup.description}</p><b>{powerup.effect}</b></div><div className="powerup-buy"><strong>{powerup.priceXlm.toFixed(2)} <small>XLM</small></strong><button disabled={owned || buying} onClick={() => onBuy(powerup)}>{owned ? 'EQUIPPED' : buying ? 'CONFIRMING PAYMENT…' : wallet ? 'BUY WITH XLM' : 'CONNECT TO BUY'}</button></div></article>
    })}</div>
    <p className="store-note">Your receipt hash is recorded in PostgreSQL only after Horizon confirms the native-XLM payment from the connected wallet. In the arena, equipped modules change hull, flight speed, and projectile damage.</p>
  </section>
}

function CrewPage({ go, showNotice }: { go: (page: Page) => void; showNotice: (message: string) => void }) {
  const crew = [
    { call: 'KIRA BYTE', role: 'Arena guide / field tactician', mark: 'K', tone: 'pink', note: 'Maps hidden trails and keeps every rookie in one piece.' },
    { call: 'SORA SKYLINE', role: 'Interceptor pilot', mark: 'S', tone: 'cyan', note: 'A curious flyer with a talent for catching impossible cores.' },
    { call: 'MISO COMET', role: 'Duo support / decoy craft', mark: 'M', tone: 'gold', note: 'Turns friendship, snacks, and a hologram into a winning plan.' },
  ]
  return <section className="crew-page section-wrap"><div className="page-intro"><span className="eyebrow"><span /> PILOT SOCIETY</span><h1>Find your<br /><i>constellation.</i></h1><p>Build a duo, share a fun loadout, and collect wholesome crew moments between matches.</p></div><div className="crew-grid">{crew.map(member => <article key={member.call} className={`crew-card crew-${member.tone}`}><span className="crew-issue">CREW FILE // 0{crew.indexOf(member) + 1}</span><span className="crew-avatar" style={{ backgroundPosition: `${crew.indexOf(member) * 45}% center` }} aria-label={`${member.call} portrait`} /><div><b>{member.role}</b><h2>{member.call}</h2><p>{member.note}</p></div><button onClick={() => showNotice(`${member.call} added a friendly signal to your crew board.`)}>Send signal <ChevronRight size={15} /></button></article>)}</div><section className="crew-cta comic-panel"><div><span>DUO MODE / FRIENDLY FIRE OFF</span><h2>Bring one friend.<br />Make a comic-panel memory.</h2></div><button className="primary-btn" onClick={() => go('play')}>Open duo deck <Users size={17} /></button></section></section>
}

function ArcadePage() { return <section className="arcade-page section-wrap"><div className="page-intro"><span className="eyebrow"><span /> KIRA'S SIDE QUEST BAY</span><h1>Play something<br /><i>between the stars.</i></h1><p>A real legal-move chess board and a quick Tic-Tac-Toe challenge. These are social side quests—not fake buttons.</p></div><Suspense fallback={<GameSurfaceLoading label="Opening the side quest bay" />}><ArcadeLounge /></Suspense></section> }

function GameSurfaceLoading({ label }: { label: string }) { return <div className="game-surface-loading" role="status"><span />{label}...</div> }

function LeaderboardPage() { return <section className="leaderboard-page section-wrap"><div className="page-intro"><span className="eyebrow"><span /> SEASON 01 / NEON CUP</span><h1>The sky remembers<br /><i>the brave.</i></h1><p>Ranked by verified match results. Last refresh: just now.</p></div><div className="rank-layout"><div className="rank-list comic-panel"><div className="rank-header"><span>RANK / PILOT</span><span>CORE SCORE</span><span>FORM</span></div>{rankings.map((r, i) => <article className={i === 3 ? 'your-rank' : ''} key={r[0]}><b className="rank-num">0{i + 1}</b><span className={`rank-avatar av-${i}`}>{r[3]}</span><div><h3>{r[0]}</h3><small>{r[2]}</small></div><strong>{r[1]}</strong><span className="rank-trend">↗ {12 - i * 2}</span></article>)}</div><aside className="season-card"><div><Crown /><span>SEASON ENDS IN</span><b>12D 04H</b></div><h3>Reach Astral rank</h3><p>Top 100 receive the limited Comet Crest badge on Stellar Testnet.</p><div className="rank-meter"><span style={{ width: '62%' }} /></div><small>11,340 / 18,000 RP</small><button>View season rules <ChevronRight size={15} /></button></aside></div></section> }

function ProfilePage({ wallet, setWalletModal, showNotice, displayName, setDisplayName, savePilotIdentity }: { wallet: WalletSession | null; setWalletModal: (b: boolean) => void; showNotice: (s: string) => void; displayName: string; setDisplayName: (value: string) => void; savePilotIdentity: () => void }) { return <section className="profile-page section-wrap"><div className="profile-banner scene-city"><div><span>THE FLIGHT LOG OF</span><h1>{displayName.split(' ')[0]?.toUpperCase() || 'PILOT'}</h1><p>“I’m not lost. I’m exploring in a really committed way.”</p></div></div><div className="profile-grid"><section className="pilot-card comic-panel"><div className="pilot-avatar avatar-art" aria-label="Pilot portrait" /><div><span>RANK 04 · COMET</span><h2>{displayName.toUpperCase()}</h2><p>{wallet ? `${wallet.provider} / ${shortKey(wallet.address)}` : 'Guest pilot — secure your arena identity.'}</p><label className="pilot-name-field">CALLSIGN<input maxLength={32} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your callsign" /></label></div><button onClick={() => wallet ? savePilotIdentity() : setWalletModal(true)}>{wallet ? 'Save pilot' : 'Connect wallet'}</button></section><section className="badge-case"><span><Medal /> BADGE CASE / SHOWCASE</span><div><Badge icon="✦" name="First Light" /><Badge icon="☄" name="Core Keeper" /><Badge icon="⚡" name="Swift Shift" /><Badge icon="♜" name="Kitsune Signal" /></div></section><section className="activity-card comic-panel"><span>RECENTLY RECORDED</span><article><i className="win">W</i><div><b>Solo · Shibuya Drift</b><small>Placed #1 / 8 · 9 cores captured</small></div><em>+240 RP</em></article><article><i className="win">W</i><div><b>Duo · Kyoto Orbit</b><small>Placed #2 / 4 · Kira Byte joined</small></div><em>+180 RP</em></article><button onClick={() => showNotice('Full match history will load from your game backend.')}>Open match history <ChevronRight size={15} /></button></section></div></section> }

function Badge({ icon, name, locked = false }: { icon: string; name: string; locked?: boolean }) { return <article className={locked ? 'locked' : ''}><b>{icon}</b><span>{name}</span></article> }

function LorePage({ go }: { go: (page: Page) => void }) { return <section className="lore-page"><div className="lore-cover"><span>PROLOGUE / ISSUE 00</span><h1>WHEN THE SKY<br />STARTED <i>CALLING.</i></h1><p>A short story from the edge of Kyoto Orbit.</p><button className="primary-btn" onClick={() => go('play')}>Continue to the arena <ChevronRight size={16} /></button></div><PrologueReader /><div className="chapter-grid">{chapterCards.map(card => <article key={card.no} className={`chapter-card ${card.scene}`}><span>CHAPTER {card.no}</span><div><b>{card.tag}</b><h2>{card.title}</h2><p>{card.text}</p><button>Read chapter <ChevronRight size={15} /></button></div></article>)}</div><div className="manga-note"><span>NOTE FROM KIRA</span><p>“The arena isn’t about beating everyone. It’s about finding the people you want to fly beside.”</p><Heart fill="currentColor" /></div></section> }

function ChapterReaderModal({ chapter, close }: { chapter: typeof chapterStories[number]; close: () => void }) {
  const [page, setPage] = useState(0)
  const [title, copy] = chapter.pages[page]
  const isLast = page === chapter.pages.length - 1
  return <div className="chapter-reader-backdrop" role="dialog" aria-modal="true" aria-label={`${chapter.title} manga chapter`}><section className={`chapter-reader comic-panel ${chapter.scene}`}><header><div><span>{chapter.label} / {String(page + 1).padStart(2, '0')}</span><h2>{chapter.title}</h2></div><button onClick={close} aria-label="Close chapter"><X size={18} /></button></header><div className="chapter-manga-art"><div className="chapter-sfx">KIRA STORY LOG</div><div className="chapter-bubble"><b>{title}</b><p>{copy}</p></div></div><footer><button onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0}>Previous panel</button><div>{chapter.pages.map((_, index) => <i className={index === page ? 'active' : ''} key={index} />)}</div><button className="comic-btn" onClick={() => isLast ? close() : setPage(value => value + 1)}>{isLast ? 'Close chapter' : 'Next panel'} <ChevronRight size={15} /></button></footer></section></div>
}

function PrologueReader() {
  const spreads = [
    { panel: '01 / THE FALLING STAR', title: 'A blue light crossed the snow.', text: 'Sora was fixing a borrowed interceptor outside a quiet shrine when the night split open. A tiny Stellar Core fell into the lantern field and hummed like it knew their name.', aside: '“It is not a meteor,” Kira said. “Meteors do not send invitations.”' },
    { panel: '02 / THE INVITATION', title: 'Kyoto Orbit answered with a gate.', text: 'The Core drew a bright line through the clouds. Beyond it waited Neon Osaka Arena: rooftops, rail lines, friendly rivals, and a storm circle that always asked pilots to be brave together.', aside: 'Sora packed one rice bun, one shield module, and an unreasonable amount of hope.' },
    { panel: '03 / FIRST FLIGHT', title: 'The first rule was simple.', text: 'Catch the light. Help when you can. Keep moving when the void closes in. Nobody had to be perfect; every pilot only needed one small, daring moment to begin.', aside: 'Kira pointed at the horizon. “Ready? The sky has been waiting.”' },
  ]
  const [current, setCurrent] = useState(0)
  const story = spreads[current]
  return <section className="story-reader" aria-label="Readable Stellar Arena prologue"><div className="reader-top"><span>READABLE EDITION / {story.panel}</span><div>{spreads.map((_, index) => <button aria-label={`Read prologue page ${index + 1}`} className={current === index ? 'active' : ''} key={index} onClick={() => setCurrent(index)} />)}</div></div><div className={`prologue-art-panels panel-${current + 1}`} aria-label="Original illustrated Stellar Arena manga panels" /><article className="story-panel"><span className="story-number">{String(current + 1).padStart(2, '0')}</span><div><h2>{story.title}</h2><p>{story.text}</p></div><blockquote>{story.aside}</blockquote></article><div className="reader-actions"><button disabled={current === 0} onClick={() => setCurrent(value => value - 1)}>Previous page</button><button className="comic-btn" disabled={current === spreads.length - 1} onClick={() => setCurrent(value => value + 1)}>Next panel <ChevronRight size={16} /></button></div></section>
}

function SectionHeading({ kicker, title, side }: { kicker: string; title: string; side: string }) { return <div className="section-heading"><div><span className="eyebrow"><span /> {kicker}</span><h2>{title}</h2></div><p>{side}</p></div> }

function Kira({ geminiOpen, setGeminiOpen, geminiReply, geminiLoading, askKira }: { geminiOpen: boolean; setGeminiOpen: (value: boolean) => void; geminiReply: string; geminiLoading: boolean; askKira: (p: string) => void }) { return <>{geminiOpen && <div className="kira-chat"><div className="kira-chat-head"><span><Bot size={17} /> KIRA / GEMINI COPILOT</span><button onClick={() => setGeminiOpen(false)}><X size={16} /></button></div><p>Hi, pilot! I can help you find a route, shape a kit, or spill a tiny bit of arena lore.</p>{geminiLoading && <div className="kira-response">Kira is checking the star map…</div>}{geminiReply && !geminiLoading && <div className="kira-response">{geminiReply}</div>}<div className="kira-prompts"><button disabled={geminiLoading} onClick={() => askKira('route')}>Best route?</button><button disabled={geminiLoading} onClick={() => askKira('build')}>My build?</button><button disabled={geminiLoading} onClick={() => askKira('lore')}>Tell me lore</button></div><small>Uses Gemini when the secure game API is configured; local tactical drills remain available offline.</small></div>}<button className="kira-fab" onClick={() => setGeminiOpen(!geminiOpen)}><span className="kira-fab-face"><PixelAvatar /></span><span>Ask Kira</span><Sparkles size={15} /></button></> }

function PixelAvatar({ mark = 'K' }: { mark?: string }) {
  const pixels = new Set([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 43, 44, 45, 46, 47, 48, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61])
  return <span className="pixel-avatar" aria-label={`${mark} pixel avatar`} role="img">{Array.from({ length: 64 }, (_, index) => <i className={pixels.has(index) ? `px p${index % 5}` : ''} key={index} />)}<b>{mark}</b></span>
}

function WalletModal({ close, connect, connecting }: { close: () => void; connect: (k: 'freighter' | 'albedo') => void; connecting: 'freighter' | 'albedo' | null }) { return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="wallet-modal comic-panel"><button className="modal-close" onClick={close}><X /></button><div className="wallet-spark"><Wallet /><i /></div><span className="eyebrow"><span /> PILOT IDENTITY</span><h2>Bring your own<br /><i>starship key.</i></h2><p>Connect a Stellar wallet to save your identity, claim Testnet badges, and enter seasonal events.</p><button className="wallet-option" onClick={() => connect('freighter')} disabled={!!connecting}><span className="freighter-logo">F</span><div><b>Freighter</b><small>Browser extension wallet</small></div><ChevronRight /></button><button className="wallet-option" onClick={() => connect('albedo')} disabled={!!connecting}><span className="albedo-logo">A</span><div><b>Albedo</b><small>Secure pop-up signer</small></div><ChevronRight /></button><small className="wallet-foot">{connecting ? `Waiting for ${connecting}…` : 'You approve every signature. We never see your secret key.'}</small></div></div> }

function shortKey(value: string) { return `${value.slice(0, 5)}…${value.slice(-4)}` }

export default App
