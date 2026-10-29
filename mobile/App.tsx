import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { styles } from './src/styles'

type GearId = 'scout' | 'rogue' | 'spark' | 'guard' | 'booster'
type Phase = 'planning' | 'battle' | 'result' | 'victory' | 'defeat'

type Gear = {
  id: GearId
  level: number
}

type Lane = {
  power: number
  control: number
  labels: string[]
}

type Battle = {
  won: boolean
  damage: number
  remaining: number[]
  startHp: number[]
}

const ROWS = 4
const COLS = 5
const CORE = { row: 1, col: 2 }
const MAX_WAVES = 5

const gearBook: Record<
  GearId,
  {
    title: string
    mark: string
    cost: number
    power: number
    color: string
    detail: string
  }
> = {
  scout: {
    title: 'Scout',
    mark: 'S',
    cost: 6,
    power: 11,
    color: '#35d75f',
    detail: 'Fast spear unit',
  },
  rogue: {
    title: 'Rogue',
    mark: 'R',
    cost: 8,
    power: 15,
    color: '#ff4ea3',
    detail: 'Crit attacker',
  },
  spark: {
    title: 'Spark',
    mark: 'Z',
    cost: 10,
    power: 18,
    color: '#ffd456',
    detail: 'Burst gear',
  },
  guard: {
    title: 'Guard',
    mark: 'G',
    cost: 7,
    power: 10,
    color: '#4ed2ff',
    detail: 'Slows leaks',
  },
  booster: {
    title: 'Boost',
    mark: 'x2',
    cost: 9,
    power: 0,
    color: '#f4d6a0',
    detail: 'Buffs adjacent',
  },
}

const waves = [
  { name: 'Meadow Run', hp: [26, 34, 26], reward: 14 },
  { name: 'Wolf Pack', hp: [42, 36, 44], reward: 16 },
  { name: 'Sky Raiders', hp: [58, 48, 58], reward: 19 },
  { name: 'Bridge Clash', hp: [72, 82, 70], reward: 23 },
  { name: 'Nimbus Boss', hp: [92, 118, 92], reward: 35 },
]

const emptyGrid = () =>
  Array.from({ length: ROWS }, () => Array.from<Gear | null>({ length: COLS }).fill(null))

const gearIds = Object.keys(gearBook) as GearId[]

const rollShop = () => Array.from({ length: 3 }, () => gearIds[Math.floor(Math.random() * gearIds.length)])

const isCore = (row: number, col: number) => row === CORE.row && col === CORE.col

const neighbors = (row: number, col: number) =>
  [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS)

const laneForRow = (row: number) => Math.min(2, Math.floor((row * 3) / ROWS))

const upgradeCost = (gear: Gear) => Math.ceil(gearBook[gear.id].cost * (0.8 + gear.level * 0.6))

