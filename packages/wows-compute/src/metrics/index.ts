export type MetricUnit = 'damage' | 'count' | 'percent' | 'seconds' | 'score'

export type MetricDirection = 'higher-is-better' | 'lower-is-better' | 'neutral'

export type MetricAggregation = 'sum' | 'mean' | 'ratio' | 'max'

export interface MetricSource {
  field?: string
  sum?: readonly string[]
  ratio?: readonly [string, string]
}

export interface MetricDefinition {
  key: string
  labelKey: string
  unit: MetricUnit
  direction: MetricDirection
  aggregation: MetricAggregation
  source: MetricSource
  sinceMappingVersion?: string
}

/**
 * v1 field dictionary.
 *
 * Only semantic wrappers over raw result fields live here; values are not
 * copied into new storage. Every source field must exist in the replay field
 * mapping, which the test suite asserts.
 */
export const METRICS: readonly MetricDefinition[] = [
  {
    key: 'damage',
    labelKey: 'metric.damage',
    unit: 'damage',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'damage' },
  },
  {
    key: 'frags',
    labelKey: 'metric.frags',
    unit: 'count',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'ships_killed' },
  },
  {
    key: 'scoutingDamage',
    labelKey: 'metric.scoutingDamage',
    unit: 'damage',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'scouting_damage' },
  },
  {
    key: 'potentialDamage',
    labelKey: 'metric.potentialDamage',
    unit: 'damage',
    direction: 'neutral',
    aggregation: 'sum',
    source: { sum: ['agro_air', 'agro_art', 'agro_dbomb', 'agro_tpd'] },
  },
  {
    key: 'lifeTimeSec',
    labelKey: 'metric.lifeTimeSec',
    unit: 'seconds',
    direction: 'neutral',
    aggregation: 'mean',
    source: { field: 'life_time_sec' },
  },
  {
    key: 'capturePoints',
    labelKey: 'metric.capturePoints',
    unit: 'score',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'capture_points' },
  },
  {
    key: 'droppedCapturePoints',
    labelKey: 'metric.droppedCapturePoints',
    unit: 'score',
    direction: 'lower-is-better',
    aggregation: 'sum',
    source: { field: 'dropped_capture_points' },
  },
  {
    key: 'exp',
    labelKey: 'metric.exp',
    unit: 'score',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'exp' },
  },
  {
    key: 'rawExp',
    labelKey: 'metric.rawExp',
    unit: 'score',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'raw_exp' },
  },
  {
    key: 'planesKilled',
    labelKey: 'metric.planesKilled',
    unit: 'count',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'planes_killed_by_ship' },
  },
  {
    key: 'mainBatteryHits',
    labelKey: 'metric.mainBatteryHits',
    unit: 'count',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { sum: ['hits_main_he', 'hits_main_ap', 'hits_main_cs'] },
  },
  {
    key: 'torpedoHits',
    labelKey: 'metric.torpedoHits',
    unit: 'count',
    direction: 'higher-is-better',
    aggregation: 'sum',
    source: { field: 'hits_tpd' },
  },
]

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function resolveMetric(fields: Record<string, unknown>, definition: MetricDefinition): number | null {
  const { source } = definition

  if (source.field !== undefined) return numeric(fields[source.field])

  if (source.sum !== undefined) {
    let total = 0
    let found = false
    for (const field of source.sum) {
      const value = numeric(fields[field])
      if (value === null) continue
      total += value
      found = true
    }
    return found ? total : null
  }

  if (source.ratio !== undefined) {
    const numerator = numeric(fields[source.ratio[0]])
    const denominator = numeric(fields[source.ratio[1]])
    if (numerator === null || denominator === null || denominator === 0) return null
    return numerator / denominator
  }

  return null
}

/** Derives metric values from one player's raw result fields. */
export function deriveMetrics(
  fields: Record<string, unknown>,
  metrics: readonly MetricDefinition[] = METRICS,
): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const definition of metrics) {
    result[definition.key] = resolveMetric(fields, definition)
  }
  return result
}

/** Field names referenced by a set of metric definitions. */
export function metricSourceFields(
  metrics: readonly MetricDefinition[] = METRICS,
): string[] {
  const fields = new Set<string>()
  for (const definition of metrics) {
    const { source } = definition
    if (source.field !== undefined) fields.add(source.field)
    if (source.sum !== undefined) for (const field of source.sum) fields.add(field)
    if (source.ratio !== undefined) for (const field of source.ratio) fields.add(field)
  }
  return [...fields]
}
