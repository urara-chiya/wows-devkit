import { describe, expect, it } from 'vitest'
import { calculatePR } from 'wows-number-api-sdk'
import type { ExpectedValuesDocument, ShipBattleStats } from 'wows-number-api-sdk'
import {
  accountPrEstimated,
  accountPrPooled,
  battlePr,
  shipPr,
} from '../src/rating/index.js'
import { levelOf } from '../src/levels/index.js'

const expected: ExpectedValuesDocument = {
  time: 1761000000,
  data: {
    1: { average_damage_dealt: 40000, average_frags: 0.7, win_rate: 50 },
    2: { average_damage_dealt: 80000, average_frags: 1, win_rate: 52 },
    3: [],
    4: { average_damage_dealt: 20000, average_frags: 0.2, win_rate: 40 },
  },
}

describe('shipPr', () => {
  it('matches the SDK formula for one ship', () => {
    const stats: ShipBattleStats = {
      shipId: 1,
      battles: 100,
      damage: 4_500_000,
      frags: 80,
      wins: 55,
    }
    const expectedResult = calculatePR([stats], expected)

    expect(shipPr(stats, expected)?.value).toBeCloseTo(expectedResult!.pr, 10)
    expect(shipPr(stats, expected)).toMatchObject({
      basis: 'ship',
      exact: true,
      baselineVersion: '1761000000',
      sample: { kind: 'lifetime', matches: 100 },
    })
  })

  it('returns null when the ship has no expected values', () => {
    expect(shipPr({ shipId: 3, battles: 10, damage: 1, frags: 1, wins: 5 }, expected)).toBeNull()
  })

  it('returns null when the battle count is zero', () => {
    expect(shipPr({ shipId: 1, battles: 0, damage: 0, frags: 0, wins: 0 }, expected)).toBeNull()
  })
})

describe('battlePr', () => {
  it('rates a single battle as exact', () => {
    const rating = battlePr({ shipId: 1, damage: 60000, frags: 1, win: true }, expected)

    expect(rating?.exact).toBe(true)
    expect(rating?.sample).toEqual({ kind: 'match', matches: 1 })
  })
})

describe('accountPrEstimated', () => {
  const account = { battles: 1000, damage: 50_000_000, frags: 700, wins: 520 }

  it('equals the SDK formula applied to a synthetic ship', () => {
    const synthetic = calculatePR(
      [{ shipId: '__account__', battles: 1000, damage: 50_000_000, frags: 700, wins: 520 }],
      {
        time: expected.time,
        data: {
          __account__: {
            average_damage_dealt: (40000 + 80000 + 20000) / 3,
            average_frags: (0.7 + 1 + 0.2) / 3,
            win_rate: (50 + 52 + 40) / 3,
          },
        },
      },
    )

    const rating = accountPrEstimated(account, expected)
    expect(rating?.value).toBeCloseTo(synthetic!.pr, 10)
    expect(rating?.exact).toBe(false)
    expect(rating?.bias).toEqual({ direction: 'unknown', reason: 'insufficient-data' })
  })

  it('reports an overestimate when the ship mix is heavier than average', () => {
    const rating = accountPrEstimated(account, expected, { shipMix: [{ shipId: 2, battles: 100 }] })

    expect(rating?.bias?.direction).toBe('overestimate')
    expect(rating?.bias?.delta?.damage).toBeCloseTo(80000 / ((40000 + 80000 + 20000) / 3) - 1, 10)
  })

  it('reports mixed when the three baselines disagree', () => {
    const rating = accountPrEstimated(account, expected, { shipMix: [{ shipId: 1, battles: 100 }] })
    expect(rating?.bias?.direction).toBe('mixed')
  })

  it('does not guess when the ship mix has no expected values', () => {
    const rating = accountPrEstimated(account, expected, { shipMix: [{ shipId: 3, battles: 100 }] })
    expect(rating?.bias).toEqual({ direction: 'unknown', reason: 'insufficient-data' })
  })

  it('returns null for an empty account', () => {
    expect(accountPrEstimated({ battles: 0, damage: 0, frags: 0, wins: 0 }, expected)).toBeNull()
  })
})

describe('accountPrPooled', () => {
  it('pools per-ship stats and matches calculatePR', () => {
    const ships: ShipBattleStats[] = [
      { shipId: 1, battles: 100, damage: 4_500_000, frags: 80, wins: 55 },
      { shipId: 2, battles: 50, damage: 3_000_000, frags: 40, wins: 30 },
      { shipId: 3, battles: 10, damage: 999_999, frags: 9, wins: 9 },
    ]
    const sample = { kind: 'ingested' as const, matches: 160 }
    const rating = accountPrPooled(ships, expected, sample)

    expect(rating?.value).toBeCloseTo(calculatePR(ships, expected)!.pr, 10)
    expect(rating).toMatchObject({ basis: 'account', exact: true, sample })
  })

  it('returns null when no ship has expected values', () => {
    const ships: ShipBattleStats[] = [{ shipId: 3, battles: 10, damage: 1, frags: 1, wins: 5 }]
    expect(accountPrPooled(ships, expected, { kind: 'ingested', matches: 10 })).toBeNull()
  })
})

describe('levelOf', () => {
  it('uses an inclusive floor', () => {
    expect(levelOf('pr', 750)).toMatchObject({ levelKey: 'below-average', floor: 750 })
    expect(levelOf('pr', 749.9)).toMatchObject({ levelKey: 'bad', nextFloor: 750 })
  })

  it('reports distances to both thresholds', () => {
    expect(levelOf('pr', 1200)).toEqual({
      levelKey: 'average',
      floor: 1100,
      nextFloor: 1350,
      deltaToFloor: 100,
      deltaToNext: 150,
    })
    expect(levelOf('pr', 3000)).toMatchObject({ levelKey: 'super-unicum', nextFloor: null, deltaToNext: null })
  })

  it('supports win-rate bands', () => {
    expect(levelOf('win-rate', 47)).toMatchObject({ levelKey: 'below-average', floor: 47 })
  })
})
