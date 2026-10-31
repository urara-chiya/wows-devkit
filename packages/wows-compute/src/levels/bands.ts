import type { CoreStatMetric } from './types.js'

/** Bump when any floor below changes. */
export const LEVEL_RULE_VERSION = 'meiro-core-level-v1'

/** Inclusive lower bounds. Seven floors define eight categories. */
export const PR_FLOORS = [750, 1100, 1350, 1550, 1750, 2100, 2450] as const

export const XP_FLOORS = [700, 900, 1100, 1400, 1700, 2100, 2400] as const

export const NORMALIZED_FLOORS = {
  'win-rate': [0.8, 0.9, 1.1, 1.2, 1.3, 1.4, 1.5],
  damage: [0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9],
  frags: [0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0],
} as const

const ABSOLUTE_FLOORS: Record<'pr' | 'xp', readonly number[]> = {
  pr: PR_FLOORS,
  xp: XP_FLOORS,
}

export function floorsFor(metric: CoreStatMetric): readonly number[] {
  if (metric === 'pr' || metric === 'xp') return ABSOLUTE_FLOORS[metric]
  return NORMALIZED_FLOORS[metric]
}

export type NormalizedMetric = keyof typeof NORMALIZED_FLOORS

export function isNormalizedMetric(metric: CoreStatMetric): metric is NormalizedMetric {
  return metric === 'win-rate' || metric === 'damage' || metric === 'frags'
}
