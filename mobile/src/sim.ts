import {
  CORE,
  COLS,
  ROWS,
  cogBonus,
  gearBook,
  isCore,
  laneForRow,
  neighbors,
  nextRank,
  spawnRankMul,
  statRankMul,
  type EnemyKind,
  type Gear,
  type Rank,
  type UnitKind,
} from './catalog'

export type Team = 'player' | 'enemy'

export type Fighter = {
  id: string
  team: Team
  lane: 0 | 1 | 2
  x: number
  hp: number
  maxHp: number
  dmg: number
  speed: number
  kind: string
  mark: string
  color: string
  ranged: boolean
  holdX: number
  strikeCd: number
  size: number
}

export type Shot = {
  id: string
  team: Team
  lane: 0 | 1 | 2
  x: number
  speed: number
  dmg: number
}

export type FloatText = {
  id: string
  lane: 0 | 1 | 2
  x: number
  text: string
  life: number
}

export type WaveEvent = {
  t: number
  lane: 0 | 1 | 2
  kind: EnemyKind
}

export type BattleState = {
  time: number
  fighters: Fighter[]
  shots: Shot[]
  floats: FloatText[]
  spawnCd: number[]
  queue: WaveEvent[]
  leaks: number
  kills: number
  won: boolean | null
  slow: number
}

export type Machine = {
  powered: Set<string>
  production: number
  spin: number
  labels: string[]
}

let seq = 1
const uid = (prefix: string) => `${prefix}${seq++}`

const enemyStats: Record<
  EnemyKind,
  { hp: number; dmg: number; speed: number; mark: string; color: string; ranged: boolean; holdX: number; size: number }
> = {
  rusher: { hp: 12, dmg: 4, speed: 0.2, mark: 'w', color: '#8e4929', ranged: false, holdX: 0.12, size: 28 },
  swarm: { hp: 7, dmg: 3, speed: 0.26, mark: 's', color: '#6b3a28', ranged: false, holdX: 0.12, size: 22 },
  archer: { hp: 14, dmg: 5, speed: 0.12, mark: 'a', color: '#5c2e86', ranged: true, holdX: 0.72, size: 30 },
  tank: { hp: 48, dmg: 5, speed: 0.09, mark: 'T', color: '#4a5560', ranged: false, holdX: 0.12, size: 40 },
  freezer: { hp: 22, dmg: 4, speed: 0.13, mark: 'f', color: '#7ad7ff', ranged: false, holdX: 0.12, size: 32 },
  boss: { hp: 120, dmg: 9, speed: 0.08, mark: 'B', color: '#3b0d2a', ranged: false, holdX: 0.12, size: 52 },
}

const cellKey = (row: number, col: number) => row * COLS + col

export const getPowered = (grid: (Gear | null)[][]) => {
  const powered = new Set<string>()
  const visited = new Set<string>([`${CORE.row}-${CORE.col}`])
  const queue: Array<[number, number]> = [[CORE.row, CORE.col]]

  while (queue.length) {
    const [row, col] = queue.shift()!
    for (const [nextRow, nextCol] of neighbors(row, col)) {
      const key = `${nextRow}-${nextCol}`
      if (visited.has(key) || !grid[nextRow][nextCol]) continue
      visited.add(key)
      powered.add(key)
      queue.push([nextRow, nextCol])
    }
  }

  return powered
}

const boosterMul = (grid: (Gear | null)[][], powered: Set<string>, row: number, col: number) =>
  neighbors(row, col).reduce((boost, [nextRow, nextCol]) => {
    const gear = grid[nextRow][nextCol]
    if (!gear || gear.id !== 'booster' || !powered.has(`${nextRow}-${nextCol}`)) return boost
    return boost + 0.32 * (gear.rank === 4 ? 4 : gear.rank)
  }, 1)

export const inspectMachine = (grid: (Gear | null)[][]): Machine => {
  const powered = getPowered(grid)
  let production = 1
  const labels: string[] = []

  grid.forEach((rowCells, row) => {
    rowCells.forEach((gear, col) => {
      if (!gear || !powered.has(`${row}-${col}`)) return
      if (gear.id === 'cog') {
        production += cogBonus(gear.rank)
        labels.push(`Cog r${gear.rank}`)
      }
    })
  })

  return {
    powered,
    production,
    spin: Math.min(3.4, 0.7 + production * 0.9),
    labels,
  }
}

const makePlayer = (kind: UnitKind, lane: 0 | 1 | 2, rank: Rank, dmgMul: number): Fighter => {
  const def = gearBook[kind]
  const stats = statRankMul(rank)
  return {
    id: uid('p'),
    team: 'player',
    lane,
    x: 0.1,
    hp: Math.round((def.hp ?? 12) * stats),
    maxHp: Math.round((def.hp ?? 12) * stats),
    dmg: Math.round((def.dmg ?? 4) * stats * dmgMul),
    speed: def.speed ?? 0.2,
    kind,
    mark: def.mark,
    color: def.color,
    ranged: false,
    holdX: 0.88,
    strikeCd: 0,
    size: kind === 'guard' ? 36 : 28,
  }
}

