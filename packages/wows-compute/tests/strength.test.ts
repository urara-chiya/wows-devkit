import { describe, expect, it } from 'vitest'
import type { RatedValue } from '../src/rating/index.js'
import {
  buildPlayerPoints,
  median,
  pairByRole,
  quadrantOf,
  referenceLines,
  summarizePlayers,
  summarizeRoster,
} from '../src/strength/index.js'
import type { PlayerPoint, ShipCatalogLike, ShipRole } from '../src/strength/index.js'
import { fromArenaInfo } from '../src/match/index.js'

function rated(value: number, exact = true, matches = 100): RatedValue {
  return {
    value,
    basis: 'ship',
    exact,
    sample: { kind: 'lifetime', matches },
    baselineVersion: '1',
  }
}

const roster = fromArenaInfo({
  matchGroup: 'pvp',
  gameMode: 7,
  mapId: 1,
  dateTime: '18.10.2026 21:50:36',
  vehicles: [
    { id: 1, name: 'A', shipId: 1, relation: 0 },
    { id: 2, name: 'B', shipId: 2, relation: 1 },
    { id: 3, name: 'C', shipId: 3, relation: 1 },
    { id: 4, name: 'D', shipId: 4, relation: 2 },
  ],
})

const catalog: ShipCatalogLike = {
  role: (shipId) => roles[shipId] ?? 'unknown',
  tier: (shipId) => 10 - shipId,
}

const roles: Record<number, ShipRole> = {
  1: 'destroyer',
  2: 'battleship',
  3: 'cruiser-functional',
  4: 'submarine',
}

const ratings = new Map([
  [1, { pr: rated(1600, true, 1000), winRate: 55, battles: 1000 }],
  [2, { pr: rated(900, false, 200), winRate: 45, battles: 200 }],
  [3, { winRate: 50 }],
])

describe('buildPlayerPoints', () => {
  it('maps roster, ratings and catalog into points', () => {
    const points = buildPlayerPoints(roster, ratings, catalog)

    expect(points).toHaveLength(4)
    expect(points[0]).toMatchObject({
      accountId: 1,
      name: 'A',
      shipId: 1,
      shipRole: 'destroyer',
      tier: 9,
      winRate: 55,
      pr: 1600,
      prExact: true,
      battles: 1000,
      isBot: false,
    })
    expect(points[1]).toMatchObject({ pr: 900, prExact: false, battles: 200 })
    expect(points[2]).toMatchObject({ winRate: 50, pr: null, prExact: false })
    expect(points[3]).toMatchObject({ accountId: 4, pr: null, battles: null })
  })

  it('accepts a bare RatedValue as a rating', () => {
    const points = buildPlayerPoints(roster, new Map([[1, rated(1234)]]), catalog)

    expect(points[0]).toMatchObject({ pr: 1234, prExact: true, battles: 100, winRate: null })
  })

  it('falls back to unknown role and null tier without a catalog', () => {
    const points = buildPlayerPoints(roster, ratings)

    expect(points[0]).toMatchObject({ shipRole: 'unknown', tier: null })
  })

  it('carries relation and extended snapshot fields', () => {
    const points = buildPlayerPoints(
      roster,
      new Map([[1, {
        pr: rated(1500),
        winRate: 54.3,
        battles: 900,
        avgDamage: 50000,
        avgFrags: 1.2,
        hidden: true,
      }]]),
      catalog,
    )

    expect(points[0]).toMatchObject({
      relation: 'self',
      avgDamage: 50000,
      avgFrags: 1.2,
      hidden: true,
    })
    expect(points[1]).toMatchObject({
      relation: 'ally',
      avgDamage: null,
      avgFrags: null,
      hidden: false,
    })
    expect(points[3]).toMatchObject({ relation: 'enemy' })
  })
})

describe('median and referenceLines', () => {
  it('averages the two middle values for an even sample', () => {
    expect(median([1, 3, 2, 4])).toBe(2.5)
    expect(median([3])).toBe(3)
    expect(median([])).toBeNull()
  })

  it('uses only rated points for reference lines', () => {
    const points = buildPlayerPoints(roster, ratings, catalog)

    expect(referenceLines(points)).toEqual({ winRateMedian: 50, prMedian: 1250 })
  })
})

