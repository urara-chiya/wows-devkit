import type { PrComponents } from 'wows-number-api-sdk'
import type { LevelBaseline } from './types.js'

export interface BaselineFromComponentsOptions {
  ships: number
  exact?: boolean
  baselineVersion?: string | null
}

/** Build per-battle expected values from pooled PR components. */
export function baselineFromComponents(
  components: PrComponents,
  options: BaselineFromComponentsOptions,
): LevelBaseline | null {
  const battles = components.battles
  if (!Number.isFinite(battles) || battles <= 0) return null

  return {
    winRate: (components.expected.wins / battles) * 100,
    damage: components.expected.damage / battles,
    frags: components.expected.frags / battles,
    battles,
    ships: options.ships,
    exact: options.exact ?? true,
    baselineVersion: options.baselineVersion ?? null,
  }
}
