import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PowerupId } from '../lib/powerups';

/* ============================================================================
   STELLAR ARENA: COSMIC CAPTURE
   Step 3 — Player & bot ship sprites
   ========================================================================== */

/* ----------------------------- Type System ------------------------------ */

export type GameMode = 'solo' | 'duo';
export type Team = 'A' | 'B';
export type BotBehavior = 'seek-core' | 'chase-enemy' | 'wander';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  color: string;
  team: Team | null; // null in Solo (FFA)
  score: number;
  health: number;
  maxHealth: number;
}

export interface Bot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  color: string;
  team: Team | null; // null in Solo (FFA) — every other entity is hostile
  score: number;
  health: number;
  maxHealth: number;
  behavior: BotBehavior;
  targetId: string | null;
  lastShot: number;
  wanderAngle: number;
  wanderTimer: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ownerId: string;
  team: Team | null;
  color: string;
  damage: number;
  life: number; // seconds remaining
}

export interface Core {
  id: string;
  x: number;
  y: number;
  radius: number;
  value: number;
  pulsePhase: number;
  hue: number;
}

export interface GameState {
  mode: GameMode;
  player: Player;
  bots: Bot[];
  projectiles: Projectile[];
  cores: Core[];
  arenaWidth: number;
  arenaHeight: number;
  elapsedTime: number;
  lastCoreSpawn: number;
  coresCaptured: number;
}

export type ArenaRun = { cores: number; shards: number; score: number; durationSeconds: number; placement: number; won: boolean };
type MissionPhase = 'briefing' | 'playing' | 'finished';
type Props = {
  mode: GameMode;
  walletConnected: boolean;
  equippedPowerups: PowerupId[];
  directive?: { text: string; coreGoal: number; bonusShards: number } | null;
  onComplete: (run: ArenaRun) => void;
};

interface BackgroundStar {
  x: number;
  y: number;
  radius: number;
  twinkleOffset: number;
  brightness: number;
}

/** A flattened, read-only view of anything that can fight or be targeted. */
interface Combatant {
  id: string;
  x: number;
  y: number;
  radius: number;
  team: Team | null;
  isPlayer: boolean;
}

interface ScoreboardEntry {
  id: string;
  label: string;
  team: Team | null;
  score: number;
  isPlayer: boolean;
}

/* ------------------------------ Constants -------------------------------- */

const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 640;

const PLAYER_RADIUS = 16;
const PLAYER_SPEED = 260; // px/sec
const PLAYER_MAX_HEALTH = 100;

const BOT_RADIUS = 14;
const BOT_SPEED = 150;
const BOT_MAX_HEALTH = 60;
const BOT_VISION_RANGE = 320; // how far a bot can "see" an enemy
const BOT_FIRE_RANGE = 260;
const BOT_FIRE_COOLDOWN = 0.55;

const SOLO_BOT_COUNT = 5;
const DUO_ALLY_COUNT = 1; // teammates fighting alongside the player
const DUO_ENEMY_COUNT = 2; // opposing team

const PROJECTILE_SPEED = 640;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_LIFE = 1.1;
const FIRE_COOLDOWN = 0.18; // player fire rate
const PROJECTILE_DAMAGE = 12;
const KILL_BONUS = 15;

const CORE_RADIUS = 10;
const CORE_SPAWN_INTERVAL = 2.4; // seconds
const MAX_CORES = 8;
const CORE_VALUE = 10;
const ROUND_SECONDS = 90;

const STAR_COUNT = 140;

// Sprite render sizes derived from each processed asset's own aspect ratio.
const PLAYER_SPRITE_RENDER_SIZE = 62;
// The artwork's nose points straight up (-Y); canvas angle 0 points right (+X),
// so we add a 90° rotation to align the sprite's nose with the ship's facing angle.
const PLAYER_SPRITE_ROTATION_OFFSET = Math.PI / 4;

const BOT_SPRITE_RENDER_SIZE = 42;
// The artwork's nose points up-and-right at roughly 45°, so we add a 45°
// rotation to align it the same way.
const BOT_SPRITE_ROTATION_OFFSET = Math.PI / 2;
const playerShipSrc = '/art/ships/sora-interceptor.png';
const botShipSrc = '/art/ships/rival-scout.jpg';

/**
 * The supplied sprite files include a checkerboard/white presentation
 * background. Remove only edge-connected backdrop pixels once at load time,
 * so the actual ships—not square image cards—are rendered in the arena.
 */
