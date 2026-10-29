import {
  emptyGrid,
  isLocked,
  laneForRow,
  lockedKeys,
  sellValue,
  unlockForClear,
  waves,
} from '../src/catalog'
import {
  createBattle,
  diagnoseBoard,
  failHint,
  inspectMachine,
  mergeGears,
  placeGear,
  tickBattle,
} from '../src/sim'

const merged = mergeGears({ id: 'cog', rank: 1 }, { id: 'cog', rank: 1 })
if (!merged || merged.rank !== 2) throw new Error('rank 1 pair should merge to 2')
if (mergeGears({ id: 'cog', rank: 4 }, { id: 'cog', rank: 4 })) throw new Error('rank 4 should not merge')
if (mergeGears({ id: 'cog', rank: 1 }, { id: 'scout', rank: 1 })) throw new Error('mixed types should not merge')
if (sellValue({ id: 'scout', rank: 2 }) < 1) throw new Error('sell should refund nuts')
if (laneForRow(0) !== 0 || laneForRow(1) !== 1 || laneForRow(3) !== 2) {
  throw new Error('spinner row should feed the middle lane')
}

if (waves.length !== 10) throw new Error('slice 3 should be a 10-wave run')
if (unlockForClear(1) !== null) throw new Error('odd waves should not unlock')
if (unlockForClear(2) !== 'rogue' || unlockForClear(10) !== 'bolt') {
  throw new Error('even clears should unlock rogue then bolt')
}
if (lockedKeys(1).size !== 0) throw new Error('wave 1 should be an open board')
if (!isLocked(0, 0, 3) || isLocked(1, 2, 10)) throw new Error('later waves lock corners, not the spinner')

const grid = emptyGrid()
const withCog = placeGear(grid, 1, 1, { id: 'cog', rank: 2 })
const stacked = [
  [0, 2, 'scout'],
  [1, 3, 'scout'],
  [2, 2, 'guard'],
  [3, 2, 'spark'],
].reduce(
  (next, [row, col, id]) =>
    placeGear(next, Number(row), Number(col), { id: id as 'scout' | 'guard' | 'spark', rank: 2 }),
  withCog,
)
const machine = inspectMachine(stacked)

if (machine.production <= 1) throw new Error('cog should raise production')
if (!machine.powered.has('1-1') || !machine.powered.has('1-3')) {
  throw new Error('chain should power from spinner')
}

const diag = diagnoseBoard(stacked, machine)
if (diag.unitCount !== 4 || diag.tankCount !== 1 || !diag.lanes[0] || !diag.lanes[1] || !diag.lanes[2]) {
  throw new Error('stacked board should cover three lanes with a tank')
}

const emptyDiag = diagnoseBoard(emptyGrid(), inspectMachine(emptyGrid()))
if (!failHint(1, 13, emptyDiag).toLowerCase().includes('spinner')) {
  throw new Error('empty board should coach the spinner chain')
}

const spellGrid = placeGear(placeGear(emptyGrid(), 1, 1, { id: 'cog', rank: 1 }), 1, 3, { id: 'bolt', rank: 2 })
const spellDiag = diagnoseBoard(spellGrid, inspectMachine(spellGrid))
if (spellDiag.spellCount !== 1 || spellDiag.unitCount !== 0) throw new Error('bolt should count as a spell, not a unit')
if (!failHint(2, 8, spellDiag).toLowerCase().includes('spell')) {
  throw new Error('all-spell fail text should name the mistake')
}

const noTank = failHint(3, 6, { ...diag, tankCount: 0, lanes: [true, true, true] })
if (!noTank.toLowerCase().includes('tank') && !noTank.toLowerCase().includes('guard')) {
  throw new Error('wave 3 should ask for a tank')
}

const emptyLane = failHint(5, 4, { ...diag, lanes: [false, true, true] })
if (!emptyLane.toLowerCase().includes('top')) throw new Error('empty-lane coaching should name the row')

let emptyBattle = createBattle(1)
const idle = inspectMachine(emptyGrid())
for (let i = 0; i < 400 && emptyBattle.won === null; i += 1) {
  emptyBattle = tickBattle(emptyBattle, 0.05, emptyGrid(), idle, 1)
}
if (emptyBattle.won !== false || emptyBattle.leaks < 13) {
  throw new Error('an empty factory should leak wave 1')
}

let battle = createBattle(1)
let sawCrate = false
let sawOverdrive = false
for (let i = 0; i < 1200 && battle.won === null; i += 1) {
  battle = tickBattle(battle, 0.05, stacked, machine, 1)
  if (battle.crate) sawCrate = true
  if (battle.overdrive > 0) sawOverdrive = true
}

if (battle.won !== true) {
  throw new Error(
    `stacked board should clear wave 1, got ${JSON.stringify({
      won: battle.won,
      kills: battle.kills,
      leaks: battle.leaks,
      time: Number(battle.time.toFixed(1)),
    })}`,
  )
}
if (!sawCrate) throw new Error('mid-fight crate should spawn')
if (!sawOverdrive) throw new Error('a walking scout should grab overdrive')

let boltBattle = createBattle(1)
let sawBolt = false
const boltMachine = inspectMachine(spellGrid)
for (let i = 0; i < 80; i += 1) {
  boltBattle = tickBattle(boltBattle, 0.05, spellGrid, boltMachine, 1)
  if (boltBattle.shots.some((shot) => shot.team === 'player' && shot.mark === 'bolt')) sawBolt = true
}
if (!sawBolt) throw new Error('powered Bolt should fire line shots')
if (boltBattle.fighters.some((unit) => unit.team === 'player')) {
  throw new Error('Bolt should not spawn bodies')
}

console.log(
  JSON.stringify({
    won: battle.won,
    kills: battle.kills,
    leaks: battle.leaks,
    time: Number(battle.time.toFixed(1)),
    production: Number(machine.production.toFixed(2)),
    crate: sawCrate,
    overdrive: sawOverdrive,
    waves: waves.length,
  }),
)
