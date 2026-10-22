import { PR_BANDS, WIN_RATE_BANDS, prCategory, winRateCategory } from 'wows-number-api-sdk'
import type { PersonalRatingCategory } from 'wows-number-api-sdk'

export type LevelKind = 'pr' | 'win-rate'

export interface LevelResult {
  levelKey: PersonalRatingCategory
  /** Inclusive lower bound of the hit band; `null` for the lowest band. */
  floor: number | null
  /** Lower bound of the next band; `null` for the highest band. */
  nextFloor: number | null
  deltaToFloor: number | null
  deltaToNext: number | null
}

/** Level key plus thresholds. Labels and colors belong to the application. */
export function levelOf(kind: LevelKind, value: number): LevelResult | null {
  if (!Number.isFinite(value)) return null

  const bands = kind === 'pr' ? PR_BANDS : WIN_RATE_BANDS
  const levelKey = kind === 'pr' ? prCategory(value) : winRateCategory(value)
  const index = bands.findIndex((band) => band.category === levelKey)
  const band = bands[index]
  if (band === undefined) return null

  const next = bands[index + 1]
  const nextFloor = next?.floor ?? null
  return {
    levelKey,
    floor: band.floor,
    nextFloor,
    deltaToFloor: band.floor === null ? null : value - band.floor,
    deltaToNext: nextFloor === null ? null : nextFloor - value,
  }
}
