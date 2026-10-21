import { shipExpectedValues } from './expected-values.js'
import type {
  ExpectedValuesDocument,
  PersonalRatingCategory,
  PersonalRatingResult,
  ShipBattleStats,
  SingleBattleInput,
} from './types.js'

export interface RatingBand {
  category: PersonalRatingCategory
  /** Inclusive lower bound. `null` for the lowest band. */
  floor: number | null
  label: string
}

/** Personal-rating bands as published by wows-numbers.com. */
export const PR_BANDS: readonly RatingBand[] = [
  { category: 'bad', floor: null, label: 'Bad' },
  { category: 'below-average', floor: 750, label: 'Below Average' },
  { category: 'average', floor: 1100, label: 'Average' },
  { category: 'good', floor: 1350, label: 'Good' },
  { category: 'very-good', floor: 1550, label: 'Very Good' },
  { category: 'great', floor: 1750, label: 'Great' },
  { category: 'unicum', floor: 2100, label: 'Unicum' },
  { category: 'super-unicum', floor: 2450, label: 'Super Unicum' },
]

/** Win-rate bands (percentages) used to colour player rows. */
export const WIN_RATE_BANDS: readonly RatingBand[] = [
  { category: 'bad', floor: null, label: 'Bad' },
  { category: 'below-average', floor: 47, label: 'Below Average' },
  { category: 'average', floor: 50, label: 'Average' },
  { category: 'good', floor: 52, label: 'Good' },
  { category: 'very-good', floor: 54, label: 'Very Good' },
  { category: 'great', floor: 56, label: 'Great' },
  { category: 'unicum', floor: 60, label: 'Unicum' },
  { category: 'super-unicum', floor: 65, label: 'Super Unicum' },
]

export const PR_CATEGORY_LABELS: Record<PersonalRatingCategory, string> = Object.fromEntries(
  PR_BANDS.map((band) => [band.category, band.label]),
) as Record<PersonalRatingCategory, string>

function categoryFor(value: number, bands: readonly RatingBand[]): PersonalRatingCategory {
  for (let index = bands.length - 1; index >= 0; index -= 1) {
    const band = bands[index]!
    if (band.floor === null || value >= band.floor) return band.category
  }
  return 'bad'
}

export function prCategory(pr: number): PersonalRatingCategory {
  return categoryFor(pr, PR_BANDS)
}

/** `winRate` is a percentage, e.g. `54.3`. */
export function winRateCategory(winRate: number): PersonalRatingCategory {
  return categoryFor(winRate, WIN_RATE_BANDS)
}

/**
 * Computes Personal Rating following the wows-numbers formula.
 *
 * - Ships missing from the expected-values table are skipped entirely.
 * - Returns `null` when no rated ship has expected values, or when a
 *   denominator is zero/non-finite.
 */
export function calculatePR(
  stats: readonly ShipBattleStats[],
  expected: ExpectedValuesDocument,
): PersonalRatingResult | null {
  if (stats.length === 0) return null

  let actualDamage = 0
  let actualFrags = 0
  let actualWins = 0
  let expectedDamage = 0
  let expectedFrags = 0
  let expectedWins = 0
  let validBattles = 0

  for (const ship of stats) {
    if (!Number.isFinite(ship.battles) || ship.battles <= 0) continue

    const values = shipExpectedValues(expected, ship.shipId)
    if (values === null) continue

    const battles = ship.battles
    actualDamage += ship.damage
    actualFrags += ship.frags
    actualWins += ship.wins
    expectedDamage += values.average_damage_dealt * battles
    expectedFrags += values.average_frags * battles
    expectedWins += (values.win_rate / 100) * battles
    validBattles += battles
  }

  if (validBattles === 0) return null
  if (![expectedDamage, expectedFrags, expectedWins].every((v) => Number.isFinite(v) && v > 0)) {
    return null
  }
  if (![actualDamage, actualFrags, actualWins].every(Number.isFinite)) return null

  const rDamage = actualDamage / expectedDamage
  const rFrags = actualFrags / expectedFrags
  const rWins = actualWins / expectedWins

  const nDamage = Math.max(0, (rDamage - 0.4) / 0.6)
  const nFrags = Math.max(0, (rFrags - 0.1) / 0.9)
  const nWins = Math.max(0, (rWins - 0.7) / 0.3)

  const pr = 700 * nDamage + 300 * nFrags + 150 * nWins
  if (!Number.isFinite(pr)) return null

  return { pr, category: prCategory(pr) }
}

/** Rates a single battle: one battle, one win or loss. */
export function calculateBattlePR(
  battle: SingleBattleInput,
  expected: ExpectedValuesDocument,
): PersonalRatingResult | null {
  return calculatePR(
    [
      {
        shipId: battle.shipId,
        battles: 1,
        damage: battle.damage,
        frags: battle.frags,
        wins: battle.win ? 1 : 0,
      },
    ],
    expected,
  )
}
