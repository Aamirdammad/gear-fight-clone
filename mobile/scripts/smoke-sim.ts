import { emptyGrid, laneForRow, sellValue } from '../src/catalog'
import { createBattle, inspectMachine, mergeGears, placeGear, tickBattle } from '../src/sim'

const merged = mergeGears({ id: 'cog', rank: 1 }, { id: 'cog', rank: 1 })
if (!merged || merged.rank !== 2) throw new Error('rank 1 pair should merge to 2')
if (mergeGears({ id: 'cog', rank: 4 }, { id: 'cog', rank: 4 })) throw new Error('rank 4 should not merge')
if (mergeGears({ id: 'cog', rank: 1 }, { id: 'scout', rank: 1 })) throw new Error('mixed types should not merge')
if (sellValue({ id: 'scout', rank: 2 }) < 1) throw new Error('sell should refund nuts')
if (laneForRow(0) !== 0 || laneForRow(1) !== 1 || laneForRow(3) !== 2) {
  throw new Error('spinner row should feed the middle lane')
}

const grid = emptyGrid()
const withCog = placeGear(grid, 1, 1, { id: 'cog', rank: 2 })
const stacked = [
  [0, 2, 'scout'],
  [1, 3, 'scout'],
  [2, 2, 'guard'],
  [3, 2, 'spark'],
].reduce(
  (next, [row, col, id]) => placeGear(next, Number(row), Number(col), { id: id as 'scout' | 'guard' | 'spark', rank: 2 }),
  withCog,
)
const machine = inspectMachine(stacked)

if (machine.production <= 1) throw new Error('cog should raise production')
if (!machine.powered.has('1-1') || !machine.powered.has('1-3')) {
  throw new Error('chain should power from spinner')
}

let emptyBattle = createBattle(1)
const idle = inspectMachine(emptyGrid())
for (let i = 0; i < 400 && emptyBattle.won === null; i += 1) {
  emptyBattle = tickBattle(emptyBattle, 0.05, emptyGrid(), idle)
}
if (emptyBattle.won !== false || emptyBattle.leaks < 13) {
  throw new Error('an empty factory should leak wave 1')
}

let battle = createBattle(1)
for (let i = 0; i < 1200 && battle.won === null; i += 1) {
  battle = tickBattle(battle, 0.05, stacked, machine)
}

if (battle.won !== true) {
  throw new Error(`stacked board should clear wave 1, got ${JSON.stringify({
    won: battle.won,
    kills: battle.kills,
    leaks: battle.leaks,
    time: Number(battle.time.toFixed(1)),
  })}`)
}
console.log(
  JSON.stringify({
    won: battle.won,
    kills: battle.kills,
    leaks: battle.leaks,
    time: Number(battle.time.toFixed(1)),
    production: Number(machine.production.toFixed(2)),
  }),
)
