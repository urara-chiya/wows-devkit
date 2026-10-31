import { PR_CATEGORIES, PR_NORMALIZATION } from 'wows-number-api-sdk'
import { floorsFor, NORMALIZED_FLOORS } from './bands.js'
import type { NormalizedMetric } from './bands.js'
import type { BandPosition, CoreStatMetric, LevelOrdinal, MetricBand } from './types.js'

function bandIndex(value: number, floors: readonly number[]): number {
  let index = 0
  for (let i = 0; i < floors.length; i += 1) {
    if (value >= floors[i]!) index = i + 1
    else break
  }
  return index
}

/** Position for a known band index. */
export function positionAtIndex(
  index: number,
  value: number,
  floors: readonly number[],
): BandPosition | null {
  if (!Number.isFinite(value)) return null

  const floor = index === 0 ? null : floors[index - 1]!
  const nextFloor = index < floors.length ? floors[index]! : null
  const previousFloor = index <= 1 ? null : floors[index - 2]!
  const span = floor === null || nextFloor === null ? null : nextFloor - floor

  return {
    floor,
    previousFloor,
    nextFloor,
    deltaToPrevious: previousFloor === null ? null : value - previousFloor,
    deltaToFloor: floor === null ? null : value - floor,
    deltaToNext: nextFloor === null ? null : nextFloor - value,
    span,
    progress: span === null || span <= 0 ? null : (value - floor!) / span,
  }
}

/** Position inside a floor-based band table. */
export function positionFor(value: number, floors: readonly number[]): BandPosition | null {
  if (!Number.isFinite(value)) return null
  return positionAtIndex(bandIndex(value, floors), value, floors)
}

export function metricBandFor(metric: CoreStatMetric, value: number): MetricBand | null {
  if (!Number.isFinite(value)) return null

  const index = bandIndex(value, floorsFor(metric))
  const position = positionAtIndex(index, value, floorsFor(metric))
  if (position === null) return null
  return {
    ...position,
    key: PR_CATEGORIES[index]!,
    ordinal: (index + 1) as LevelOrdinal,
  }
}

function componentFor(metric: NormalizedMetric): 'damage' | 'frags' | 'wins' {
  return metric === 'win-rate' ? 'wins' : metric
}

/** Convert normalized floors back to actual/expected ratio floors. */
export function ratioFloorsFor(metric: NormalizedMetric): readonly number[] {
  const component = componentFor(metric)
  const { threshold, denominator } = PR_NORMALIZATION[component]
  return NORMALIZED_FLOORS[metric].map((floor) => threshold + floor * denominator)
}

/** Convert normalized floors to raw value floors for a displayed baseline. */
export function rawFloorsFor(metric: NormalizedMetric, expectedValue: number): readonly number[] {
  return ratioFloorsFor(metric).map((floor) => floor * expectedValue)
}
