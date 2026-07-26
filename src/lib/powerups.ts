export type PowerupId = 'aegis-bloom' | 'blink-shift' | 'emp-bloom'

export type Powerup = {
  id: PowerupId
  name: string
  priceXlm: number
  image: string
  kicker: string
  description: string
  effect: string
  tone: 'cyan' | 'pink' | 'gold'
}

export const powerups: Powerup[] = [
  {
    id: 'aegis-bloom',
    name: 'Aegis Bloom',
    priceXlm: 1.5,
    image: '/art/powerups/aegis-bloom.png',
    kicker: 'DEFENSE MODULE',
    description: 'A crystalline shrine ward tuned to Sora’s hull.',
    effect: '+35 starting hull integrity',
    tone: 'cyan',
  },
  {
    id: 'blink-shift',
    name: 'Blink Shift',
    priceXlm: 2.25,
    image: '/art/powerups/blink-shift.png',
    kicker: 'MOBILITY MODULE',
    description: 'A pocket rift beacon for sharper core rotations.',
    effect: '+25% flight speed',
    tone: 'pink',
  },
  {
    id: 'emp-bloom',
    name: 'EMP Bloom',
    priceXlm: 2.75,
    image: '/art/powerups/emp-bloom.png',
    kicker: 'OFFENSE MODULE',
    description: 'A compact star pulse that hits rival shields harder.',
    effect: '+8 player projectile damage',
    tone: 'gold',
  },
]

export function powerupById(id: PowerupId) {
  return powerups.find((powerup) => powerup.id === id)
}
