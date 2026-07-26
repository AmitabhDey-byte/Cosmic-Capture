import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Bolt, Crosshair, Gem, HeartPulse, Play, Sparkles } from 'lucide-react'

export type ArenaRun = { cores: number; shards: number; score: number; durationSeconds: number }

type Mode = 'Solo' | 'Duo' | 'Tournament'
type Vec = { x: number; y: number; vx: number; vy: number; r: number; life?: number; hue?: number }
type Enemy = Vec & { cooldown: number; stunned: number }
type World = {
  status: 'ready' | 'playing' | 'over'
  player: Vec & { health: number; fuel: number; shield: number; abilityCooldown: number }
  cores: Vec[]
  enemies: Enemy[]
  shots: Vec[]
  particles: Vec[]
  time: number
  remaining: number
  score: number
  coresCollected: number
  shards: number
  banked: boolean
  lastHud: number
}

type Props = {
  mode: Mode
  ability: string
  walletConnected: boolean
  directive?: { text: string; coreGoal: number; bonusShards: number } | null
  onComplete: (run: ArenaRun) => void
}

const WIDTH = 1280
const HEIGHT = 720
const RUN_SECONDS = 120

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const length = (x: number, y: number) => Math.hypot(x, y) || 1
const random = (min: number, max: number) => min + Math.random() * (max - min)

function makeCore(): Vec {
  return { x: random(120, WIDTH - 120), y: random(105, HEIGHT - 105), vx: random(-18, 18), vy: random(-16, 16), r: 15, hue: random(185, 225) }
}

function makeEnemy(): Enemy {
  const edge = Math.floor(Math.random() * 4)
  const x = edge === 0 ? -40 : edge === 1 ? WIDTH + 40 : random(100, WIDTH - 100)
  const y = edge === 2 ? -40 : edge === 3 ? HEIGHT + 40 : random(90, HEIGHT - 90)
  return { x, y, vx: 0, vy: 0, r: random(19, 27), cooldown: random(.2, 1.4), stunned: 0 }
}

function newWorld(): World {
  return {
    status: 'ready', player: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, r: 22, health: 100, fuel: 100, shield: 0, abilityCooldown: 0 }, cores: Array.from({ length: 7 }, makeCore), enemies: Array.from({ length: 4 }, makeEnemy), shots: [], particles: [], time: 0, remaining: RUN_SECONDS, score: 0, coresCollected: 0, shards: 0, banked: false, lastHud: 0,
  }
}

function drawDiamond(context: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string) {
  context.beginPath()
  context.moveTo(x, y - size)
  context.lineTo(x + size, y)
  context.lineTo(x, y + size)
  context.lineTo(x - size, y)
  context.closePath()
  context.fillStyle = fill
  context.fill()
}