const makeEnemy = (kind: EnemyKind, lane: 0 | 1 | 2): Fighter => {
  const def = enemyStats[kind]
  return {
    id: uid('e'),
    team: 'enemy',
    lane,
    x: 0.9,
    hp: def.hp,
    maxHp: def.hp,
    dmg: def.dmg,
    speed: def.speed,
    kind,
    mark: def.mark,
    color: def.color,
    ranged: def.ranged,
    holdX: def.holdX,
    strikeCd: kind === 'archer' ? 0.4 : 0,
    size: def.size,
  }
}

const laneEvents = (wave: number): WaveEvent[] => {
  const push = (list: WaveEvent[], t: number, lane: 0 | 1 | 2, kind: EnemyKind) => {
    list.push({ t, lane, kind })
  }
  const events: WaveEvent[] = []

  if (wave === 1) {
    for (let i = 0; i < 16; i += 1) push(events, i * 0.55, (i % 3) as 0 | 1 | 2, 'rusher')
  } else if (wave === 2) {
    push(events, 0.2, 0, 'archer')
    push(events, 0.4, 1, 'archer')
    push(events, 0.6, 2, 'archer')
    push(events, 3.2, 1, 'rusher')
    push(events, 4.0, 0, 'rusher')
    push(events, 4.4, 2, 'rusher')
    push(events, 6.2, 0, 'archer')
    push(events, 6.6, 2, 'archer')
    push(events, 7.5, 1, 'rusher')
  } else if (wave === 3) {
    push(events, 0.3, 1, 'tank')
    for (let i = 0; i < 8; i += 1) push(events, 0.5 + i * 0.55, (i % 2 === 0 ? 0 : 2) as 0 | 1 | 2, 'swarm')
    push(events, 5.2, 1, 'tank')
    push(events, 6.0, 0, 'rusher')
    push(events, 6.2, 2, 'rusher')
  } else if (wave === 4) {
    push(events, 0.2, 0, 'freezer')
    push(events, 0.6, 2, 'freezer')
    push(events, 1.4, 1, 'rusher')
    push(events, 2.8, 1, 'freezer')
    push(events, 3.6, 0, 'swarm')
    push(events, 3.9, 2, 'swarm')
    push(events, 5.4, 0, 'freezer')
    push(events, 5.8, 2, 'freezer')
    push(events, 7.0, 1, 'tank')
  } else {
    push(events, 0.2, 1, 'boss')
    push(events, 1.0, 0, 'rusher')
    push(events, 1.2, 2, 'rusher')
    push(events, 2.4, 0, 'archer')
    push(events, 2.8, 2, 'archer')
    push(events, 4.6, 0, 'swarm')
    push(events, 4.8, 2, 'swarm')
    push(events, 6.2, 1, 'tank')
    push(events, 7.4, 0, 'rusher')
    push(events, 7.6, 2, 'rusher')
  }

  return events
}

export const failHint = (wave: number, leaks: number, production: number, unitCount: number) => {
  if (unitCount === 0) return 'No powered unit gear was connected to the spinner.'
  if (production < 1.2 && wave >= 3) return 'Merge Cogs so the machine actually spins faster.'
  if (wave === 2) return 'Archers hold the back. You need bodies walking into their lane.'
  if (wave === 3) return 'Tanks eat cheap scouts. Mix Guard with damage.'
  if (wave === 4) return 'Freezers slow the spinner. Kill them or the factory stalls.'
  if (wave === 5) return 'The boss needs a mixed board, not one stacked lane.'
  if (leaks > 0) return 'An empty lane leaked. Cover all three rows from the core.'
  return 'Rebuild the chain from the spinner and merge pairs.'
}

export const createBattle = (wave: number): BattleState => ({
  time: 0,
  fighters: [],
  shots: [],
  floats: [],
  spawnCd: Array.from({ length: ROWS * COLS }, () => 0.25 + Math.random() * 0.2),
  queue: laneEvents(wave),
  leaks: 0,
  kills: 0,
  won: null,
  slow: 1,
})

const countLane = (fighters: Fighter[], team: Team, lane: number) =>
  fighters.reduce((sum, unit) => sum + (unit.team === team && unit.lane === lane ? 1 : 0), 0)

const addFloat = (state: BattleState, lane: 0 | 1 | 2, x: number, text: string) => {
  state.floats.push({ id: uid('f'), lane, x, text, life: 0.7 })
}

const hitFighter = (state: BattleState, fighter: Fighter, amount: number) => {
  fighter.hp -= amount
  addFloat(state, fighter.lane, fighter.x, `-${amount}`)
  if (fighter.hp <= 0) {
    if (fighter.team === 'enemy') state.kills += 1
    return true
  }
  return false
}