function loadCutoutSprite(src: string, backdrop: 'checker' | 'white', onReady: (image: HTMLImageElement) => void) {
  const source = new Image();
  source.onload = () => {
    const size = 384;
    const surface = document.createElement('canvas');
    surface.width = size;
    surface.height = size;
    const context = surface.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    context.drawImage(source, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size);
    const visited = new Uint8Array(size * size);
    const stack: number[] = [];
    const isBackdrop = (point: number) => {
      const index = point * 4;
      const r = pixels.data[index];
      const g = pixels.data[index + 1];
      const b = pixels.data[index + 2];
      if (backdrop === 'white') return r > 242 && g > 242 && b > 242;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      return spread < 14 && r > 120 && r < 235;
    };
    const enqueue = (point: number) => {
      if (!visited[point] && isBackdrop(point)) {
        visited[point] = 1;
        stack.push(point);
      }
    };

    for (let x = 0; x < size; x += 1) {
      enqueue(x);
      enqueue((size - 1) * size + x);
    }
    for (let y = 1; y < size - 1; y += 1) {
      enqueue(y * size);
      enqueue(y * size + size - 1);
    }
    while (stack.length) {
      const point = stack.pop()!;
      const x = point % size;
      const y = Math.floor(point / size);
      if (x > 0) enqueue(point - 1);
      if (x < size - 1) enqueue(point + 1);
      if (y > 0) enqueue(point - size);
      if (y < size - 1) enqueue(point + size);
    }

    visited.forEach((isBackground, point) => {
      if (isBackground) pixels.data[point * 4 + 3] = 0;
    });
    context.putImageData(pixels, 0, 0);
    const cutout = new Image();
    cutout.onload = () => onReady(cutout);
    cutout.src = surface.toDataURL('image/png');
  };
  source.src = src;
}

const TEAM_COLORS: Record<Team, string> = {
  A: '#5eead4', // cyan — player's team in Duo
  B: '#f472b6', // magenta — opposing team in Duo
};
const SOLO_ENEMY_COLOR = '#fb923c'; // amber — every bot in Solo FFA
const PLAYER_SOLO_COLOR = '#5eead4';
const PROJECTILE_COLORS: Record<string, string> = {
  A: '#a5f3fc',
  B: '#fbcfe8',
  neutral: '#fed7aa',
};

