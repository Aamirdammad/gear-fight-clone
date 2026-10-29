export const ROWS = 4
export const COLS = 5
export const CORE = { row: 1, col: 2 }
export const MAX_WAVES = 10
export const LANES = 3
export const LOADOUT_SIZE = 3
export const START_LIVES = 16
export const START_COINS = 28
export const WAVE_LEAK_LIMIT = 13

export type Rank = 1 | 2 | 4
export type GearId = 'cog' | 'scout' | 'rogue' | 'spark' | 'guard' | 'anchor' | 'booster' | 'mender' | 'bolt'
export type UnitKind = 'scout' | 'rogue' | 'spark' | 'guard' | 'anchor'
export type EnemyKind = 'rusher' | 'archer' | 'tank' | 'swarm' | 'freezer' | 'boss'
export type Role = 'production' | 'brawler' | 'tank' | 'support' | 'spell'

export type GearDef = {
  id: GearId
  title: string
  mark: string
  cost: number
  color: string
  role: Role
  detail: string
  spawns?: UnitKind
  spawnMs?: number
  hp?: number
  dmg?: number
  speed?: number
  spell?: 'bolt'
  spellMs?: number
  heal?: number
  healMs?: number
}

export type Gear = {
  id: GearId
  rank: Rank
}

export const gearBook: Record<GearId, GearDef> = {
  cog: {
    id: 'cog',
    title: 'Cog',
    mark: 'C',
    cost: 10,
    color: '#d7dde8',
    role: 'production',
    detail: 'Speeds the whole machine',
  },
  scout: {
    id: 'scout',
    title: 'Scout',
    mark: 'S',
    cost: 6,
    color: '#35d75f',
    role: 'brawler',
    detail: 'Cheap and fast',
    spawns: 'scout',
    spawnMs: 900,
    hp: 16,
    dmg: 5,
    speed: 0.22,
  },
  rogue: {
    id: 'rogue',
    title: 'Rogue',
    mark: 'R',
    cost: 8,
    color: '#ff4ea3',
    role: 'brawler',
    detail: 'Medium striker',
    spawns: 'rogue',
    spawnMs: 1250,
    hp: 15,
    dmg: 8,
    speed: 0.24,
  },
  spark: {
    id: 'spark',
    title: 'Spark',
    mark: 'Z',
    cost: 12,
    color: '#ffd456',
    role: 'brawler',
    detail: 'Slow, heavy hits',
    spawns: 'spark',
    spawnMs: 1900,
    hp: 14,
    dmg: 14,
    speed: 0.2,
  },
  guard: {
    id: 'guard',
    title: 'Guard',
    mark: 'G',
    cost: 9,
    color: '#4ed2ff',
    role: 'tank',
    detail: 'Slow wall',
    spawns: 'guard',
    spawnMs: 1700,
    hp: 40,
    dmg: 3,
    speed: 0.14,
  },
  anchor: {
    id: 'anchor',
    title: 'Anchor',
    mark: 'A',
    cost: 11,
    color: '#7b8cff',
    role: 'tank',
    detail: 'Heavier wall',
    spawns: 'anchor',
    spawnMs: 2100,
    hp: 62,
    dmg: 4,
    speed: 0.11,
  },
  booster: {
    id: 'booster',
    title: 'Boost',
    mark: 'x',
    cost: 9,
    color: '#f4d6a0',
    role: 'support',
    detail: 'Buffs adjacent units',
  },
  mender: {
    id: 'mender',
    title: 'Mender',
    mark: '+',
    cost: 10,
    color: '#9dffb0',
    role: 'support',
    detail: 'Heals its lane',
    heal: 6,
    healMs: 1100,
  },
  bolt: {
    id: 'bolt',
    title: 'Bolt',
    mark: 'B',
    cost: 11,
    color: '#ff9a3c',
    role: 'spell',
    detail: 'Line shot, no bodies',
    spell: 'bolt',
    spellMs: 1200,
    dmg: 9,
  },
}

export const kitGears: GearId[] = ['scout', 'rogue', 'spark', 'guard', 'anchor', 'booster', 'mender', 'bolt']

export const STARTER_GEARS: GearId[] = ['scout', 'guard', 'booster']

export const UNLOCK_ORDER: GearId[] = ['rogue', 'spark', 'anchor', 'mender', 'bolt']

export const waves = [
  { name: 'Meadow Rush', reward: 12, job: 'Fast melee from every lane' },
  { name: 'Backline Bows', reward: 14, job: 'Archers hold and shoot' },
  { name: 'Shield Wall', reward: 16, job: 'Tanks in mid, swarm on flanks' },
  { name: 'Frost Bite', reward: 18, job: 'Freezers slow the spinner' },
  { name: 'Split Push', reward: 18, job: 'One packed lane, two quiet ones' },
  { name: 'Rain of Bolts', reward: 20, job: 'Archer volleys plus rushers' },
  { name: 'Iron Line', reward: 22, job: 'Tanks in every lane' },
  { name: 'Deep Freeze', reward: 24, job: 'Freezers plus a mid tank' },
  { name: 'Siege Mix', reward: 26, job: 'Bows, armor, and swarm' },
  { name: 'Nimbus Siege', reward: 40, job: 'Boss plus mixed jobs' },
] as const

export const nextRank = (rank: Rank): Rank | null => (rank === 1 ? 2 : rank === 2 ? 4 : null)

export const rankValue = (rank: Rank) => (rank === 4 ? 4 : rank)

export const cogBonus = (rank: Rank) => (rank === 1 ? 0.25 : rank === 2 ? 0.55 : 1.2)

export const spawnRankMul = (rank: Rank) => (rank === 1 ? 1 : rank === 2 ? 1.45 : 2.1)

export const statRankMul = (rank: Rank) => (rank === 1 ? 1 : rank === 2 ? 1.5 : 2.2)

export const sellValue = (gear: Gear) => Math.floor(gearBook[gear.id].cost * rankValue(gear.rank) * 0.6)

export const isCore = (row: number, col: number) => row === CORE.row && col === CORE.col

export const neighbors = (row: number, col: number) =>
  [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS)

export const laneForRow = (row: number): 0 | 1 | 2 => (row <= 0 ? 0 : row >= 3 ? 2 : 1)

export const emptyGrid = (): (Gear | null)[][] =>
  Array.from({ length: ROWS }, () => Array.from<Gear | null>({ length: COLS }).fill(null))

export const rollUnitShop = (pool: GearId[]): GearId[] => {
  const source = pool.length ? pool : STARTER_GEARS
  return Array.from({ length: 3 }, () => source[Math.floor(Math.random() * source.length)])
}

export const lockedKeys = (wave: number): Set<string> => {
  const keys = new Set<string>()
  if (wave >= 3) {
    keys.add('0-0')
    keys.add('0-4')
  }
  if (wave >= 5) {
    keys.add('3-0')
    keys.add('3-4')
  }
  if (wave >= 7) {
    keys.add('0-1')
    keys.add('3-3')
  }
  if (wave >= 9) {
    keys.add('2-4')
    keys.add('3-1')
  }
  return keys
}

export const isLocked = (row: number, col: number, wave: number) =>
  !isCore(row, col) && lockedKeys(wave).has(`${row}-${col}`)

export const unlockForClear = (wave: number): GearId | null => {
  if (wave % 2 !== 0) return null
  return UNLOCK_ORDER[wave / 2 - 1] ?? null
}

export const unlockWaveFor = (id: GearId): number | null => {
  const index = UNLOCK_ORDER.indexOf(id)
  return index < 0 ? null : (index + 1) * 2
}
