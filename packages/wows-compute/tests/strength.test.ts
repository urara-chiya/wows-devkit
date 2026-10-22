import { describe, expect, it } from 'vitest'
import type { RatedValue } from '../src/rating/index.js'
import {
  buildPlayerPoints,
  median,
  pairByRole,
  quadrantOf,
  referenceLines,
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
