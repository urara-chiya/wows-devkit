import { describe, expect, it } from 'vitest'
import type { ExpectedValuesDocument } from 'wows-number-api-sdk'
import {
  accountLevels,
  accountLevelsEstimated,
  evaluateCoreStats,
  shipLevels,
} from '../src/levels/index.js'
import type { LevelBaseline, ShipStatTotals } from '../src/levels/index.js'

const baseline: LevelBaseline = {
  winRate: 50,
  damage: 50_000,
  frags: 1,
  battles: 100,
  ships: 1,
  exact: true,
  baselineVersion: '1',
}

const expected: ExpectedValuesDocument = {
  time: 1,
  data: {
    1: { average_damage_dealt: 50_000, average_frags: 1, win_rate: 50 },
  },
}

function evaluate(overrides: {
  winRate?: number | null
  avgDamage?: number | null
  avgFrags?: number | null
  expTotal?: number | null
  battles?: number
  pr?: number | null
  baseline?: LevelBaseline | null
}) {
  return evaluateCoreStats({
    winRate: overrides.winRate ?? null,
    avgDamage: overrides.avgDamage ?? null,
    avgFrags: overrides.avgFrags ?? null,
    expTotal: overrides.expTotal ?? null,
    battles: overrides.battles ?? 100,
    pr: overrides.pr ?? null,
    baseline: 'baseline' in overrides ? overrides.baseline : baseline,
  })
}

describe('evaluateCoreStats', () => {
  it('puts PR 750 into the second tier', () => {
    expect(evaluate({ pr: 750 }).pr?.band.key).toBe('below-average')
    expect(evaluate({ pr: 749.99 }).pr?.band.key).toBe('bad')
  })

  it('puts XP 700 into the second tier', () => {
    expect(evaluate({ expTotal: 70_000, battles: 100 }).xp?.band.key).toBe('below-average')
    expect(evaluate({ expTotal: 69_999, battles: 100 }).xp?.band.key).toBe('bad')
  })

  it('normalizes damage, win rate and frags against the baseline', () => {
    const result = evaluate({
      winRate: 47,
      avgDamage: 41_000,
      avgFrags: 0.64,
    })

    expect(result.winRate?.normalized).toBeCloseTo(0.8, 10)
    expect(result.damage?.normalized).toBeCloseTo(0.7, 10)
    expect(result.frags?.normalized).toBeCloseTo(0.6, 10)
    expect(result.winRate?.band.key).toBe('below-average')
    expect(result.damage?.band.key).toBe('below-average')
    expect(result.frags?.band.key).toBe('below-average')
  })

  it('keeps values just below a floor in the previous tier', () => {
    const result = evaluate({
      winRate: 46.99,
      avgDamage: 40_999,
      avgFrags: 0.639,
    })

    expect(result.winRate?.band.key).toBe('bad')
    expect(result.damage?.band.key).toBe('bad')
    expect(result.frags?.band.key).toBe('bad')
  })

  it('reports ratio and raw band positions for normalized metrics', () => {
    const result = evaluate({ avgDamage: 41_000, avgFrags: 1, winRate: 50 })
    const damage = result.damage!

    expect(damage.ratio).toBeCloseTo(0.82, 10)
    expect(damage.ratioBand?.floor).toBeCloseTo(0.82, 10)
    expect(damage.ratioBand?.nextFloor).toBeCloseTo(0.94, 10)
    expect(damage.rawBand?.floor).toBeCloseTo(41_000, 10)
    expect(damage.rawBand?.nextFloor).toBeCloseTo(47_000, 10)
    expect(damage.ratioBand?.deltaToNext).toBeCloseTo(0.12, 10)
  })

  it('returns normalized levels as null without a baseline', () => {
    const result = evaluate({ winRate: 50, avgDamage: 50_000, avgFrags: 1, pr: 750, baseline: null })

    expect(result.winRate).toBeNull()
    expect(result.damage).toBeNull()
    expect(result.frags).toBeNull()
    expect(result.pr?.band.key).toBe('below-average')
  })

  it('uses expBattles for the XP average', () => {
    const result = evaluateCoreStats({
      winRate: null,
      avgDamage: null,
      avgFrags: null,
      expTotal: 7_000,
      expBattles: 10,
      battles: 100,
      pr: null,
    })

    expect(result.xp?.value).toBe(700)
    expect(result.xp?.band.key).toBe('below-average')
    expect(result.xp?.sample.battles).toBe(10)
  })
})

describe('shipLevels', () => {
  const stats: ShipStatTotals = {
    shipId: 1,
    battles: 100,
    damage: 5_000_000,
    frags: 100,
    wins: 50,
    exp: 70_000,
  }

  it('computes all five levels from one ship', () => {
    const levels = shipLevels(stats, expected)

    expect(levels.winRate?.band.key).toBe('average')
    expect(levels.damage?.band.key).toBe('average')
    expect(levels.frags?.band.key).toBe('average')
    expect(levels.pr?.band.key).toBe('average')
    expect(levels.xp?.band.key).toBe('below-average')
    expect(levels.winRate?.sample.ships).toBe(1)
  })
})

describe('accountLevels', () => {
  const ships: ShipStatTotals[] = [
    {
      shipId: 1,
      battles: 100,
      damage: 5_000_000,
      frags: 100,
      wins: 50,
      exp: 70_000,
    },
  ]

  it('pools expected values for an exact account level', () => {
    const levels = accountLevels(ships, expected, { kind: 'lifetime', matches: 100 })

    expect(levels.damage?.sample.exact).toBe(true)
    expect(levels.damage?.normalized).toBeCloseTo(1, 10)
    expect(levels.damage?.band.key).toBe('average')
  })

  it('marks PR* levels as estimated', () => {
    const levels = accountLevelsEstimated(
      { battles: 100, wins: 50, damage: 5_000_000, frags: 100, exp: 70_000 },
      expected,
    )

    expect(levels.pr?.sample.exact).toBe(false)
    expect(levels.pr?.sample.aggregation).toBe('estimated')
    expect(levels.damage?.sample.exact).toBe(false)
  })
})