/* ------------------------------ Utilities -------------------------------- */

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${idCounter++}`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const randRange = (min: number, max: number) => min + Math.random() * (max - min);

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

/** Two combatants are hostile if: Solo => any two distinct entities; Duo => different teams. */
const isHostile = (mode: GameMode, teamA: Team | null, idA: string, teamB: Team | null, idB: string) => {
  if (idA === idB) return false;
  if (mode === 'solo') return true;
  return teamA !== teamB;
};

/* --------------------------- Factory Functions ---------------------------- */

const createPlayer = (mode: GameMode): Player => {
  const team: Team | null = mode === 'duo' ? 'A' : null;
  return {
    id: 'player',
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: PLAYER_RADIUS,
    color: team ? TEAM_COLORS[team] : PLAYER_SOLO_COLOR,
    team,
    score: 0,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
  };
};

const createBot = (team: Team | null, color: string): Bot => ({
  id: nextId('bot'),
  x: randRange(80, ARENA_WIDTH - 80),
  y: randRange(80, ARENA_HEIGHT - 80),
  vx: 0,
  vy: 0,
  angle: 0,
  radius: BOT_RADIUS,
  color,
  team,
  score: 0,
  health: BOT_MAX_HEALTH,
  maxHealth: BOT_MAX_HEALTH,
  behavior: 'wander',
  targetId: null,
  lastShot: 0,
  wanderAngle: randRange(0, Math.PI * 2),
  wanderTimer: randRange(1, 3),
});

const createCore = (): Core => ({
  id: nextId('core'),
  x: randRange(CORE_RADIUS + 20, ARENA_WIDTH - CORE_RADIUS - 20),
  y: randRange(CORE_RADIUS + 20, ARENA_HEIGHT - CORE_RADIUS - 20),
  radius: CORE_RADIUS,
  value: CORE_VALUE,
  pulsePhase: Math.random() * Math.PI * 2,
  hue: randRange(180, 260),
});

const createBotsForMode = (mode: GameMode): Bot[] => {
  if (mode === 'solo') {
    return Array.from({ length: SOLO_BOT_COUNT }, () => createBot(null, SOLO_ENEMY_COLOR));
  }
  const allies = Array.from({ length: DUO_ALLY_COUNT }, () => createBot('A', TEAM_COLORS.A));
  const enemies = Array.from({ length: DUO_ENEMY_COUNT }, () => createBot('B', TEAM_COLORS.B));
  return [...allies, ...enemies];
};

const createInitialGameState = (mode: GameMode, equippedPowerups: PowerupId[] = []): GameState => {
  const player = createPlayer(mode);
  if (equippedPowerups.includes('aegis-bloom')) {
    player.maxHealth += 35;
    player.health = player.maxHealth;
  }
  return {
    mode,
    player,
    bots: createBotsForMode(mode),
    projectiles: [],
    cores: Array.from({ length: 3 }, createCore),
    arenaWidth: ARENA_WIDTH,
    arenaHeight: ARENA_HEIGHT,
    elapsedTime: 0,
    lastCoreSpawn: 0,
    coresCaptured: 0,
  };
};

/** Snapshot used both by bot AI (targeting) and projectile collision. */
const getCombatants = (state: GameState): Combatant[] => {
  const list: Combatant[] = [
    {
      id: state.player.id,
      x: state.player.x,
      y: state.player.y,
      radius: state.player.radius,
      team: state.player.team,
      isPlayer: true,
    },
  ];
  state.bots.filter((bot) => bot.health > 0).forEach((bot) => {
    list.push({ id: bot.id, x: bot.x, y: bot.y, radius: bot.radius, team: bot.team, isPlayer: false });
  });
  return list;
};

/* ================================================================
   Component
   ================================================================ */

export const StellarArena: React.FC<Props> = ({ mode: initialMode, walletConnected, equippedPowerups, directive, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<GameMode>(initialMode);

  // Mutable game state lives in a ref so the render loop never waits on React.
  const stateRef = useRef<GameState>(createInitialGameState(initialMode, equippedPowerups));
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    down: false,
  });
  const lastShotRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(performance.now());
  const phaseRef = useRef<MissionPhase>('briefing');
  const completedRef = useRef(false);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);
  const botSpriteRef = useRef<HTMLImageElement | null>(null);

  // Only the values the HUD needs trigger React re-renders. Score/scoreboard
  // update on events (core pickup, kill); health updates every frame for a
  // smooth bar animation.
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(stateRef.current.player.maxHealth);
  const [coreCount, setCoreCount] = useState(3);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [phase, setPhase] = useState<MissionPhase>('briefing');
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [captured, setCaptured] = useState(0);
  const [outcome, setOutcome] = useState('');

  const stars = useMemo<BackgroundStar[]>(
    () =>
      Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * ARENA_WIDTH,
        y: Math.random() * ARENA_HEIGHT,
        radius: randRange(0.4, 1.6),
        twinkleOffset: Math.random() * Math.PI * 2,
        brightness: randRange(0.3, 1),
      })),
    []
  );

  useEffect(() => {
    loadCutoutSprite(playerShipSrc, 'checker', (sprite) => { playerSpriteRef.current = sprite; });
    loadCutoutSprite(botShipSrc, 'white', (sprite) => { botSpriteRef.current = sprite; });
  }, []);

  /* --------------------------- Mode / Reset ------------------------------ */

  const buildScoreboard = useCallback((state: GameState): ScoreboardEntry[] => {
    const entries: ScoreboardEntry[] = [
      { id: state.player.id, label: 'YOU', team: state.player.team, score: state.player.score, isPlayer: true },
      ...state.bots.map((bot, i) => ({
        id: bot.id,
        label: state.mode === 'duo' ? `${bot.team === state.player.team ? 'ALLY' : 'RIVAL'} ${i + 1}` : `BOT ${i + 1}`,
        team: bot.team,
        score: bot.score,
        isPlayer: false,
      })),
    ];
    return entries.sort((a, b) => b.score - a.score);
  }, []);

  const resetMission = useCallback((nextMode: GameMode) => {
    const nextState = createInitialGameState(nextMode, equippedPowerups);
    stateRef.current = nextState;
    lastShotRef.current = 0;
    completedRef.current = false;
    phaseRef.current = 'briefing';
    mouseRef.current.down = false;
    keysRef.current.clear();
    setScore(0);
    setHealth(nextState.player.maxHealth);
    setCoreCount(nextState.cores.length);
    setCaptured(0);
    setTimeLeft(ROUND_SECONDS);
    setScoreboard(buildScoreboard(nextState));
    setOutcome('');
    setPhase('briefing');
  }, [buildScoreboard, equippedPowerups]);

  const beginMission = useCallback(() => {
    resetMission(mode);
    phaseRef.current = 'playing';
    setPhase('playing');
  }, [mode, resetMission]);

  const finishMission = useCallback((result: 'timer' | 'cleared' | 'destroyed' = 'timer') => {
    if (completedRef.current) return;
    completedRef.current = true;
    const state = stateRef.current;
    const standings = buildScoreboard(state);
    const placement = standings.findIndex((entry) => entry.isPlayer) + 1;
    const contractMet = Boolean(directive && state.coresCaptured >= directive.coreGoal);
    const bonus = contractMet && directive ? directive.bonusShards : 0;
    phaseRef.current = 'finished';
    setPhase('finished');
    setScore(state.player.score);
    setCaptured(state.coresCaptured);
    setScoreboard(standings);
    setOutcome(placement === 1 ? 'Victory — your flight owns the arena.' : `Extraction complete — you placed #${placement}.`);
    if (result === 'cleared') setOutcome('Arena cleared — every rival scout was destroyed.');
    if (result === 'destroyed') setOutcome('Hull lost — your flight has been extracted from the arena.');
    onComplete({
      cores: state.coresCaptured,
      shards: state.coresCaptured * 2 + bonus,
      score: state.player.score,
      durationSeconds: ROUND_SECONDS,
      placement,
      won: placement === 1 && result !== 'destroyed',
    });
  }, [buildScoreboard, directive, onComplete]);

  const handleModeChange = useCallback(
    (newMode: GameMode) => {
      if (newMode === mode) return;
      setMode(newMode);
      resetMission(newMode);
    },
    [mode, resetMission]
  );

  // Initialize scoreboard on mount.
  useEffect(() => {
    setScoreboard(buildScoreboard(stateRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------- Input Handling --------------------------- */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') e.preventDefault();
      keysRef.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const getCanvasCoords = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = ARENA_WIDTH / rect.width;
      const scaleY = ARENA_HEIGHT / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      mouseRef.current.x = x;
      mouseRef.current.y = y;
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.down = true;
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const canvas = canvasRef.current;
    canvas?.addEventListener('mousemove', handleMouseMove);
    canvas?.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas?.removeEventListener('mousemove', handleMouseMove);
      canvas?.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  /* ------------------------------ Update -------------------------------- */

  const spawnProjectile = useCallback(
    (
      state: GameState,
      shooter: { id: string; x: number; y: number; angle: number; radius: number; team: Team | null },
      damage = PROJECTILE_DAMAGE
    ) => {
      const colorKey = shooter.team ?? 'neutral';
      const projectile: Projectile = {
        id: nextId('proj'),
        x: shooter.x + Math.cos(shooter.angle) * (shooter.radius + 6),
        y: shooter.y + Math.sin(shooter.angle) * (shooter.radius + 6),
        vx: Math.cos(shooter.angle) * PROJECTILE_SPEED,
        vy: Math.sin(shooter.angle) * PROJECTILE_SPEED,
        radius: PROJECTILE_RADIUS,
        ownerId: shooter.id,
        team: shooter.team,
        color: PROJECTILE_COLORS[colorKey] ?? PROJECTILE_COLORS.neutral,
        damage,
        life: PROJECTILE_LIFE,
      };
      state.projectiles.push(projectile);
    },
    []
  );

  const awardKill = useCallback((state: GameState, killerId: string) => {
    if (killerId === state.player.id) {
      state.player.score += KILL_BONUS;
      return;
    }
    const bot = state.bots.find((b) => b.id === killerId);
    if (bot) bot.score += KILL_BONUS;
  }, []);

  const update = useCallback(
    (dt: number) => {
      if (phaseRef.current !== 'playing') return;
      const state = stateRef.current;
      const { player } = state;
      const keys = keysRef.current;
      const mouse = mouseRef.current;
      let scoreEventFired = false;

      /* --- Player movement (WASD / Arrow keys) --- */
      let moveX = 0;
      let moveY = 0;
      if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
      if (keys.has('s') || keys.has('arrowdown')) moveY += 1;
      if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
      if (keys.has('d') || keys.has('arrowright')) moveX += 1;

      const moveLen = Math.hypot(moveX, moveY);
      if (moveLen > 0) {
        moveX /= moveLen;
        moveY /= moveLen;
      }

      const flightSpeed = equippedPowerups.includes('blink-shift') ? PLAYER_SPEED * 1.25 : PLAYER_SPEED;
      player.vx = moveX * flightSpeed;
      player.vy = moveY * flightSpeed;
      player.x = clamp(player.x + player.vx * dt, player.radius, state.arenaWidth - player.radius);
      player.y = clamp(player.y + player.vy * dt, player.radius, state.arenaHeight - player.radius);

      /* --- Mouse aiming --- */
      player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

      /* --- Player shooting --- */
      if ((mouse.down || keys.has(' ')) && state.elapsedTime - lastShotRef.current >= FIRE_COOLDOWN) {
        spawnProjectile(state, player, equippedPowerups.includes('emp-bloom') ? PROJECTILE_DAMAGE + 8 : PROJECTILE_DAMAGE);
        lastShotRef.current = state.elapsedTime;
      }

      /* --- Bot AI: Solo rivals hunt the player; Duo rivals use team targeting. --- */
      const combatants = getCombatants(state);
      state.bots.forEach((bot) => {
        if (bot.health <= 0) return;

        // Solo is a player-vs-rivals encounter, not bot-vs-bot FFA. This keeps
        // every hostile jet focused on the pilot instead of destroying peers.
        let nearestEnemy: Combatant | null =
          state.mode === 'solo'
            ? { id: player.id, x: player.x, y: player.y, radius: player.radius, team: player.team, isPlayer: true }
            : null;
        let nearestEnemyDist =
          nearestEnemy ? distance(bot.x, bot.y, player.x, player.y) : Infinity;
        if (state.mode !== 'solo') {
          combatants.forEach((c) => {
            if (!isHostile(state.mode, bot.team, bot.id, c.team, c.id)) return;
            const d = distance(bot.x, bot.y, c.x, c.y);
            if (d < nearestEnemyDist) {
              nearestEnemyDist = d;
              nearestEnemy = c;
            }
          });
        }

        // Find nearest stellar core.
        let nearestCore: Core | null = null;
        let nearestCoreDist = Infinity;
        state.cores.forEach((core) => {
          const d = distance(bot.x, bot.y, core.x, core.y);
          if (d < nearestCoreDist) {
            nearestCoreDist = d;
            nearestCore = core;
          }
        });

        const enemyTarget = nearestEnemy as Combatant | null;
        const coreTarget = nearestCore as Core | null;

        if (enemyTarget && nearestEnemyDist <= BOT_VISION_RANGE) {
          /* --- Chase & shoot the closest enemy ship --- */
          bot.behavior = 'chase-enemy';
          bot.targetId = enemyTarget.id;
          bot.angle = Math.atan2(enemyTarget.y - bot.y, enemyTarget.x - bot.x);

          if (nearestEnemyDist > BOT_FIRE_RANGE * 0.75) {
            bot.vx = Math.cos(bot.angle) * BOT_SPEED;
            bot.vy = Math.sin(bot.angle) * BOT_SPEED;
          } else {
            bot.vx = 0;
            bot.vy = 0;
          }

          if (nearestEnemyDist <= BOT_FIRE_RANGE && state.elapsedTime - bot.lastShot >= BOT_FIRE_COOLDOWN) {
            spawnProjectile(state, bot);
            bot.lastShot = state.elapsedTime;
          }
        } else if (coreTarget) {
          /* --- Pathfind toward the nearest Stellar Core --- */
          bot.behavior = 'seek-core';
          bot.targetId = coreTarget.id;
          bot.angle = Math.atan2(coreTarget.y - bot.y, coreTarget.x - bot.x);
          bot.vx = Math.cos(bot.angle) * BOT_SPEED;
          bot.vy = Math.sin(bot.angle) * BOT_SPEED;
        } else {
          /* --- Nothing to do — wander --- */
          bot.behavior = 'wander';
          bot.targetId = null;
          bot.wanderTimer -= dt;
          if (bot.wanderTimer <= 0) {
            bot.wanderAngle = randRange(0, Math.PI * 2);
            bot.wanderTimer = randRange(1.5, 3.5);
          }
          bot.angle = bot.wanderAngle;
          bot.vx = Math.cos(bot.wanderAngle) * (BOT_SPEED * 0.5);
          bot.vy = Math.sin(bot.wanderAngle) * (BOT_SPEED * 0.5);
        }

        let nx = bot.x + bot.vx * dt;
        let ny = bot.y + bot.vy * dt;
        if (nx < bot.radius || nx > state.arenaWidth - bot.radius) {
          bot.wanderAngle = Math.PI - bot.wanderAngle;
          nx = clamp(nx, bot.radius, state.arenaWidth - bot.radius);
        }
        if (ny < bot.radius || ny > state.arenaHeight - bot.radius) {
          bot.wanderAngle = -bot.wanderAngle;
          ny = clamp(ny, bot.radius, state.arenaHeight - bot.radius);
        }
        bot.x = nx;
        bot.y = ny;
      });

      /* --- Projectiles: move, expire, and resolve hits --- */
      state.projectiles = state.projectiles.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;

        const inBounds =
          p.x > -20 && p.x < state.arenaWidth + 20 && p.y > -20 && p.y < state.arenaHeight + 20;
        if (!inBounds || p.life <= 0) return false;

        if (
          isHostile(state.mode, p.team, p.ownerId, player.team, player.id) &&
          distance(p.x, p.y, player.x, player.y) <= p.radius + player.radius
        ) {
          player.health -= p.damage;
          if (player.health <= 0) {
            player.health = 0;
            awardKill(state, p.ownerId);
            scoreEventFired = true;
          }
          return false;
        }

        for (const bot of state.bots) {
          if (bot.health <= 0) continue;
          // In Solo, hostile shots are reserved for the player. Rival ships do
          // not erase one another before the pilot gets a real dogfight.
          if (state.mode === 'solo' && p.ownerId !== player.id) continue;
          if (!isHostile(state.mode, p.team, p.ownerId, bot.team, bot.id)) continue;
          if (distance(p.x, p.y, bot.x, bot.y) <= p.radius + bot.radius) {
            bot.health -= p.damage;
            if (bot.health <= 0) {
              bot.health = 0;
              bot.vx = 0;
              bot.vy = 0;
              awardKill(state, p.ownerId);
              scoreEventFired = true;
            }
            return false;
          }
        }

        return true;
      });

      if (player.health <= 0) {
        setHealth(0);
        finishMission('destroyed');
        return;
      }

      const livingRivals = state.bots.some((bot) => bot.health > 0 && isHostile(state.mode, player.team, player.id, bot.team, bot.id));
      if (!livingRivals) {
        finishMission('cleared');
        return;
      }

      /* --- Stellar Core spawning --- */
      if (
        state.elapsedTime - state.lastCoreSpawn >= CORE_SPAWN_INTERVAL &&
        state.cores.length < MAX_CORES
      ) {
        state.cores.push(createCore());
        state.lastCoreSpawn = state.elapsedTime;
      }
      state.cores.forEach((core) => {
        core.pulsePhase += dt * 2.4;
      });

      /* --- Core collection: player AND bots can collect --- */
      const collected: string[] = [];
      state.cores.forEach((core) => {
        if (distance(player.x, player.y, core.x, core.y) <= player.radius + core.radius) {
          player.score += core.value;
          state.coresCaptured += 1;
          collected.push(core.id);
          return;
        }
        for (const bot of state.bots) {
          if (bot.health <= 0) continue;
          if (distance(bot.x, bot.y, core.x, core.y) <= bot.radius + core.radius) {
            bot.score += core.value;
            collected.push(core.id);
            break;
          }
        }
      });
      if (collected.length > 0) {
        state.cores = state.cores.filter((c) => !collected.includes(c.id));
        setCoreCount(state.cores.length);
        scoreEventFired = true;
      }

      state.elapsedTime += dt;
      setHealth(player.health);
      setTimeLeft(Math.max(0, Math.ceil(ROUND_SECONDS - state.elapsedTime)));
      setCaptured(state.coresCaptured);
      if (scoreEventFired) {
        setScore(player.score);
        setScoreboard(buildScoreboard(state));
      }
      if (state.elapsedTime >= ROUND_SECONDS) finishMission();
    },
    [spawnProjectile, awardKill, buildScoreboard, equippedPowerups, finishMission]
  );

  /* ------------------------------- Draw ---------------------------------- */

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const state = stateRef.current;

      const gradient = ctx.createRadialGradient(
        ARENA_WIDTH / 2,
        ARENA_HEIGHT / 2,
        60,
        ARENA_WIDTH / 2,
        ARENA_HEIGHT / 2,
        ARENA_WIDTH
      );
      gradient.addColorStop(0, '#0b1224');
      gradient.addColorStop(1, '#04060d');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      stars.forEach((star) => {
        const twinkle = 0.5 + 0.5 * Math.sin(state.elapsedTime * 2 + star.twinkleOffset);
        ctx.globalAlpha = star.brightness * (0.4 + 0.6 * twinkle);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(94, 234, 212, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= ARENA_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARENA_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= ARENA_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA_WIDTH, y);
        ctx.stroke();
      }

      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#5eead4';
      ctx.shadowBlur = 12;
      ctx.strokeRect(2, 2, ARENA_WIDTH - 4, ARENA_HEIGHT - 4);
      ctx.shadowBlur = 0;

      state.cores.forEach((core) => {
        const pulse = 0.75 + 0.25 * Math.sin(core.pulsePhase);
        const r = core.radius * pulse;
        ctx.save();
        ctx.shadowColor = `hsl(${core.hue}, 90%, 65%)`;
        ctx.shadowBlur = 20;
        ctx.fillStyle = `hsl(${core.hue}, 90%, 65%)`;
        ctx.beginPath();
        ctx.arc(core.x, core.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = `hsla(${core.hue}, 90%, 85%, 0.6)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(core.x, core.y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      });

      state.bots.forEach((bot) => {
        if (bot.health <= 0) return;
        if (bot.behavior === 'chase-enemy' && bot.targetId) {
          const target =
            bot.targetId === state.player.id
              ? state.player
              : state.bots.find((b) => b.id === bot.targetId);
          if (target) {
            ctx.save();
            ctx.strokeStyle = 'rgba(251, 146, 60, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.moveTo(bot.x, bot.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.rotate(bot.angle + BOT_SPRITE_ROTATION_OFFSET);
        ctx.shadowColor = bot.color;
        ctx.shadowBlur = 10;
        if (botSpriteRef.current?.complete) {
          ctx.drawImage(botSpriteRef.current, -BOT_SPRITE_RENDER_SIZE / 2, -BOT_SPRITE_RENDER_SIZE / 2, BOT_SPRITE_RENDER_SIZE, BOT_SPRITE_RENDER_SIZE);
        } else {
          ctx.fillStyle = bot.color;
          ctx.beginPath();
          ctx.moveTo(bot.radius, 0);
          ctx.lineTo(-bot.radius * 0.8, bot.radius * 0.75);
          ctx.lineTo(-bot.radius * 0.8, -bot.radius * 0.75);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        const barWidth = bot.radius * 2.2;
        const healthRatio = clamp(bot.health / bot.maxHealth, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bot.x - barWidth / 2, bot.y - bot.radius - 12, barWidth, 4);
        ctx.fillStyle = bot.color;
        ctx.fillRect(bot.x - barWidth / 2, bot.y - bot.radius - 12, barWidth * healthRatio, 4);
      });

      state.projectiles.forEach((p) => {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      const { player } = state;
      if (player.health > 0) {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle + PLAYER_SPRITE_ROTATION_OFFSET);
        ctx.shadowColor = player.color;
        ctx.shadowBlur = 16;
        if (playerSpriteRef.current?.complete) {
          ctx.drawImage(playerSpriteRef.current, -PLAYER_SPRITE_RENDER_SIZE / 2, -PLAYER_SPRITE_RENDER_SIZE / 2, PLAYER_SPRITE_RENDER_SIZE, PLAYER_SPRITE_RENDER_SIZE);
        } else {
          ctx.fillStyle = player.color;
          ctx.beginPath();
          ctx.moveTo(player.radius * 1.2, 0);
          ctx.lineTo(-player.radius * 0.9, player.radius * 0.85);
          ctx.lineTo(-player.radius * 0.4, 0);
          ctx.lineTo(-player.radius * 0.9, -player.radius * 0.85);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },
    [stars]
  );

  /* ---------------------------- Game Loop -------------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    lastFrameRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;

      update(dt);
      draw(ctx);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [update, draw]);

  /* -------------------------------- UI ------------------------------------ */

  const teamAScore =
    mode === 'duo'
      ? scoreboard.filter((e) => e.team === 'A').reduce((sum, e) => sum + e.score, 0)
      : 0;
  const teamBScore =
    mode === 'duo'
      ? scoreboard.filter((e) => e.team === 'B').reduce((sum, e) => sum + e.score, 0)
      : 0;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        background: '#04060d',
        minHeight: '100vh',
        fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: ARENA_WIDTH, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, color: '#e2e8f0' }}>
        <div><b style={{ display: 'block', color: '#5eead4', letterSpacing: 1.5, fontSize: 13 }}>COSMIC CAPTURE // 90 SECOND BRAWL</b><span style={{ color: '#94a3b8', fontSize: 12 }}>Collect glowing cores for +10, blast rivals for +15, and lead the board when the clock reaches zero. {walletConnected ? 'Wallet-linked results are saved after extraction.' : 'Guest mode is live — connect a wallet to queue Testnet rewards.'}</span></div>
        <button onClick={beginMission} style={{ border: '1px solid #5eead4', background: phase === 'playing' ? '#173440' : '#5eead4', color: phase === 'playing' ? '#a5f3fc' : '#061018', fontWeight: 900, padding: '10px 14px', cursor: phase === 'playing' ? 'default' : 'pointer', whiteSpace: 'nowrap' }} disabled={phase === 'playing'}>{phase === 'finished' ? 'PLAY AGAIN' : phase === 'playing' ? 'MISSION LIVE' : 'START MISSION'}</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['solo', 'duo'] as GameMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            disabled={phase === 'playing'}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: `1px solid ${mode === m ? '#5eead4' : 'rgba(148,163,184,0.3)'}`,
              background: mode === m ? 'rgba(94, 234, 212, 0.12)' : 'rgba(15, 23, 42, 0.6)',
              color: mode === m ? '#5eead4' : '#94a3b8',
              fontFamily: "'Orbitron', 'Segoe UI', sans-serif",
              fontSize: 12,
              letterSpacing: 1.5,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {m === 'solo' ? 'SOLO — FREE FOR ALL' : 'DUO — 2v2 TEAMS'}
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: ARENA_WIDTH,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            pointerEvents: 'none',
            zIndex: 2,
            fontFamily: "'Orbitron', 'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              background: 'rgba(4, 8, 20, 0.7)',
              border: '1px solid rgba(94, 234, 212, 0.4)',
              borderRadius: 6,
              padding: '8px 14px',
              color: '#5eead4',
              letterSpacing: 1,
              fontSize: 14,
            }}
          >
            TIME&nbsp;&nbsp;<span style={{ color: '#fef3c7', fontWeight: 700 }}>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span>
            <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
            SCORE&nbsp;&nbsp;<span style={{ color: '#e2e8f0', fontWeight: 700 }}>{score}</span>
            <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
            CORES&nbsp;&nbsp;<span style={{ color: '#e2e8f0', fontWeight: 700 }}>{captured}</span><span style={{ color: '#64748b' }}> / {coreCount} live</span>
            {mode === 'duo' && (
              <>
                <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
                <span style={{ color: TEAM_COLORS.A }}>TEAM A {teamAScore}</span>
                <span style={{ margin: '0 6px', opacity: 0.3 }}>vs</span>
                <span style={{ color: TEAM_COLORS.B }}>TEAM B {teamBScore}</span>
              </>
            )}
          </div>

          <div
            style={{
              background: 'rgba(4, 8, 20, 0.7)',
              border: '1px solid rgba(244, 114, 182, 0.4)',
              borderRadius: 6,
              padding: '8px 14px',
              minWidth: 140,
            }}
          >
            <div style={{ color: '#f472b6', fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
              HULL INTEGRITY
            </div>
            <div
              style={{
                width: '100%',
                height: 6,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(health / stateRef.current.player.maxHealth) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #f472b6, #fca5f0)',
                  transition: 'width 0.15s ease-out',
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 68,
            right: 12,
            zIndex: 2,
            background: 'rgba(4, 8, 20, 0.7)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 6,
            padding: '8px 12px',
            minWidth: 150,
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>
            LEADERBOARD
          </div>
          {scoreboard.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
                color: entry.isPlayer ? '#e2e8f0' : '#94a3b8',
                fontWeight: entry.isPlayer ? 700 : 400,
                marginBottom: 3,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: entry.team ? TEAM_COLORS[entry.team] : SOLO_ENEMY_COLOR,
                    display: 'inline-block',
                  }}
                />
                {entry.label}
              </span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          aria-label="Playable Cosmic Capture arena. Move with WASD or arrow keys, aim with pointer, and press Space or hold pointer to fire."
          onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); mouseRef.current.x = (event.clientX - rect.left) * ARENA_WIDTH / rect.width; mouseRef.current.y = (event.clientY - rect.top) * ARENA_HEIGHT / rect.height; }}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); mouseRef.current.down = true; }}
          onPointerUp={() => { mouseRef.current.down = false; }}
          onPointerCancel={() => { mouseRef.current.down = false; }}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: 8,
            cursor: 'crosshair',
            touchAction: 'none',
            boxShadow: '0 0 40px rgba(94, 234, 212, 0.15)',
          }}
        />
        {directive && <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 2, maxWidth: 440, pointerEvents: 'none', background: 'rgba(4, 8, 20, 0.82)', border: '1px solid rgba(94,234,212,.45)', padding: '8px 11px', color: '#dbeafe', fontSize: 11, lineHeight: 1.4 }}><b style={{ color: '#5eead4', display: 'block', fontSize: 10, letterSpacing: 1 }}>KIRA CONTRACT // {captured}/{directive.coreGoal} CORES · +{directive.bonusShards} ASTRA</b>{directive.text}</div>}
        {phase !== 'playing' && <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'grid', placeItems: 'center', textAlign: 'center', background: 'rgba(3,5,15,.64)', color: '#fff', padding: 30 }}><div style={{ maxWidth: 510 }}><span style={{ color: '#5eead4', fontSize: 11, letterSpacing: 2 }}>{phase === 'finished' ? 'MATCH RESULT' : 'HOW TO WIN'}</span><h2 style={{ fontSize: 38, margin: '10px 0' }}>{phase === 'finished' ? outcome : 'CAPTURE CORES. SHOOT RIVALS. TOP THE BOARD.'}</h2><p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{phase === 'finished' ? `You captured ${captured} cores. Your match is now queued for wallet-aware Testnet verification.` : 'One hull only: destroyed ships stay out. Move with WASD or arrow keys, aim with mouse or finger, then press Space or hold click/touch to fire. Every core is +10 and every takedown is +15.'}</p><button onClick={beginMission} style={{ marginTop: 8, background: '#5eead4', color: '#061018', border: 0, padding: '12px 18px', fontWeight: 900, cursor: 'pointer' }}>{phase === 'finished' ? 'RUN IT BACK' : 'LAUNCH ARENA'}</button></div></div>}
      </div>

      <div
        style={{
          color: '#64748b',
          fontSize: 13,
          letterSpacing: 0.5,
          textAlign: 'center',
        }}
      >
        WASD / Arrow Keys to move &nbsp;•&nbsp; Mouse to aim &nbsp;•&nbsp; Click to fire &nbsp;•&nbsp;
        Fly into glowing cores to collect them
        <br />
        Solo: every bot is hostile &nbsp;•&nbsp; Duo: cyan fights alongside you against magenta
      </div>
    </div>
  );
};

export default StellarArena;
