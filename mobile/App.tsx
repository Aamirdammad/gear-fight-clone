import { StatusBar } from 'expo-status-bar'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native'
import {
  COLS,
  MAX_WAVES,
  ROWS,
  emptyGrid,
  gearBook,
  isCore,
  rollUnitShop,
  sellValue,
  waves,
  type Gear,
  type GearId,
} from './src/catalog'
import {
  createBattle,
  failHint,
  inspectMachine,
  mergeGears,
  placeGear,
  tickBattle,
  type BattleState,
} from './src/sim'
import { styles } from './src/styles'

type Phase = 'planning' | 'battle' | 'result' | 'victory' | 'defeat'
type ShopPick = { kind: 'cog' } | { kind: 'unit'; index: number }

const DT = 0.05
const BOARD_GAP = 9

const SpinningGear = ({
  spinning,
  speed,
  color,
  size,
  mark,
}: {
  spinning: boolean
  speed: number
  color: string
  size: number
  mark: string
}) => {
  const rot = useRef(new Animated.Value(0)).current

  useEffect(() => {
    rot.setValue(0)
    if (!spinning) return undefined
    const duration = Math.max(280, 1600 / Math.max(0.35, speed))
    const loop = Animated.loop(
      Animated.timing(rot, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [rot, spinning, speed])

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const tooth = Math.max(5, size * 0.14)

  return (
    <Animated.View
      style={[
        styles.gearFace,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ rotate }],
        },
      ]}
    >
      <View style={[styles.tooth, { top: 2, width: tooth, height: tooth }]} />
      <View style={[styles.tooth, { bottom: 2, width: tooth, height: tooth }]} />
      <View style={[styles.tooth, { left: 2, width: tooth, height: tooth }]} />
      <View style={[styles.tooth, { right: 2, width: tooth, height: tooth }]} />
      <Text style={styles.gearMark}>{mark}</Text>
    </Animated.View>
  )
}