describe('quadrantOf', () => {
  const points = buildPlayerPoints(roster, ratings, catalog)
  const reference = referenceLines(points)

  it('classifies points relative to the medians', () => {
    expect(quadrantOf(points[0]!, reference)).toBe('q1')
    expect(quadrantOf(points[1]!, reference)).toBe('q3')
    expect(quadrantOf(points[2]!, reference)).toBe('unknown')
  })

  it('returns unknown when the reference is missing', () => {
    expect(quadrantOf(points[0]!, { winRateMedian: null, prMedian: 1250 })).toBe('unknown')
  })
})

describe('pairByRole', () => {
  const points = buildPlayerPoints(roster, ratings, catalog)
  const ally = points.filter((point) => point.accountId !== 4)
  const enemy = points.filter((point) => point.accountId === 4)

  it('returns per-role differences in display order without a composite', () => {
    const matchups = pairByRole(ally, enemy, { weights: { submarine: 3 } })

    expect(matchups.map((matchup) => matchup.role)).toEqual([
      'submarine',
      'destroyer',
      'battleship',
      'cruiser-functional',
    ])
    expect(matchups[0]).toMatchObject({
      allyCount: 0,
      enemyCount: 1,
      prDiff: null,
      weight: 3,
      coverage: { total: 1, resolved: 0, hidden: 0, bot: 0, failed: 1 },
    })
    expect(matchups[1]).toMatchObject({
      allyCount: 1,
      allyMedianPr: 1600,
      prDiff: null,
    })
  })

  it('computes medians and differences on both sides', () => {
    const extra = buildPlayerPoints(
      fromArenaInfo({
        matchGroup: 'pvp',
        gameMode: 7,
        mapId: 1,
        vehicles: [{ id: 9, name: 'E', shipId: 1, relation: 2 }],
      }),
      new Map([[9, { pr: rated(1000), winRate: 40, battles: 50 }]]),
      catalog,
    )
    const matchups = pairByRole(ally, [...enemy, ...extra])
    const destroyer = matchups.find((matchup) => matchup.role === 'destroyer')

    expect(destroyer).toMatchObject({
      allyMedianPr: 1600,
      enemyMedianPr: 1000,
      prDiff: 600,
      allyMedianWinRate: 55,
      enemyMedianWinRate: 40,
      winRateDiff: 15,
    })
  })

  it('counts bots and hidden players in coverage', () => {
    const withExtras: PlayerPoint[] = [
      ...ally,
      { ...ally[0]!, accountId: null, isBot: false },
      { ...ally[0]!, accountId: 77, isBot: true },
    ]
    const matchups = pairByRole(withExtras, [])

    for (const matchup of matchups) {
      expect(matchup.coverage.resolved + matchup.coverage.hidden
        + matchup.coverage.bot + matchup.coverage.failed)
        .toBe(matchup.coverage.total)
    }
  })
})

function point(overrides: Partial<PlayerPoint> = {}): PlayerPoint {
  return {
    accountId: 1,
    name: null,
    teamId: null,
    shipId: null,
    shipRole: 'unknown',
    tier: null,
    divisionId: null,
    winRate: null,
    pr: null,
    prExact: false,
    battles: null,
    isBot: false,
    relation: 'ally',
    avgDamage: null,
    avgFrags: null,
    hidden: false,
    ...overrides,
  }
}

