import { describe, expect, it } from 'vitest'
import {
  calculateBattlePR,
  calculatePR,
  prCategory,
  PR_BANDS,
  winRateCategory,
  type ExpectedValuesDocument,
} from '../src'

function expected(
  values = { average_damage_dealt: 100_000, average_frags: 1, win_rate: 50 },
): ExpectedValuesDocument {
  return { time: 1, data: { '1': values } }
}

describe('calculatePR', () => {
  it('returns 1150 when every metric matches expectations', () => {
    const result = calculatePR(
      [{ shipId: 1, battles: 10, damage: 1_000_000, frags: 10, wins: 5 }],
      expected(),
    )

    expect(result).not.toBeNull()
    expect(result!.pr).toBeCloseTo(1150, 10)
    expect(result!.category).toBe('average')
  })

  it('returns 0 for empty stats against valid expectations', () => {
    const result = calculatePR(
      [{ shipId: 1, battles: 1, damage: 0, frags: 0, wins: 0 }],
      expected(),
    )

    expect(result!.pr).toBe(0)
    expect(result!.category).toBe('bad')
  })

  it('skips ships without expected values', () => {
    const result = calculatePR(
      [{ shipId: 999, battles: 100, damage: 10_000_000, frags: 100, wins: 90 }],
      expected(),
    )

    expect(result).toBeNull()
  })

  it('aggregates only ships that have expected values', () => {
    const result = calculatePR(
      [
        { shipId: 1, battles: 10, damage: 1_000_000, frags: 10, wins: 5 },
        { shipId: 999, battles: 90, damage: 0, frags: 0, wins: 0 },
      ],
      expected(),
    )

    expect(result!.pr).toBeCloseTo(1150, 10)
  })

  it('returns null when a denominator is zero', () => {
    const result = calculatePR(
      [{ shipId: 1, battles: 1, damage: 0, frags: 0, wins: 0 }],
      {
        time: 1,
        data: {
          '1': { average_damage_dealt: 100, average_frags: 0, win_rate: 50 },
        },
      },
    )

    expect(result).toBeNull()
  })

  it('ignores non-positive battle counts', () => {
    const result = calculatePR(
      [{ shipId: 1, battles: 0, damage: 1, frags: 1, wins: 1 }],
      expected(),
    )

    expect(result).toBeNull()
  })

  it('rates a single battle', () => {
    const result = calculateBattlePR(
      { shipId: 1, damage: 100_000, frags: 1, win: true },
      expected({ average_damage_dealt: 100_000, average_frags: 1, win_rate: 100 }),
    )

    expect(result!.pr).toBeCloseTo(1150, 10)
  })
})

describe('categories', () => {
  it('assigns PR bands at their inclusive floors', () => {
    const cases: Array<[number, string]> = [
      [0, 'bad'],
      [749.99, 'bad'],
      [750, 'below-average'],
      [1099.99, 'below-average'],
      [1100, 'average'],
      [1349.99, 'average'],
      [1350, 'good'],
      [1549.99, 'good'],
      [1550, 'very-good'],
      [1749.99, 'very-good'],
      [1750, 'great'],
      [2099.99, 'great'],
      [2100, 'unicum'],
      [2449.99, 'unicum'],
      [2450, 'super-unicum'],
    ]

    for (const [pr, category] of cases) {
      expect(prCategory(pr)).toBe(category)
    }
  })

  it('assigns win-rate bands as percentages', () => {
    expect(winRateCategory(46.9)).toBe('bad')
    expect(winRateCategory(47)).toBe('below-average')
    expect(winRateCategory(54.3)).toBe('very-good')
    expect(winRateCategory(65)).toBe('super-unicum')
  })

  it('keeps every band ordered and labeled', () => {
    expect(PR_BANDS.map((band) => band.category)).toEqual([
      'bad',
      'below-average',
      'average',
      'good',
      'very-good',
      'great',
      'unicum',
      'super-unicum',
    ])
    expect(PR_BANDS[7]!.label).toBe('Super Unicum')
  })
})
