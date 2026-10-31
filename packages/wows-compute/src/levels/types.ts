import type { PersonalRatingCategory, ShipBattleStats } from 'wows-number-api-sdk'
import type { Coverage } from '../aggregate/index.js'
import type { EstimateBias } from '../rating/index.js'

export type CoreStatMetric = 'win-rate' | 'damage' | 'frags' | 'pr' | 'xp'

export type LevelBasis = 'absolute' | 'normalized'

export type LevelOrdinal = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type LevelAggregation = 'pooled' | 'equal-weight' | 'estimated'

export interface BandPosition {
  floor: number | null
  previousFloor: number | null
  nextFloor: number | null
  deltaToPrevious: number | null
  deltaToFloor: number | null
  deltaToNext: number | null
  span: number | null
  /** Position inside the band, 0–1. `null` for open-ended bands. */
  progress: number | null
}

export interface MetricBand extends BandPosition {
  key: PersonalRatingCategory
  ordinal: LevelOrdinal
}

export interface LevelSample {
  battles: number
  ships: number
  exact: boolean
  aggregation: LevelAggregation
  baselineVersion: string | null
  coverage?: Coverage
  /** Only present for estimated account ratings (PR*). */
  bias?: EstimateBias
}

export interface MetricLevel {
  metric: CoreStatMetric
  basis: LevelBasis
  /** Displayed value: win rate percent, average damage/frags, PR, average XP. */
  value: number
  /** Baseline per-battle value for normalized metrics. */
  expectedValue: number | null
  /** Actual / expected for normalized metrics. */
  ratio: number | null
  /** nDmg / nWins / nFrags for normalized metrics. */
  normalized: number | null
  band: MetricBand
  ratioBand: BandPosition | null
  rawBand: BandPosition | null
  sample: LevelSample
  ruleVersion: string
}

export interface CoreStatsLevels {
  winRate: MetricLevel | null
  damage: MetricLevel | null
  frags: MetricLevel | null
  pr: MetricLevel | null
  xp: MetricLevel | null
}

export interface LevelBaseline {
  /** Expected win rate percentage, e.g. `50`. */
  winRate: number | null
  /** Expected average damage per battle. */
  damage: number | null
  /** Expected average frags per battle. */
  frags: number | null
  battles: number
  ships: number
  exact: boolean
  baselineVersion: string | null
}

export interface CoreStatsLevelInput {
  winRate: number | null
  avgDamage: number | null
  avgFrags: number | null
  /** Caller chooses `exp` or `rawExp`; the level module only divides by battles. */
  expTotal: number | null
  /** Battles that carry a usable exp value; defaults to `battles`. */
  expBattles?: number
  battles: number
  pr: number | null
  baseline?: LevelBaseline | null
  sample?: Partial<LevelSample>
}

/** Ship totals with experience; structurally compatible with `ShipBattleStats`. */
export interface ShipStatTotals extends ShipBattleStats {
  exp: number
}

export interface AccountStatTotals {
  battles: number
  wins: number
  damage: number
  frags: number
  exp: number
}
