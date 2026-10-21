/** Expected values for a single ship. */
export interface ShipExpectedValues {
  average_damage_dealt: number
  average_frags: number
  /** Win rate as a percentage (0–100), not a 0–1 fraction. */
  win_rate: number
}

/** Empty array means the ship has no usable expected values. */
export type ShipExpectedValuesEntry = ShipExpectedValues | []

export interface ExpectedValuesDocument {
  /** Unix timestamp in seconds. Not used for cache expiry. */
  time: number
  data: Record<string, ShipExpectedValuesEntry>
}

export const PR_CATEGORIES = [
  'bad',
  'below-average',
  'average',
  'good',
  'very-good',
  'great',
  'unicum',
  'super-unicum',
] as const

export type PersonalRatingCategory = (typeof PR_CATEGORIES)[number]

export interface PersonalRatingResult {
  pr: number
  category: PersonalRatingCategory
}

/** Aggregated stats for one ship over any number of battles. */
export interface ShipBattleStats {
  shipId: number | string
  battles: number
  damage: number
  wins: number
  frags: number
}

export interface SingleBattleInput {
  shipId: number | string
  damage: number
  frags: number
  win: boolean
}
