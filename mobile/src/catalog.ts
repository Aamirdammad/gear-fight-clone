export const ROWS = 4
export const COLS = 5
export const CORE = { row: 1, col: 2 }
export const MAX_WAVES = 5
export const LANES = 3

export type Rank = 1 | 2 | 4
export type GearId = 'cog' | 'scout' | 'rogue' | 'spark' | 'guard' | 'booster'
export type UnitKind = 'scout' | 'rogue' | 'spark' | 'guard'
export type EnemyKind = 'rusher' | 'archer' | 'tank' | 'swarm' | 'freezer' | 'boss'
export type Role = 'production' | 'brawler' | 'tank' | 'support'

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
  booster: {
    id: 'booster',
    title: 'Boost',
    mark: 'x',
    cost: 9,
    color: '#f4d6a0',
    role: 'support',
    detail: 'Buffs adjacent units',
  },
}

export const unitShopPool: GearId[] = ['scout', 'rogue', 'spark', 'guard', 'booster']

export const waves = [
  { name: 'Meadow Rush', reward: 14, job: 'Fast melee from every lane' },
  { name: 'Backline Bows', reward: 16, job: 'Archers hold and shoot' },
  { name: 'Shield Wall', reward: 19, job: 'Tanks in mid, swarm on flanks' },
  { name: 'Frost Bite', reward: 23, job: 'Freezers slow the spinner' },
  { name: 'Nimbus Siege', reward: 35, job: 'Boss plus mixed jobs' },
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

export const rollUnitShop = (): GearId[] =>
  Array.from({ length: 3 }, () => unitShopPool[Math.floor(Math.random() * unitShopPool.length)])