const getPowered = (grid: (Gear | null)[][]) => {
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

const boosterFor = (grid: (Gear | null)[][], powered: Set<string>, row: number, col: number) =>
  neighbors(row, col).reduce((boost, [nextRow, nextCol]) => {
    const gear = grid[nextRow][nextCol]
    if (!gear || gear.id !== 'booster' || !powered.has(`${nextRow}-${nextCol}`)) return boost
    return boost + 0.48 * gear.level
  }, 1)

const buildLanes = (grid: (Gear | null)[][], powered: Set<string>) => {
  const lanes: Lane[] = Array.from({ length: 3 }, () => ({ power: 0, control: 0, labels: [] }))

  grid.forEach((rowCells, row) => {
    rowCells.forEach((gear, col) => {
      if (!gear || gear.id === 'booster' || !powered.has(`${row}-${col}`)) return
      const lane = laneForRow(row)
      const data = gearBook[gear.id]
      const levelScale = 1 + (gear.level - 1) * 0.58
      const output = data.power * levelScale * boosterFor(grid, powered, row, col)

      lanes[lane].power += output
      lanes[lane].labels.push(`${data.title} L${gear.level}`)
      if (gear.id === 'guard') lanes[lane].control += 0.15 * gear.level
      if (gear.id === 'spark') lanes[lane].power += 3 * gear.level
    })
  })

  return lanes
}

const simulateBattle = (lanes: Lane[], wave: number): Battle => {
  const startHp = [...waves[wave - 1].hp]
  const remaining = startHp.map((hp, lane) => {
    const output = lanes[lane].power * (2.65 + Math.min(0.5, lanes[lane].control))
    return Math.max(0, hp - output)
  })
  const totalRemaining = remaining.reduce((sum, hp) => sum + hp, 0)
  const won = totalRemaining <= 0

  return {
    won,
    damage: won ? 0 : Math.max(1, Math.ceil(totalRemaining / 38)),
    remaining,
    startHp,
  }
}

export default function App() {
  const { width } = useWindowDimensions()
  const [grid, setGrid] = useState<(Gear | null)[][]>(() => emptyGrid())
  const [shop, setShop] = useState<GearId[]>(() => ['scout', 'spark', 'booster'])
  const [selected, setSelected] = useState<GearId | null>('scout')
  const [coins, setCoins] = useState(22)
  const [lives, setLives] = useState(13)
  const [defeated, setDefeated] = useState(0)
  const [wave, setWave] = useState(1)
  const [phase, setPhase] = useState<Phase>('planning')
  const [notice, setNotice] = useState('Tap a card, place gears near the core, then fight.')
  const [battle, setBattle] = useState<Battle | null>(null)
  const [battleTick, setBattleTick] = useState(0)

  const powered = useMemo(() => getPowered(grid), [grid])
  const lanes = useMemo(() => buildLanes(grid, powered), [grid, powered])
  const currentWave = waves[wave - 1]
  const boardSize = Math.min(width - 42, 380)
  const socketSize = (boardSize - 36) / COLS
  const battleProgress = phase === 'battle' ? Math.min(1, battleTick / 14) : phase === 'result' ? 1 : 0
  const displayHp =
    battle?.startHp.map((hp, index) => Math.max(0, hp - (hp - battle.remaining[index]) * battleProgress)) ??
    currentWave.hp

  useEffect(() => {
    if (phase !== 'battle' || !battle) return

    if (battleTick < 14) {
      const timer = setTimeout(() => setBattleTick((tick) => tick + 1), 220)
      return () => clearTimeout(timer)
    }

    const timer = setTimeout(() => {
      if (battle.won) {
        const reward = currentWave.reward
        setCoins((value) => value + reward)
        setDefeated((value) => value + currentWave.hp.length)
        setNotice(`Wave cleared. +${reward} nuts earned.`)
        setPhase(wave === MAX_WAVES ? 'victory' : 'result')
        return
      }

      setLives((value) => {
        const next = Math.max(0, value - battle.damage)
        setPhase(next <= 0 ? 'defeat' : 'result')
        return next
      })
      setNotice(`Enemies broke through for ${battle.damage} damage. Upgrade and retry.`)
    }, 450)

    return () => clearTimeout(timer)
  }, [battle, battleTick, currentWave.hp.length, currentWave.reward, phase, wave])

  const placeOrUpgrade = (row: number, col: number) => {
    if (phase === 'battle' || isCore(row, col)) return
    const existing = grid[row][col]

    if (existing) {
      const cost = upgradeCost(existing)
      if (coins < cost) {
        setNotice(`Need ${cost} nuts to upgrade ${gearBook[existing.id].title}.`)
        return
      }
      setGrid((current) =>
        current.map((gridRow, rowIndex) =>
          gridRow.map((gear, colIndex) =>
            rowIndex === row && colIndex === col && gear ? { ...gear, level: gear.level + 1 } : gear,
          ),
        ),
      )
      setCoins((value) => value - cost)
      setNotice(`${gearBook[existing.id].title} upgraded to level ${existing.level + 1}.`)
      return
    }

    if (!selected) {
      setNotice('Select a gear card before placing.')
      return
    }

    const data = gearBook[selected]
    if (coins < data.cost) {
      setNotice(`Need ${data.cost} nuts for ${data.title}.`)
      return
    }

    setGrid((current) =>
      current.map((gridRow, rowIndex) =>
        gridRow.map((gear, colIndex) => (rowIndex === row && colIndex === col ? { id: selected, level: 1 } : gear)),
      ),
    )
    setCoins((value) => value - data.cost)
    setNotice(`${data.title} placed. Powered gears glow green.`)
  }

  const reroll = () => {
    if (phase === 'battle') return
    if (coins < 5) {
      setNotice('Need 5 nuts to refresh the shop.')
      return
    }
    setCoins((value) => value - 5)
    setShop(rollShop())
    setSelected(null)
    setNotice('New cards drawn.')
  }

  const fight = () => {
    if (phase === 'battle') return
    if (!lanes.some((lane) => lane.power > 0)) {
      setNotice('Place at least one powered attack gear before fighting.')
      return
    }
    const result = simulateBattle(lanes, wave)
    setBattle(result)
    setBattleTick(0)
    setPhase('battle')
    setNotice('Gears are spinning. Watch the lanes resolve.')
  }

  const continueRun = () => {
    if (!battle) return
    if (battle.won && wave < MAX_WAVES) {
      setWave((value) => value + 1)
      setShop(rollShop())
      setSelected(null)
    }
    setBattle(null)
    setBattleTick(0)
    setPhase('planning')
    setNotice('Tune the board for the next wave.')
  }

  const reset = () => {
    setGrid(emptyGrid())
    setShop(['scout', 'spark', 'booster'])
    setSelected('scout')
    setCoins(22)
    setLives(13)
    setDefeated(0)
    setWave(1)
    setPhase('planning')
    setNotice('New run. Build a chain from the core.')
    setBattle(null)
    setBattleTick(0)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.sky}>
        <View style={[styles.cloud, styles.cloudOne]} />
        <View style={[styles.cloud, styles.cloudTwo]} />
        <View style={[styles.island, styles.islandOne]} />
        <View style={[styles.island, styles.islandTwo]} />
      </View>

      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.topHud}>
          <Pressable onPress={reset} style={styles.iconButton}>
            <Text style={styles.iconText}>SET</Text>
          </Pressable>
          <View style={styles.wavePill}>
            <Text style={styles.waveTitle}>
              Wave {wave}/{MAX_WAVES}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(wave / MAX_WAVES) * 100}%` }]} />
            </View>
            <Text style={styles.waveName}>{currentWave.name}</Text>
          </View>
          <View style={styles.gemPill}>
            <Text style={styles.gemText}>68</Text>
          </View>
        </View>

        <View style={styles.sideBadge}>
          <Text style={styles.sideBadgeIcon}>+</Text>
          <Text style={styles.sideBadgeText}>BUFFS</Text>
        </View>

        <View style={[styles.board, { width: boardSize }]}>
          {grid.map((rowCells, row) =>
            rowCells.map((gear, col) => {
              const key = `${row}-${col}`
              const isPowered = powered.has(key)
              const data = gear ? gearBook[gear.id] : null

              return (
                <Pressable
                  key={key}
                  onPress={() => placeOrUpgrade(row, col)}
                  style={[
                    styles.socket,
                    {
                      width: socketSize,
                      height: socketSize,
                      borderRadius: socketSize / 2,
                    },
                    isCore(row, col) && styles.coreSocket,
                    isPowered && styles.poweredSocket,
                    data && { backgroundColor: data.color },
                  ]}
                >
                  {isCore(row, col) ? (
                    <Text style={styles.coreText}>CORE</Text>
                  ) : data ? (
                    <>
                      <Text style={styles.gearMark}>{data.mark}</Text>
                      <Text style={styles.levelBadge}>{gear?.level}</Text>
                    </>
                  ) : null}
                </Pressable>
              )
            }),
          )}
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>

        <View style={styles.battleGround}>
          {displayHp.map((hp, lane) => {
            const hpPercent = Math.max(0, Math.min(100, (hp / currentWave.hp[lane]) * 100))
            const powerWidth = Math.max(10, Math.min(100, lanes[lane].power * 3.2))
            return (
              <View style={styles.laneRow} key={lane}>
                <View style={[styles.heroUnit, { left: `${Math.min(70, powerWidth / 1.5)}%` }]}>
                  <Text style={styles.unitText}>{lanes[lane].power > 0 ? 'H' : '-'}</Text>
                </View>
                <View style={[styles.enemyUnit, { right: `${100 - hpPercent}%` }]}>
                  <Text style={styles.unitText}>W</Text>
                </View>
                <View style={styles.laneBar}>
                  <View style={[styles.powerLine, { width: `${powerWidth}%` }]} />
                  <View style={[styles.enemyLine, { width: `${hpPercent}%` }]} />
                </View>
              </View>
            )
          })}
        </View>

        {phase === 'planning' || phase === 'result' ? (
          <View style={styles.shopPanel}>
            <View style={styles.currencyRow}>
              <View style={styles.currencyPill}>
                <Text style={styles.currencyIcon}>O</Text>
                <Text style={styles.currencyValue}>{coins}</Text>
              </View>
              <Text style={styles.phaseText}>{phase === 'result' ? 'Result ready' : 'Build phase'}</Text>
            </View>

            <View style={styles.cardsRow}>
              {shop.map((gearId, index) => {
                const data = gearBook[gearId]
                return (
                  <Pressable
                    key={`${gearId}-${index}`}
                    onPress={() => setSelected(gearId)}
                    style={[
                      styles.card,
                      selected === gearId && styles.selectedCard,
                      { borderColor: selected === gearId ? data.color : '#0a5cab' },
                    ]}
                  >
                    <View style={[styles.cardGear, { backgroundColor: data.color }]}>
                      <Text style={styles.cardMark}>{data.mark}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{data.title}</Text>
                    <Text style={styles.cardDetail}>{data.detail}</Text>
                    <View style={styles.costPill}>
                      <Text style={styles.costText}>{data.cost}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.actionRow}>
              <Pressable onPress={reroll} style={styles.rerollButton}>
                <Text style={styles.actionText}>Reroll 5</Text>
              </Pressable>
              <Pressable onPress={phase === 'result' ? continueRun : fight} style={styles.fightButton}>
                <Text style={styles.actionText}>{phase === 'result' ? (battle?.won ? 'NEXT' : 'RETRY') : 'FIGHT!'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'victory' || phase === 'defeat' ? (
          <View style={styles.endPanel}>
            <Text style={styles.endTitle}>{phase === 'victory' ? 'Mission Clear!' : 'Try Again'}</Text>
            <Text style={styles.endCopy}>
              {phase === 'victory'
                ? 'The placeholder build cleared all five waves.'
                : 'The wolves broke the line. Restart and cluster attack gears around boosters.'}
            </Text>
            <Pressable onPress={reset} style={styles.fightButton}>
              <Text style={styles.actionText}>NEW RUN</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomHud}>
        <View style={styles.lifePill}>
          <Text style={styles.lifeIcon}>HP</Text>
          <Text style={styles.lifeText}>{lives}</Text>
        </View>
        <View style={styles.skullPill}>
          <Text style={styles.lifeIcon}>KO</Text>
          <Text style={styles.lifeText}>{defeated}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
