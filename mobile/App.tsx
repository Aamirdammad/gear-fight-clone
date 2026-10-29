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
  LOADOUT_SIZE,
  MAX_WAVES,
  ROWS,
  STARTER_GEARS,
  START_COINS,
  START_LIVES,
  emptyGrid,
  gearBook,
  isCore,
  isLocked,
  kitGears,
  rollUnitShop,
  sellValue,
  unlockForClear,
  unlockWaveFor,
  waves,
  type Gear,
  type GearId,
} from './src/catalog'
import {
  createBattle,
  diagnoseBoard,
  failHint,
  inspectMachine,
  mergeGears,
  placeGear,
  tickBattle,
  type BattleState,
} from './src/sim'
import { styles } from './src/styles'

type Phase = 'loadout' | 'planning' | 'battle' | 'result' | 'victory' | 'defeat'
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
  const [unlocked, setUnlocked] = useState<GearId[]>(() => [...STARTER_GEARS])
  const [loadout, setLoadout] = useState<GearId[]>(() => [...STARTER_GEARS])
  const [shop, setShop] = useState<GearId[]>(() => [...STARTER_GEARS])
  const [pick, setPick] = useState<ShopPick | null>({ kind: 'cog' })
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [coins, setCoins] = useState(START_COINS)
  const [lives, setLives] = useState(START_LIVES)
  const [defeated, setDefeated] = useState(0)
  const [wave, setWave] = useState(1)
  const [phase, setPhase] = useState<Phase>('loadout')
  const [notice, setNotice] = useState('Pick 3 gears. Cog is always in the shop. Unlock more by clearing waves.')
  const [battle, setBattle] = useState<BattleState | null>(null)
  const [drag, setDrag] = useState<{ gear: Gear; x: number; y: number } | null>(null)
  const [payout, setPayout] = useState(0)

  const boardSize = Math.min(width - 42, 380)
  const socketSize = (boardSize - BOARD_GAP * (COLS - 1)) / COLS
  const machine = useMemo(() => inspectMachine(grid), [grid])
  const diagnosis = useMemo(() => diagnoseBoard(grid, machine), [grid, machine])
  const currentWave = waves[wave - 1]
  const boardLocked = useMemo(() => {
    const locked = new Set<string>()
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (isLocked(row, col, wave)) locked.add(`${row}-${col}`)
      }
    }
    return locked
  }, [wave])

  const boardRef = useRef<ComponentRef<typeof View>>(null)
  const boardOrigin = useRef({ x: 0, y: 0 })
  const dragFrom = useRef<{ row: number; col: number; gear: Gear } | null>(null)
  const moved = useRef(false)
  const gridRef = useRef(grid)
  const phaseRef = useRef(phase)
  const socketSizeRef = useRef(socketSize)
  const waveRef = useRef(wave)
  const tapCellRef = useRef<(row: number, col: number) => void>(() => undefined)
  const dropGearRef = useRef<
    (fromRow: number, fromCol: number, moving: Gear, toRow: number, toCol: number) => void
  >(() => undefined)
  gridRef.current = grid
  phaseRef.current = phase
  socketSizeRef.current = socketSize
  waveRef.current = wave

  useEffect(() => {
    if (phase !== 'battle' || !battle || battle.won !== null) return undefined
    const timer = setInterval(() => {
      setBattle((current) => {
        if (!current || current.won !== null) return current
        return tickBattle(current, DT, gridRef.current, inspectMachine(gridRef.current), waveRef.current)
      })
    }, DT * 1000)
    return () => clearInterval(timer)
  }, [battle, phase])

  useEffect(() => {
    if (phase !== 'battle' || !battle || battle.won === null) return undefined
    const leaks = battle.leaks
    const kills = battle.kills
    const won = battle.won
    const clearedWave = wave
    const reward = currentWave.reward
    const timer = setTimeout(() => {
      const diag = diagnoseBoard(gridRef.current, inspectMachine(gridRef.current))
      const unlockedGear = won ? unlockForClear(clearedWave) : null
      setDefeated((value) => value + kills)
      if (unlockedGear) {
        setUnlocked((current) => (current.includes(unlockedGear) ? current : [...current, unlockedGear]))
      }
      setLives((value) => {
        const next = Math.max(0, value - leaks)
        if (next <= 0) {
          setNotice(failHint(clearedWave, leaks, diag))
          setPhase('defeat')
          return next
        }
        if (won) {
          setCoins((coinsNow) => coinsNow + reward)
          setPayout(reward)
          const unlockLine = unlockedGear ? ` Unlocked ${gearBook[unlockedGear].title} for the next run.` : ''
          setNotice(`Wave cleared. +${reward} nuts. ${leaks ? `${leaks} leaked.` : 'No leaks.'}${unlockLine}`)
          setPhase(clearedWave === MAX_WAVES ? 'victory' : 'result')
        } else {
          setNotice(failHint(clearedWave, leaks, diag))
          setPhase('result')
        }
        return next
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [battle, currentWave.reward, phase, wave])

  useEffect(() => {
    if (!payout) return undefined
    const timer = setTimeout(() => setPayout(0), 1200)
    return () => clearTimeout(timer)
  }, [payout])

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
      onStartShouldSetPanResponder: () => phaseRef.current === 'planning' || phaseRef.current === 'result',
      onMoveShouldSetPanResponder: (_, gesture) =>
        (phaseRef.current === 'planning' || phaseRef.current === 'result') && Math.hypot(gesture.dx, gesture.dy) > 6,
      onPanResponderGrant: (event) => {
        if (phaseRef.current !== 'planning' && phaseRef.current !== 'result') return
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
    if (phase === 'battle' || phase === 'loadout' || isCore(row, col)) return
    const existing = grid[row][col]
    if (existing) {
      setSelectedCell({ row, col })
      setPick(null)
      setNotice(`${gearBook[existing.id].title} r${existing.rank}. Drag to move/merge, or sell.`)
      return
    }
    if (isLocked(row, col, wave)) {
      setNotice('This socket is locked for this job. Route the chain around it.')
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
        : chosenId === 'bolt'
          ? 'Bolt placed. It shoots the lane but cannot hold it alone.'
          : `${data.title} placed. It only works if a chain reaches the spinner.`,
    )
  }

  const dropGear = (fromRow: number, fromCol: number, moving: Gear, toRow: number, toCol: number) => {
    if (fromRow === toRow && fromCol === toCol) return
    const target = grid[toRow][toCol]
    if (!target && isLocked(toRow, toCol, wave)) {
      setNotice('That socket is locked. Move onto an open cell.')
      return
    }
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
    setShop(rollUnitShop(loadout))
    setPick({ kind: 'cog' })
    setNotice('New unit cards. Cog stays pinned.')
  }

  const fight = () => {
    if (phase === 'battle') return
    if (diagnosis.unitCount === 0 && diagnosis.spellCount === 0 && diagnosis.healCount === 0) {
      setNotice('Connect at least one unit, Bolt, or Mender to the spinner before fighting.')
      return
    }
    setSelectedCell(null)
    setPick(null)
    setBattle(createBattle(wave))
    setPhase('battle')
    setNotice(
      diagnosis.unitCount === 0
        ? 'Spell board is live. Grab the crate if you can — bodies still hold lanes better.'
        : 'Spinner live. Grab the mid-lane crate for overdrive. Watch leaks on the left.',
    )
  }

  const continueRun = () => {
    if (!battle) return
    if (battle.won && wave < MAX_WAVES) {
      setWave((value) => value + 1)
      setShop(rollUnitShop(loadout))
      setPick({ kind: 'cog' })
    }
    setBattle(null)
    setPhase('planning')
    setNotice(
      battle.won
        ? wave + 1 >= 3
          ? 'Some sockets lock on later jobs. Route around them.'
          : 'Tune the machine for the next job.'
        : failHint(wave, battle.leaks, diagnosis),
    )
  }

  const reset = () => {
    const kept = loadout.filter((id) => unlocked.includes(id))
    const nextLoadout = kept.length === LOADOUT_SIZE ? kept : [...STARTER_GEARS].filter((id) => unlocked.includes(id))
    setGrid(emptyGrid())
    setLoadout(nextLoadout.length === LOADOUT_SIZE ? nextLoadout : [...STARTER_GEARS])
    setShop(rollUnitShop(nextLoadout.length ? nextLoadout : STARTER_GEARS))
    setPick({ kind: 'cog' })
    setSelectedCell(null)
    setCoins(START_COINS)
    setLives(START_LIVES)
    setDefeated(0)
    setWave(1)
    setPhase('loadout')
    setNotice('New run. Pick 3 gears. Unlocks stay.')
    setBattle(null)
    setPayout(0)
  }

  const toggleLoadout = (id: GearId) => {
    if (!unlocked.includes(id)) {
      const at = unlockWaveFor(id)
      setNotice(at ? `${gearBook[id].title} unlocks after wave ${at}.` : 'That gear is locked.')
      return
    }
    setLoadout((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= LOADOUT_SIZE) return current
      return [...current, id]
    })
  }

  const startRun = () => {
    if (loadout.length !== LOADOUT_SIZE) {
      setNotice(`Pick ${LOADOUT_SIZE} gears. Cog stays pinned in every shop.`)
      return
    }
    setGrid(emptyGrid())
    setShop(rollUnitShop(loadout))
    setPick({ kind: 'cog' })
    setSelectedCell(null)
    setCoins(START_COINS)
    setLives(START_LIVES)
    setDefeated(0)
    setWave(1)
    setBattle(null)
    setPhase('planning')
    setNotice('Buy a Cog, chain the loadout from the spinner, merge pairs, then fight.')
  }

  const onBoardLayout = () => {
    boardRef.current?.measureInWindow((x: number, y: number) => {
      boardOrigin.current = { x, y }
    })
  }

  const selectedGear = selectedCell ? grid[selectedCell.row][selectedCell.col] : null
  const frost = battle?.slow ?? 1
  const overdrive = battle?.overdrive ?? 0
  const spinSpeed =
    (phase === 'battle' ? machine.spin * frost : Math.max(0.45, machine.spin * 0.35)) * (overdrive > 0 ? 1.8 : 1)

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
            {payout > 0 ? <Text style={styles.payoutText}>+{payout}</Text> : null}
          </View>
        </View>

        <View style={styles.machineReadout}>
          <Text style={styles.machineText}>
            {currentWave.job} · spin x{machine.production.toFixed(2)}
            {phase === 'battle' && frost < 1 ? ' · FROST' : ''}
            {phase === 'battle' && overdrive > 0 ? ' · OVERDRIVE' : ''}
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
              const locked = boardLocked.has(key)

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
                    locked && !gear && styles.lockedSocket,
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
                  ) : locked ? (
                    <Text style={styles.lockMark}>LOCK</Text>
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
              {battle?.crate?.live && battle.crate.lane === lane ? (
                <View style={[styles.crate, { left: `${battle.crate.x * 100}%` }]}>
                  <Text style={styles.crateMark}>OD</Text>
                </View>
              ) : null}
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
                        left: `${unit.x * 100}%` as `${number}%`,
                        marginLeft: -unit.size / 2,
                        backgroundColor: unit.flash > 0 ? '#fff4d2' : unit.color,
                        borderColor:
                          unit.flash > 0 ? '#ffffff' : unit.team === 'player' ? '#1d783b' : '#4b170e',
                      },
                    ]}
                  >
                    <View style={styles.fighterHp}>
                      <View
                        style={[
                          styles.fighterHpFill,
                          { width: `${Math.max(8, (unit.hp / unit.maxHp) * 100)}%` as `${number}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.gearMark}>{unit.mark}</Text>
                  </View>
                ))}
              {(battle?.shots ?? [])
                .filter((shot) => shot.lane === lane)
                .map((shot) => (
                  <View
                    key={shot.id}
                    style={[
                      shot.mark === 'bolt' ? styles.boltShot : styles.shot,
                      { left: `${shot.x * 100}%` as `${number}%` },
                    ]}
                  />
                ))}
              {(battle?.floats ?? [])
                .filter((item) => item.lane === lane)
                .map((item) => (
                  <Text
                    key={item.id}
                    style={[
                      styles.floatText,
                      item.text.startsWith('+') && styles.healText,
                      { left: `${item.x * 100}%` as `${number}%`, opacity: item.life },
                    ]}
                  >
                    {item.text}
                  </Text>
                ))}
            </View>
          ))}
        </View>

        {phase === 'loadout' ? (
          <View style={styles.shopPanel}>
            <View style={styles.currencyRow}>
              <Text style={styles.phaseText}>Loadout {loadout.length}/{LOADOUT_SIZE}</Text>
              <Text style={styles.phaseText}>
                {unlocked.length}/{kitGears.length} unlocked
              </Text>
            </View>
            <Text style={styles.loadoutCopy}>Cog is always in the shop. Clear even waves to unlock more gears.</Text>
            <View style={styles.kitGrid}>
              {kitGears.map((id) => {
                const data = gearBook[id]
                const owned = unlocked.includes(id)
                const picked = loadout.includes(id)
                const at = unlockWaveFor(id)
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggleLoadout(id)}
                    style={[
                      styles.kitCard,
                      picked && styles.selectedCard,
                      !owned && styles.kitLocked,
                      { borderColor: picked ? data.color : '#0a5cab' },
                    ]}
                  >
                    <View style={[styles.cardGear, { backgroundColor: data.color }]}>
                      <Text style={styles.cardMark}>{data.mark}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{data.title}</Text>
                    <Text style={styles.cardDetail}>{owned ? data.detail : `Clear wave ${at}`}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Pressable onPress={startRun} style={[styles.fightButton, loadout.length !== LOADOUT_SIZE && styles.sellDisabled]}>
              <Text style={styles.actionText}>START RUN</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'planning' || phase === 'result' ? (
          <View style={styles.shopPanel}>
            <View style={styles.currencyRow}>
              <Text style={styles.phaseText}>{phase === 'result' ? 'Result ready' : 'Build the machine'}</Text>
              <Text style={styles.phaseText}>{diagnosis.unitCount} live units</Text>
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
                ? 'Ten jobs cleared. Keep the chain on the spinner, mix the loadout, and grab overdrive.'
                : failHint(wave, battle?.leaks ?? 0, diagnosis)}
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