describe('summarizePlayers', () => {
  it('averages equal-weight stats across twelve points', () => {
    const points = Array.from({ length: 12 }, (_, index) => point({
      accountId: index + 1,
      winRate: 50 + index,
      avgDamage: 40000 + index * 1000,
      avgFrags: 0.5 + index / 10,
      pr: 1000 + index * 100,
      battles: 100 + index,
    }))

    const summary = summarizePlayers(points)

    expect(summary.total).toBe(12)
    expect(summary.players).toBe(12)
    expect(summary.battles).toBe(1266)
    expect(summary.winRate).toBe(55.5)
    expect(summary.avgDamage).toBe(45500)
    expect(summary.avgFrags).toBeCloseTo(1.05)
    expect(summary.pr).toBe(1550)
    expect(summary.coverage).toEqual({ total: 12, resolved: 12, hidden: 0, bot: 0, failed: 0 })
    expect(summary.prExact).toBe(false)
  })

  it('averages only non-null values per metric', () => {
    const points = [
      point({ winRate: 50, avgDamage: 10000, pr: 1000, battles: 100 }),
      point({ winRate: null, avgDamage: null, avgFrags: 0.8, pr: null, battles: null }),
      point({ winRate: 60, avgDamage: 20000, avgFrags: 1.4, pr: 2000, battles: 300 }),
    ]

    const summary = summarizePlayers(points)

    expect(summary.winRate).toBe(55)
    expect(summary.avgDamage).toBe(15000)
    expect(summary.avgFrags).toBeCloseTo(1.1)
    expect(summary.pr).toBe(1500)
    expect(summary.battles).toBe(400)
  })

  it('treats zero as a valid value', () => {
    const summary = summarizePlayers([
      point({ winRate: 0, avgDamage: 0, avgFrags: 0, pr: 0, battles: 10 }),
    ])

    expect(summary.winRate).toBe(0)
    expect(summary.avgDamage).toBe(0)
    expect(summary.avgFrags).toBe(0)
    expect(summary.pr).toBe(0)
  })

  it('excludes bots from players, battles and averages but counts them in coverage', () => {
    const summary = summarizePlayers([
      point({ winRate: 50, avgDamage: 10000, battles: 100 }),
      point({ isBot: true, winRate: 100, avgDamage: 99999, battles: 999 }),
    ])

    expect(summary.total).toBe(2)
    expect(summary.players).toBe(1)
    expect(summary.battles).toBe(100)
    expect(summary.winRate).toBe(50)
    expect(summary.coverage).toEqual({ total: 2, resolved: 1, hidden: 0, bot: 1, failed: 0 })
  })

  it('classifies hidden and failed slots', () => {
    const summary = summarizePlayers([
      point({ accountId: null, winRate: 50 }),
      point({ accountId: 2, hidden: true, winRate: 40 }),
      point({ accountId: 3 }),
    ])

    expect(summary.coverage).toEqual({ total: 3, resolved: 0, hidden: 2, bot: 0, failed: 1 })
    expect(summary.players).toBe(3)
    expect(summary.winRate).toBe(45)
  })

  it('returns an empty summary for no points', () => {
    expect(summarizePlayers([])).toEqual({
      total: 0,
      players: 0,
      battles: 0,
      coverage: { total: 0, resolved: 0, hidden: 0, bot: 0, failed: 0 },
      winRate: null,
      avgDamage: null,
      avgFrags: null,
      pr: null,
      prExact: false,
    })
  })

  it('weights by battles and skips zero-weight points', () => {
    const points = [
      point({ winRate: 60, battles: 300 }),
      point({ winRate: 40, battles: 100 }),
      point({ winRate: 100, battles: 0 }),
      point({ winRate: 100, battles: null }),
    ]

    expect(summarizePlayers(points).winRate).toBe(75)
    expect(summarizePlayers(points, { weighting: 'battles' }).winRate).toBe(55)
  })

  it('keeps pr null when no player has a rating', () => {
    const summary = summarizePlayers([point({ winRate: 55, battles: 10 })])

    expect(summary.pr).toBeNull()
    expect(summary.winRate).toBe(55)
  })

  it('does not mutate its input', () => {
    const points = [point({ winRate: 50, battles: 10 }), point({ winRate: 60, battles: 20 })]
    const snapshot = structuredClone(points)

    summarizePlayers(points)

    expect(points).toEqual(snapshot)
  })
})

describe('summarizeRoster', () => {
  it('groups sides by relation and reports unassigned slots', () => {
    const points = [
      point({ relation: 'self', winRate: 50 }),
      point({ relation: 'ally', winRate: 60 }),
      point({ relation: 'enemy', winRate: 40 }),
      point({ relation: 'enemy', winRate: 50 }),
      point({ relation: 'unknown', winRate: 99 }),
    ]

    const summary = summarizeRoster(points)

    expect(summary.ally.players).toBe(2)
    expect(summary.ally.winRate).toBe(55)
    expect(summary.enemy.players).toBe(2)
    expect(summary.enemy.winRate).toBe(45)
    expect(summary.unassigned).toBe(1)
  })

  it('returns empty sides for an empty roster', () => {
    const summary = summarizeRoster([])

    expect(summary.ally.total).toBe(0)
    expect(summary.enemy.total).toBe(0)
    expect(summary.unassigned).toBe(0)
  })

  it('keeps the coverage invariant on both sides', () => {
    const points = [
      point({ relation: 'ally', winRate: 50 }),
      point({ relation: 'ally', accountId: null }),
      point({ relation: 'ally', isBot: true }),
      point({ relation: 'enemy' }),
    ]
    const summary = summarizeRoster(points)

    for (const side of [summary.ally, summary.enemy]) {
      expect(side.coverage.resolved + side.coverage.hidden
        + side.coverage.bot + side.coverage.failed)
        .toBe(side.coverage.total)
    }
  })
})