export default function App() {
  const { width } = useWindowDimensions()
  const [grid, setGrid] = useState<(Gear | null)[][]>(() => emptyGrid())
  const [shop, setShop] = useState<GearId[]>(() => ['scout', 'spark', 'booster'])
  const [pick, setPick] = useState<ShopPick | null>({ kind: 'cog' })
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [coins, setCoins] = useState(26)
  const [lives, setLives] = useState(13)
  const [defeated, setDefeated] = useState(0)
  const [wave, setWave] = useState(1)
  const [phase, setPhase] = useState<Phase>('planning')
  const [notice, setNotice] = useState('Buy a Cog, chain unit gears from the spinner, merge pairs, then fight.')
  const [battle, setBattle] = useState<BattleState | null>(null)
  const [drag, setDrag] = useState<{ gear: Gear; x: number; y: number } | null>(null)

  const boardSize = Math.min(width - 42, 380)
  const socketSize = (boardSize - BOARD_GAP * (COLS - 1)) / COLS
  const machine = useMemo(() => inspectMachine(grid), [grid])
  const currentWave = waves[wave - 1]
  const unitCount = useMemo(
    () =>
      grid.reduce(
        (sum, row, rowIndex) =>
          sum +
          row.reduce(
            (rowSum, gear, col) =>
              gear && gearBook[gear.id].spawns && machine.powered.has(`${rowIndex}-${col}`) ? rowSum + 1 : rowSum,
            0,
          ),
        0,
      ),
    [grid, machine.powered],
  )

  const boardRef = useRef<ComponentRef<typeof View>>(null)
  const boardOrigin = useRef({ x: 0, y: 0 })
  const dragFrom = useRef<{ row: number; col: number; gear: Gear } | null>(null)
  const moved = useRef(false)
  const gridRef = useRef(grid)
  const phaseRef = useRef(phase)
  const socketSizeRef = useRef(socketSize)
  const tapCellRef = useRef<(row: number, col: number) => void>(() => undefined)
  const dropGearRef = useRef<
    (fromRow: number, fromCol: number, moving: Gear, toRow: number, toCol: number) => void
  >(() => undefined)
  gridRef.current = grid
  phaseRef.current = phase
  socketSizeRef.current = socketSize

  useEffect(() => {
    if (phase !== 'battle' || !battle || battle.won !== null) return undefined
    const timer = setInterval(() => {
      setBattle((current) => {
        if (!current || current.won !== null) return current
        return tickBattle(current, DT, gridRef.current, inspectMachine(gridRef.current))
      })
    }, DT * 1000)
    return () => clearInterval(timer)
  }, [battle, phase])

  useEffect(() => {
    if (phase !== 'battle' || !battle || battle.won === null) return undefined
    const leaks = battle.leaks
    const kills = battle.kills
    const won = battle.won
    const timer = setTimeout(() => {
      setDefeated((value) => value + kills)
      setLives((value) => {
        const next = Math.max(0, value - leaks)
        if (next <= 0) {
          setNotice(failHint(wave, leaks, machine.production, unitCount))
          setPhase('defeat')
          return next
        }
        if (won) {
          setCoins((coinsNow) => coinsNow + currentWave.reward)
          setNotice(`Wave cleared. +${currentWave.reward} nuts. ${leaks ? `${leaks} leaked.` : 'No leaks.'}`)
          setPhase(wave === MAX_WAVES ? 'victory' : 'result')
        } else {
          setNotice(failHint(wave, leaks, machine.production, unitCount))
          setPhase('result')
        }
        return next
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [battle, currentWave.reward, machine.production, phase, unitCount, wave])

  const socketFromTouch = (event: GestureResponderEvent) => {
    const size = socketSizeRef.current
    const x = event.nativeEvent.pageX - boardOrigin.current.x
    const y = event.nativeEvent.pageY - boardOrigin.current.y
    const col = Math.floor(x / (size + BOARD_GAP))
    const row = Math.floor(y / (size + BOARD_GAP))
    if (row < 0 || col < 0 || row >= ROWS || col >= COLS) return null
    return { row, col }
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current !== 'battle',
      onMoveShouldSetPanResponder: (_, gesture) => phaseRef.current !== 'battle' && Math.hypot(gesture.dx, gesture.dy) > 6,
      onPanResponderGrant: (event) => {
        if (phaseRef.current === 'battle') return
        moved.current = false
        const cell = socketFromTouch(event)
        if (!cell || isCore(cell.row, cell.col)) {
          dragFrom.current = null
          return
        }
        const gear = gridRef.current[cell.row][cell.col]
        dragFrom.current = gear ? { ...cell, gear } : null
      },
      onPanResponderMove: (event, gesture) => {
        if (!dragFrom.current) return
        if (Math.hypot(gesture.dx, gesture.dy) > 8) moved.current = true
        const size = socketSizeRef.current
        setDrag({
          gear: dragFrom.current.gear,
          x: event.nativeEvent.pageX - size / 2,
          y: event.nativeEvent.pageY - size / 2,
        })
      },
      onPanResponderRelease: (event) => {
        const origin = dragFrom.current
        const target = socketFromTouch(event)
        const wasDrag = moved.current
        setDrag(null)
        dragFrom.current = null
        moved.current = false
        if (!wasDrag && target && !isCore(target.row, target.col)) {
          tapCellRef.current(target.row, target.col)
          return
        }
        if (!origin) return
        if (!target || isCore(target.row, target.col)) {
          setNotice('Drop on an empty socket or a matching rank to merge.')
          return
        }
        dropGearRef.current(origin.row, origin.col, origin.gear, target.row, target.col)
      },
      onPanResponderTerminate: () => {
        setDrag(null)
        dragFrom.current = null
      },
    }),
  ).current

  const chosenId = pick?.kind === 'cog' ? 'cog' : pick ? shop[pick.index] : null

  const tapCell = (row: number, col: number) => {
    if (phase === 'battle' || isCore(row, col)) return
    const existing = grid[row][col]
    if (existing) {
      setSelectedCell({ row, col })
      setPick(null)
      setNotice(`${gearBook[existing.id].title} r${existing.rank}. Drag to move/merge, or sell.`)
      return
    }
    if (!chosenId) {
      setSelectedCell(null)
      setNotice('Select a shop card, then tap an empty socket.')
      return
    }
    const data = gearBook[chosenId]
    if (coins < data.cost) {
      setNotice(`Need ${data.cost} nuts for ${data.title}.`)
      return
    }
    setGrid((current) => placeGear(current, row, col, { id: chosenId, rank: 1 }))
    setCoins((value) => value - data.cost)
    setSelectedCell({ row, col })
    setNotice(
      chosenId === 'cog'
        ? 'Cog placed. Merge two Cogs of the same rank to spin faster.'
        : `${data.title} placed. It only works if a chain reaches the spinner.`,
    )
  }

  const dropGear = (fromRow: number, fromCol: number, moving: Gear, toRow: number, toCol: number) => {
    if (fromRow === toRow && fromCol === toCol) return
    const target = grid[toRow][toCol]
    if (!target) {
      setGrid((current) => placeGear(placeGear(current, fromRow, fromCol, null), toRow, toCol, moving))
      setSelectedCell({ row: toRow, col: toCol })
      setNotice('Moved. Keep the chain touching the spinner.')
      return
    }
    const merged = mergeGears(moving, target)
    if (merged) {
      setGrid((current) => placeGear(placeGear(current, fromRow, fromCol, null), toRow, toCol, merged))
      setSelectedCell({ row: toRow, col: toCol })
      setNotice(`${gearBook[merged.id].title} merged to rank ${merged.rank}.`)
      return
    }
    setGrid((current) => placeGear(placeGear(current, fromRow, fromCol, target), toRow, toCol, moving))
    setSelectedCell({ row: toRow, col: toCol })
    setNotice('Swapped. Same rank + same type merge into a stronger gear.')
  }

  tapCellRef.current = tapCell
  dropGearRef.current = dropGear

  const sellSelected = () => {
    if (!selectedCell || phase === 'battle') return
    const gear = grid[selectedCell.row][selectedCell.col]
    if (!gear) return
    const value = sellValue(gear)
    setGrid((current) => placeGear(current, selectedCell.row, selectedCell.col, null))
    setCoins((valueNow) => valueNow + value)
    setSelectedCell(null)
    setNotice(`Sold ${gearBook[gear.id].title} for ${value} nuts.`)
  }

  const reroll = () => {
    if (phase === 'battle') return
    if (coins < 5) {
      setNotice('Need 5 nuts to refresh unit cards.')
      return
    }
    setCoins((value) => value - 5)
    setShop(rollUnitShop())
    setPick({ kind: 'cog' })
    setNotice('New unit cards. Cog stays pinned.')
  }

  const fight = () => {
    if (phase === 'battle') return
    if (unitCount === 0) {
      setNotice('Connect at least one unit gear to the spinner before fighting.')
      return
    }
    setSelectedCell(null)
    setPick(null)
    setBattle(createBattle(wave))
    setPhase('battle')
    setNotice('Spinner live. Units walk the lanes. Watch leaks on the left.')
  }

  const continueRun = () => {
    if (!battle) return
    if (battle.won && wave < MAX_WAVES) {
      setWave((value) => value + 1)
      setShop(rollUnitShop())
      setPick({ kind: 'cog' })
    }
    setBattle(null)
    setPhase('planning')
    setNotice(battle.won ? 'Tune the machine for the next job.' : 'Rebuild, then retry this wave.')
  }

  const reset = () => {
    setGrid(emptyGrid())
    setShop(['scout', 'spark', 'booster'])
    setPick({ kind: 'cog' })
    setSelectedCell(null)
    setCoins(26)
    setLives(13)
    setDefeated(0)
    setWave(1)
    setPhase('planning')
    setNotice('New run. Cog + chain + merge, then fight.')
    setBattle(null)
  }

  const onBoardLayout = () => {
    boardRef.current?.measureInWindow((x: number, y: number) => {
      boardOrigin.current = { x, y }
    })
  }

  const selectedGear = selectedCell ? grid[selectedCell.row][selectedCell.col] : null
  const frost = battle?.slow ?? 1
  const spinSpeed = phase === 'battle' ? machine.spin * frost : Math.max(0.45, machine.spin * 0.35)

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.sky}>
        <View style={[styles.cloud, styles.cloudOne]} />
        <View style={[styles.cloud, styles.cloudTwo]} />
        <View style={[styles.island, styles.islandOne]} />
        <View style={[styles.island, styles.islandTwo]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!drag}
      >
        <View style={styles.topHud}>
          <Pressable onPress={reset} style={styles.iconButton}>
            <Text style={styles.iconText}>NEW</Text>
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
          <View style={styles.nutsPill}>
            <Text style={styles.nutsLabel}>NUTS</Text>
            <Text style={styles.nutsValue}>{coins}</Text>
          </View>
        </View>

        <View style={styles.machineReadout}>
          <Text style={styles.machineText}>
            {currentWave.job} · spin x{machine.production.toFixed(2)}
            {phase === 'battle' && frost < 1 ? ' · FROST' : ''}
          </Text>
        </View>

        <View
          ref={boardRef}
          {...pan.panHandlers}
          onLayout={onBoardLayout}
          style={[styles.board, { width: boardSize }]}
        >
          {grid.map((rowCells, row) =>
            rowCells.map((gear, col) => {
              const key = `${row}-${col}`
              const powered = isCore(row, col) || machine.powered.has(key)
              const data = gear ? gearBook[gear.id] : null
              const selected = selectedCell?.row === row && selectedCell?.col === col
              const draggingHere = drag && dragFrom.current?.row === row && dragFrom.current?.col === col

              return (
                <Pressable
                  key={key}
                  onPress={() => tapCell(row, col)}
                  style={[
                    styles.socket,
                    {
                      width: socketSize,
                      height: socketSize,
                      borderRadius: socketSize / 2,
                    },
                    powered && styles.poweredSocket,
                    isCore(row, col) && styles.coreSocket,
                    selected && styles.selectedSocket,
                    draggingHere && { opacity: 0.2 },
                  ]}
                >
                  {isCore(row, col) ? (
                    <SpinningGear spinning color="#eed8a3" size={socketSize - 8} speed={spinSpeed} mark="SPIN" />
                  ) : data && gear ? (
                    <>
                      <SpinningGear
                        spinning={powered}
                        color={data.color}
                        size={socketSize - 10}
                        speed={spinSpeed}
                        mark={data.mark}
                      />
                      <Text style={styles.levelBadge}>r{gear.rank}</Text>
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
          {[0, 1, 2].map((lane) => (
            <View style={styles.laneRow} key={lane}>
              <View style={styles.laneTrack} />
              {(battle?.fighters ?? [])
                .filter((unit) => unit.lane === lane)
                .map((unit) => (
                  <View
                    key={unit.id}
                    style={[
                      styles.fighter,
                      {
                        width: unit.size,
                        height: unit.size,
                        borderRadius: unit.size / 3,
                        left: `${unit.x * 100}%`,
                        marginLeft: -unit.size / 2,
                        backgroundColor: unit.color,
                        borderColor: unit.team === 'player' ? '#1d783b' : '#4b170e',
                      },
                    ]}
                  >
                    <View style={styles.fighterHp}>
                      <View style={[styles.fighterHpFill, { width: `${Math.max(8, (unit.hp / unit.maxHp) * 100)}%` }]} />
                    </View>
                    <Text style={styles.gearMark}>{unit.mark}</Text>
                  </View>
                ))}
              {(battle?.shots ?? [])
                .filter((shot) => shot.lane === lane)
                .map((shot) => (
                  <View key={shot.id} style={[styles.shot, { left: `${shot.x * 100}%` }]} />
                ))}
              {(battle?.floats ?? [])
                .filter((item) => item.lane === lane)
                .map((item) => (
                  <Text key={item.id} style={[styles.floatText, { left: `${item.x * 100}%`, opacity: item.life }]}>
                    {item.text}
                  </Text>
                ))}
            </View>
          ))}
        </View>

        {phase === 'planning' || phase === 'result' ? (
          <View style={styles.shopPanel}>
            <View style={styles.currencyRow}>
              <Text style={styles.phaseText}>{phase === 'result' ? 'Result ready' : 'Build the machine'}</Text>
              <Text style={styles.phaseText}>{unitCount} live units</Text>
            </View>

            <View style={styles.cardsRow}>
              <Pressable
                onPress={() => {
                  setPick({ kind: 'cog' })
                  setSelectedCell(null)
                }}
                style={[styles.card, styles.pinnedCard, pick?.kind === 'cog' && styles.selectedCard]}
              >
                <View style={[styles.cardGear, { backgroundColor: gearBook.cog.color }]}>
                  <Text style={styles.cardMark}>{gearBook.cog.mark}</Text>
                </View>
                <Text style={styles.cardTitle}>Cog</Text>
                <Text style={styles.cardDetail}>Always in shop</Text>
                <View style={styles.costPill}>
                  <Text style={styles.costText}>{gearBook.cog.cost}</Text>
                </View>
              </Pressable>
              {shop.map((gearId, index) => {
                const data = gearBook[gearId]
                const selected = pick?.kind === 'unit' && pick.index === index
                return (
                  <Pressable
                    key={`${gearId}-${index}`}
                    onPress={() => {
                      setPick({ kind: 'unit', index })
                      setSelectedCell(null)
                    }}
                    style={[styles.card, selected && styles.selectedCard, { borderColor: selected ? data.color : '#0a5cab' }]}
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
              <Pressable
                onPress={sellSelected}
                style={[styles.sellButton, !selectedGear && styles.sellDisabled]}
              >
                <Text style={styles.actionText}>{selectedGear ? `SELL ${sellValue(selectedGear)}` : 'SELL'}</Text>
              </Pressable>
              <Pressable onPress={reroll} style={styles.rerollButton}>
                <Text style={styles.actionText}>REROLL 5</Text>
              </Pressable>
              <Pressable onPress={phase === 'result' ? continueRun : fight} style={styles.fightButton}>
                <Text style={styles.actionText}>
                  {phase === 'result' ? (battle?.won ? 'NEXT' : 'RETRY') : 'FIGHT'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'victory' || phase === 'defeat' ? (
          <View style={styles.endPanel}>
            <Text style={styles.endTitle}>{phase === 'victory' ? 'Machine Holds' : 'Line Broke'}</Text>
            <Text style={styles.endCopy}>
              {phase === 'victory'
                ? 'Five jobs cleared. Merge Cogs, mix lanes, and the spinner carries the fight.'
                : failHint(wave, battle?.leaks ?? 0, machine.production, unitCount)}
            </Text>
            <Pressable onPress={reset} style={styles.fightButton}>
              <Text style={styles.actionText}>NEW RUN</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {drag ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              left: drag.x,
              top: drag.y,
              width: socketSize,
              height: socketSize,
            },
          ]}
        >
          <SpinningGear
            spinning
            color={gearBook[drag.gear.id].color}
            size={socketSize - 8}
            speed={2}
            mark={gearBook[drag.gear.id].mark}
          />
        </View>
      ) : null}

      <View style={styles.bottomHud}>
        <View style={styles.lifePill}>
          <Text style={styles.lifeIcon}>HP</Text>
          <Text style={styles.lifeText}>{Math.max(0, lives - (phase === 'battle' ? battle?.leaks ?? 0 : 0))}</Text>
        </View>
        <View style={styles.skullPill}>
          <Text style={styles.lifeIcon}>KO</Text>
          <Text style={styles.lifeText}>{defeated + (phase === 'battle' ? battle?.kills ?? 0 : 0)}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