export const tickBattle = (
  prev: BattleState,
  dt: number,
  grid: (Gear | null)[][],
  machine: Machine,
): BattleState => {
  if (prev.won !== null) return prev

  const time = prev.time + dt
  const state: BattleState = {
    ...prev,
    time,
    fighters: prev.fighters.map((unit) => ({ ...unit })),
    shots: prev.shots.map((shot) => ({ ...shot })),
    floats: prev.floats.map((item) => ({ ...item })),
    spawnCd: [...prev.spawnCd],
    queue: prev.queue.filter((event) => event.t > time),
  }
  state.slow = prev.fighters.some((unit) => unit.kind === 'freezer') ? 0.48 : 1

  const spawned = prev.queue.filter((event) => event.t <= time)
  for (const event of spawned) {
    if (countLane(state.fighters, 'enemy', event.lane) < 7) {
      state.fighters.push(makeEnemy(event.kind, event.lane))
    }
  }

  grid.forEach((rowCells, row) => {
    rowCells.forEach((gear, col) => {
      if (!gear || isCore(row, col) || !machine.powered.has(`${row}-${col}`)) return
      const def = gearBook[gear.id]
      if (!def.spawns || !def.spawnMs) return
      const index = cellKey(row, col)
      const interval = def.spawnMs / 1000 / (machine.production * spawnRankMul(gear.rank) * state.slow)
      state.spawnCd[index] -= dt
      if (state.spawnCd[index] > 0) return
      const lane = laneForRow(row)
      if (countLane(state.fighters, 'player', lane) >= 7) {
        state.spawnCd[index] = 0.2
        return
      }
      const dmgMul = boosterMul(grid, machine.powered, row, col)
      state.fighters.push(makePlayer(def.spawns, lane, gear.rank, dmgMul))
      state.spawnCd[index] = interval
    })
  })

  const byLane: Fighter[][] = [[], [], []]
  for (const unit of state.fighters) byLane[unit.lane].push(unit)

  for (const unit of state.fighters) {
    unit.strikeCd = Math.max(0, unit.strikeCd - dt)
    const foes = byLane[unit.lane].filter((other) => other.team !== unit.team && other.hp > 0)
    const blocker = foes
      .filter((foe) => Math.abs(foe.x - unit.x) < 0.07)
      .sort((a, b) => Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x))[0]

    if (unit.ranged) {
      const reachedHold = unit.team === 'enemy' ? unit.x <= unit.holdX : unit.x >= unit.holdX
      if (!reachedHold) unit.x += (unit.team === 'player' ? 1 : -1) * unit.speed * dt
      else if (unit.strikeCd <= 0) {
        state.shots.push({
          id: uid('s'),
          team: unit.team,
          lane: unit.lane,
          x: unit.x,
          speed: unit.team === 'player' ? 0.55 : -0.55,
          dmg: unit.dmg,
        })
        unit.strikeCd = 1.05
      }
      continue
    }

    if (blocker) {
      if (unit.strikeCd <= 0) {
        const dead = hitFighter(state, blocker, unit.dmg)
        unit.strikeCd = 0.38
        if (dead) unit.x += (unit.team === 'player' ? 0.01 : -0.01)
      }
      continue
    }

    const dir = unit.team === 'player' ? 1 : -1
    unit.x += dir * unit.speed * dt
    if (unit.team === 'player') unit.x = Math.min(0.9, unit.x)
  }

  const liveShots: Shot[] = []
  for (const shot of state.shots) {
    shot.x += shot.speed * dt
    const target = state.fighters
      .filter(
        (unit) =>
          unit.hp > 0 &&
          unit.team !== shot.team &&
          unit.lane === shot.lane &&
          Math.abs(unit.x - shot.x) < 0.04,
      )
      .sort((a, b) => Math.abs(a.x - shot.x) - Math.abs(b.x - shot.x))[0]
    if (target) {
      hitFighter(state, target, shot.dmg)
      continue
    }
    if (shot.x < 0.04 || shot.x > 0.96) {
      if (shot.team === 'enemy' && shot.x < 0.04) state.leaks += 1
      continue
    }
    liveShots.push(shot)
  }
  state.shots = liveShots

  for (const unit of state.fighters) {
    if (unit.team === 'enemy' && unit.x <= 0.05 && unit.hp > 0) {
      unit.hp = 0
      state.leaks += unit.kind === 'boss' ? 4 : unit.kind === 'tank' ? 2 : 1
    }
  }

  state.fighters = state.fighters.filter((unit) => unit.hp > 0)
  state.floats = state.floats
    .map((item) => ({ ...item, life: item.life - dt, x: item.x + (item.text.startsWith('-') ? 0 : 0) }))
    .filter((item) => item.life > 0)

  const remaining = state.queue.length
  if (state.leaks >= 13) state.won = false
  else if (remaining === 0 && !state.fighters.some((unit) => unit.team === 'enemy')) state.won = true

  return state
}

export const canMerge = (a: Gear, b: Gear) => a.id === b.id && a.rank === b.rank && nextRank(a.rank) !== null

export const mergeGears = (a: Gear, b: Gear): Gear | null => {
  if (!canMerge(a, b)) return null
  const rank = nextRank(a.rank)
  return rank ? { id: a.id, rank } : null
}

export const placeGear = (
  grid: (Gear | null)[][],
  row: number,
  col: number,
  gear: Gear | null,
): (Gear | null)[][] =>
  grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, colIndex) => (rowIndex === row && colIndex === col ? gear : cell)),
  )