export function ArenaGame({ mode, ability, walletConnected, directive, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const worldRef = useRef<World>(newWorld())
  const keys = useRef(new Set<string>())
  const pointer = useRef({ active: false, x: WIDTH / 2, y: HEIGHT / 2 })
  const background = useRef<HTMLImageElement | null>(null)
  const animation = useRef(0)
  const previous = useRef(0)
  const [hud, setHud] = useState({ status: 'ready' as World['status'], health: 100, fuel: 100, cores: 0, shards: 0, remaining: RUN_SECONDS, score: 0, abilityCooldown: 0 })
  const [bank, setBank] = useState(() => Number(window.localStorage.getItem('stellar-arena-shards') || 0))
  const [upgrades, setUpgrades] = useState(() => ({ thrust: Number(window.localStorage.getItem('stellar-arena-thrust') || 0), magnet: Number(window.localStorage.getItem('stellar-arena-magnet') || 0), hull: Number(window.localStorage.getItem('stellar-arena-hull') || 0) }))

  useEffect(() => {
    const image = new Image()
    image.src = '/art/neon-shrine-arena-v2.png'
    image.onload = () => { background.current = image }
  }, [])

  const publish = useCallback((world: World) => {
    setHud({ status: world.status, health: Math.ceil(world.player.health), fuel: Math.ceil(world.player.fuel), cores: world.coresCollected, shards: world.shards, remaining: Math.ceil(world.remaining), score: world.score, abilityCooldown: Math.ceil(world.player.abilityCooldown) })
  }, [])

  const bankReward = useCallback((world: World) => {
    if (world.banked) return
    world.banked = true
    if (directive && world.coresCollected >= directive.coreGoal) {
      world.shards += directive.bonusShards
      world.score += directive.bonusShards * 42
    }
    const nextBank = bank + world.shards
    window.localStorage.setItem('stellar-arena-shards', String(nextBank))
    setBank(nextBank)
    onComplete({ cores: world.coresCollected, shards: world.shards, score: world.score, durationSeconds: Math.round(world.time) })
  }, [bank, directive, onComplete])

  const launch = useCallback(() => {
    const world = newWorld()
    world.status = 'playing'
    worldRef.current = world
    publish(world)
    canvasRef.current?.focus()
  }, [publish])

  const triggerAbility = useCallback(() => {
    const world = worldRef.current
    const player = world.player
    if (world.status !== 'playing' || player.abilityCooldown > 0) return
    player.abilityCooldown = ability === 'EMP Bloom' ? 12 : ability === 'Blink Shift' ? 8 : 10
    if (ability === 'Aegis Bloom') player.shield = 3.3
    if (ability === 'Blink Shift') {
      player.x = clamp(player.x + Math.sign(player.vx || 1) * 160, 60, WIDTH - 60)
      player.y = clamp(player.y + Math.sign(player.vy || -1) * 110, 60, HEIGHT - 60)
    }
    if (ability === 'EMP Bloom') world.enemies.forEach(enemy => { enemy.stunned = 3.2 })
    for (let i = 0; i < 34; i += 1) world.particles.push({ x: player.x, y: player.y, vx: random(-220, 220), vy: random(-220, 220), r: random(2, 6), life: random(.35, .9), hue: ability === 'EMP Bloom' ? 45 : ability === 'Blink Shift' ? 320 : 190 })
  }, [ability])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'e', 'shift'].includes(key)) event.preventDefault()
      if (key === 'e' || key === ' ') triggerAbility()
      keys.current.add(key)
    }
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [triggerAbility])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const draw = (world: World) => {
      const scroll = (world.time * 20) % WIDTH
      context.clearRect(0, 0, WIDTH, HEIGHT)
      if (background.current?.complete) {
        context.globalAlpha = .94
        context.drawImage(background.current, -scroll, 0, WIDTH, HEIGHT)
        context.drawImage(background.current, WIDTH - scroll, 0, WIDTH, HEIGHT)
        context.globalAlpha = 1
      } else {
        const sky = context.createLinearGradient(0, 0, 0, HEIGHT)
        sky.addColorStop(0, '#050823'); sky.addColorStop(1, '#251348')
        context.fillStyle = sky; context.fillRect(0, 0, WIDTH, HEIGHT)
      }
      context.fillStyle = 'rgba(4, 4, 24, .34)'; context.fillRect(0, 0, WIDTH, HEIGHT)
      if (directive) {
        context.fillStyle = 'rgba(11, 10, 39, .76)'; context.fillRect(28, 28, 260, 55)
        context.strokeStyle = 'rgba(83, 239, 255, .72)'; context.lineWidth = 1; context.strokeRect(28, 28, 260, 55)
        context.font = '700 12px system-ui'; context.fillStyle = '#62f4ff'; context.textAlign = 'left'; context.fillText('KIRA CONTRACT', 42, 50)
        context.font = '800 18px system-ui'; context.fillStyle = '#fff'; context.fillText(`${world.coresCollected} / ${directive.coreGoal} CORES  ·  +${directive.bonusShards} ASTRA`, 42, 73)
      }
      const ringRadius = 610 - world.time * 1.8
      context.save(); context.translate(WIDTH / 2, HEIGHT / 2)
      context.strokeStyle = 'rgba(255, 79, 163, .72)'; context.lineWidth = 4; context.setLineDash([14, 13]); context.lineDashOffset = -world.time * 48
      context.beginPath(); context.ellipse(0, 0, Math.max(210, ringRadius), Math.max(118, ringRadius * .56), 0, 0, Math.PI * 2); context.stroke(); context.restore(); context.setLineDash([])

      for (const core of world.cores) {
        context.save(); context.shadowBlur = 28; context.shadowColor = '#4beeff'; drawDiamond(context, core.x, core.y, core.r, '#aaf7ff'); context.strokeStyle = '#fff8c9'; context.lineWidth = 2; context.stroke(); context.restore()
      }
      for (const shot of world.shots) {
        context.save(); context.shadowBlur = 18; context.shadowColor = '#ff4fa3'; context.fillStyle = '#ff7db7'; context.beginPath(); context.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2); context.fill(); context.restore()
      }
      for (const enemy of world.enemies) {
        context.save(); context.translate(enemy.x, enemy.y); context.rotate(Math.atan2(world.player.y - enemy.y, world.player.x - enemy.x)); context.globalAlpha = enemy.stunned > 0 ? .42 : 1; context.shadowBlur = 20; context.shadowColor = '#ff4fa3'; context.fillStyle = '#5d174f'; context.beginPath(); context.moveTo(27, 0); context.lineTo(-18, -17); context.lineTo(-8, 0); context.lineTo(-18, 17); context.closePath(); context.fill(); context.strokeStyle = '#ffb5d7'; context.lineWidth = 2; context.stroke(); context.restore()
      }
      const player = world.player
      context.save(); context.translate(player.x, player.y); context.rotate(Math.atan2(player.vy, player.vx) || 0)
      if (player.shield > 0) { context.beginPath(); context.arc(0, 0, 43 + Math.sin(world.time * 8) * 3, 0, Math.PI * 2); context.fillStyle = 'rgba(90, 232, 255, .16)'; context.fill(); context.strokeStyle = '#81f4ff'; context.lineWidth = 2; context.stroke() }
      if (pointer.current.active || keys.current.has('shift')) { context.shadowBlur = 30; context.shadowColor = '#ffbb48'; context.fillStyle = '#ffe2a6'; context.beginPath(); context.moveTo(-20, -9); context.lineTo(-52 - Math.random() * 20, 0); context.lineTo(-20, 9); context.fill() }
      context.shadowBlur = 25; context.shadowColor = '#45efff'; const hull = context.createLinearGradient(-24, 0, 28, 0); hull.addColorStop(0, '#126aa0'); hull.addColorStop(.55, '#e7fdff'); hull.addColorStop(1, '#49edff'); context.fillStyle = hull; context.beginPath(); context.moveTo(32, 0); context.lineTo(-18, -19); context.lineTo(-9, 0); context.lineTo(-18, 19); context.closePath(); context.fill(); context.strokeStyle = '#fff'; context.lineWidth = 2; context.stroke(); context.fillStyle = '#fc5bb4'; context.fillRect(-2, -6, 15, 12); context.restore()
      for (const particle of world.particles) { context.save(); context.globalAlpha = clamp((particle.life || 0) * 1.8, 0, 1); context.fillStyle = `hsl(${particle.hue || 190} 100% 68%)`; context.beginPath(); context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2); context.fill(); context.restore() }
      if (world.status === 'ready') { context.fillStyle = 'rgba(6,4,27,.56)'; context.fillRect(0, 0, WIDTH, HEIGHT); context.fillStyle = '#fff'; context.textAlign = 'center'; context.font = '800 54px system-ui'; context.fillText('NEON SHRINE RUN', WIDTH / 2, HEIGHT / 2 - 22); context.font = '500 20px system-ui'; context.fillStyle = '#b9f9ff'; context.fillText('Press LAUNCH, then steer with WASD / arrows or drag on the arena.', WIDTH / 2, HEIGHT / 2 + 26) }
      if (world.status === 'over') { context.fillStyle = 'rgba(6,4,27,.68)'; context.fillRect(0, 0, WIDTH, HEIGHT); context.fillStyle = '#fff'; context.textAlign = 'center'; context.font = '900 58px system-ui'; context.fillText(world.player.health <= 0 ? 'SHIP DOWN' : 'RUN COMPLETE', WIDTH / 2, HEIGHT / 2 - 52); context.font = '700 28px system-ui'; context.fillStyle = '#ffe29a'; context.fillText(`${world.coresCollected} CORES  ·  +${world.shards} ASTRA`, WIDTH / 2, HEIGHT / 2); context.font = '500 18px system-ui'; context.fillStyle = '#d7d1ef'; context.fillText('Your reward has been banked locally and queued for verified Testnet settlement.', WIDTH / 2, HEIGHT / 2 + 42) }
    }

    const tick = (timestamp: number) => {
      const world = worldRef.current
      const dt = Math.min(.033, (timestamp - previous.current || 16) / 1000)
      previous.current = timestamp
      if (world.status === 'playing') {
        const player = world.player
        world.time += dt; world.remaining = Math.max(0, RUN_SECONDS - world.time)
        player.abilityCooldown = Math.max(0, player.abilityCooldown - dt); player.shield = Math.max(0, player.shield - dt)
        let dx = 0; let dy = 0
        if (keys.current.has('a') || keys.current.has('arrowleft')) dx -= 1
        if (keys.current.has('d') || keys.current.has('arrowright')) dx += 1
        if (keys.current.has('w') || keys.current.has('arrowup')) dy -= 1
        if (keys.current.has('s') || keys.current.has('arrowdown')) dy += 1
        if (pointer.current.active) { dx += (pointer.current.x - player.x) / 150; dy += (pointer.current.y - player.y) / 150 }
        const magnitude = length(dx, dy); const boosting = pointer.current.active || keys.current.has('shift')
        const acceleration = (boosting ? 710 : 380) + upgrades.thrust * 55
        if (dx || dy) { player.vx += (dx / magnitude) * acceleration * dt; player.vy += (dy / magnitude) * acceleration * dt }
        player.vx *= boosting ? .986 : .94; player.vy *= boosting ? .986 : .94
        const maxSpeed = (boosting ? 470 : 295) + upgrades.thrust * 22
        const speed = length(player.vx, player.vy); if (speed > maxSpeed) { player.vx = player.vx / speed * maxSpeed; player.vy = player.vy / speed * maxSpeed }
        player.x = clamp(player.x + player.vx * dt, 38, WIDTH - 38); player.y = clamp(player.y + player.vy * dt, 42, HEIGHT - 42)
        player.fuel = clamp(player.fuel + (boosting ? -10 : 7) * dt, 0, 100)
        if (player.fuel <= 0) pointer.current.active = false
        for (const core of world.cores) { core.x += core.vx * dt; core.y += core.vy * dt; if (core.x < 80 || core.x > WIDTH - 80) core.vx *= -1; if (core.y < 70 || core.y > HEIGHT - 70) core.vy *= -1 }
        const magnet = 65 + upgrades.magnet * 35
        world.cores = world.cores.filter(core => {
          const distance = length(core.x - player.x, core.y - player.y)
          if (distance < magnet) { core.x += (player.x - core.x) * dt * 3.4; core.y += (player.y - core.y) * dt * 3.4 }
          if (distance < player.r + core.r + 7) { world.coresCollected += 1; world.shards += 12; world.score += 500; for (let i = 0; i < 16; i += 1) world.particles.push({ x: core.x, y: core.y, vx: random(-160, 160), vy: random(-160, 160), r: random(2, 5), life: random(.25, .7), hue: 190 }); return false }
          return true
        })
        while (world.cores.length < 7) world.cores.push(makeCore())
        const desiredEnemies = mode === 'Tournament' ? 7 : mode === 'Duo' ? 5 : 4
        while (world.enemies.length < desiredEnemies) world.enemies.push(makeEnemy())
        for (const enemy of world.enemies) {
          const distance = length(player.x - enemy.x, player.y - enemy.y)
          if (enemy.stunned > 0) { enemy.stunned -= dt; continue }
          enemy.vx += (player.x - enemy.x) / distance * 55 * dt; enemy.vy += (player.y - enemy.y) / distance * 55 * dt; enemy.vx *= .98; enemy.vy *= .98; enemy.x += enemy.vx; enemy.y += enemy.vy; enemy.cooldown -= dt
          if (enemy.cooldown <= 0 && distance < 470) { world.shots.push({ x: enemy.x, y: enemy.y, vx: (player.x - enemy.x) / distance * 255, vy: (player.y - enemy.y) / distance * 255, r: 6, life: 3 }); enemy.cooldown = random(1.1, 2.3) }
        }
        world.shots = world.shots.filter(shot => { shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life = (shot.life || 0) - dt; if (length(shot.x - player.x, shot.y - player.y) < player.r + shot.r) { if (player.shield <= 0) player.health = Math.max(0, player.health - (8 - upgrades.hull)); return false } return (shot.life || 0) > 0 })
        world.particles = world.particles.filter(particle => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .95; particle.vy *= .95; particle.life = (particle.life || 0) - dt; return (particle.life || 0) > 0 })
        if (world.remaining <= 0 || player.health <= 0) { world.status = 'over'; bankReward(world) }
        if (timestamp - world.lastHud > 100) { world.lastHud = timestamp; publish(world) }
      }
      draw(world)
      animation.current = requestAnimationFrame(tick)
    }
    animation.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animation.current)
  }, [ability, bankReward, directive, mode, publish, upgrades])

  const updatePointer = (event: PointerEvent<HTMLCanvasElement>, active: boolean) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    pointer.current = { active, x: clamp((event.clientX - bounds.left) / bounds.width * WIDTH, 0, WIDTH), y: clamp((event.clientY - bounds.top) / bounds.height * HEIGHT, 0, HEIGHT) }
    if (active && worldRef.current.status === 'ready') launch()
    if (active) event.currentTarget.setPointerCapture(event.pointerId)
  }

  const buy = (kind: keyof typeof upgrades, cost: number) => {
    if (bank < cost || upgrades[kind] >= 3) return
    const next = { ...upgrades, [kind]: upgrades[kind] + 1 }
    const nextBank = bank - cost
    setUpgrades(next); setBank(nextBank)
    window.localStorage.setItem(`stellar-arena-${kind}`, String(next[kind]))
    window.localStorage.setItem('stellar-arena-shards', String(nextBank))
  }

  const clock = `${String(Math.floor(hud.remaining / 60)).padStart(2, '0')}:${String(hud.remaining % 60).padStart(2, '0')}`
  return <section className="arena-engine">
    <header className="game-hud"><div><span>LIVE SYSTEM</span><b>NEON SHRINE // {mode.toUpperCase()}</b></div><div className="hud-readout"><span><HeartPulse size={15} /> {hud.health}</span><span><Bolt size={15} /> {hud.fuel}</span><span><Gem size={15} /> {hud.cores}</span><strong>{clock}</strong></div></header>
    <div className="canvas-frame"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} tabIndex={0} aria-label="Playable Stellar Arena game. Use WASD or arrow keys to fly; hold Shift or touch-drag to boost; Space or E activates your ability." onPointerDown={event => updatePointer(event, true)} onPointerMove={event => { if (pointer.current.active) updatePointer(event, true) }} onPointerUp={event => updatePointer(event, false)} onPointerCancel={event => updatePointer(event, false)} />
      <div className="game-corner game-corner-left"><span>ABILITY</span><b>{ability}</b><button onClick={triggerAbility} disabled={hud.status !== 'playing' || hud.abilityCooldown > 0}>{hud.abilityCooldown > 0 ? `${hud.abilityCooldown}s` : 'SPACE / E'}</button></div>
      <div className="game-corner game-corner-right"><span>RUN SCORE</span><b>{hud.score.toLocaleString()}</b><small>+{hud.shards} ASTRA THIS RUN</small></div>
      {directive && <div className="game-directive"><span>KIRA CONTRACT</span><b>{hud.cores}/{directive.coreGoal} CORES</b><small>+{directive.bonusShards} ASTRA if complete</small></div>}
      {hud.status !== 'playing' && <div className="game-launch"><span>{hud.status === 'over' ? 'RUN LOGGED' : 'CANVAS ARENA'}</span><h2>{hud.status === 'over' ? `${hud.cores} CORES SECURED` : 'FLY. BOOST. OUTLAST.'}</h2><p>{hud.status === 'over' ? `+${hud.shards} Astra added to your launch bank.` : 'Keyboard: WASD / arrows steer · Hold Shift to boost · Space or E for ability. Mobile: drag anywhere to fly and boost.'}</p><button onClick={launch}><Play size={18} fill="currentColor" /> {hud.status === 'over' ? 'Launch another run' : 'Launch run'}</button></div>}
    </div>
    <div className="game-bottom"><div className="control-hint"><Crosshair size={17} /><span><b>REAL CONTROLS</b> WASD / arrow keys to fly · hold Shift to burn fuel · Space/E for {ability}</span></div><div className="currency-bank"><Sparkles size={17} /><span><b>{bank} ASTRA</b><small>{walletConnected ? 'Wallet linked · verified rewards settle to Testnet' : 'Local launch bank · connect wallet for Testnet rewards'}</small></span></div></div>
    <section className="upgrade-dock"><div><span>LAUNCH BAY / SPEND ASTRA</span><h3>Upgrade the craft between runs.</h3><p>Progress is saved in this browser; verified matches are queued to the Testnet reward ledger once your wallet and issuer configuration are live.</p></div><div className="upgrade-grid">{([['thrust', 'VECTOR THRUST', 45, 'More acceleration and top speed.'], ['magnet', 'CORE MAGNET', 55, 'Pull nearby Stellar Cores.'], ['hull', 'REINFORCED HULL', 70, 'Reduce incoming damage.']] as const).map(([kind, title, cost, copy]) => <button key={kind} onClick={() => buy(kind, cost)} disabled={bank < cost || upgrades[kind] >= 3}><span>LV {upgrades[kind]}/3</span><b>{title}</b><small>{copy}</small><em>{upgrades[kind] >= 3 ? 'MAXED' : `${cost} ASTRA`}</em></button>)}</div></section>
  </section>
}
