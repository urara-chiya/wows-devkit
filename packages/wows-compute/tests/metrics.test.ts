import { describe, expect, it } from 'vitest'
import { LATEST_MAPPING } from 'wows-replay-parser'
import {
  METRICS,
  deriveMetrics,
  metricSourceFields,
} from '../src/metrics/index.js'
import type { MetricDefinition } from '../src/metrics/index.js'

describe('METRICS', () => {
  it('references only fields present in the latest mapping', () => {
    const fields = metricSourceFields()
    const missing = fields.filter((field) => !(field in LATEST_MAPPING.publicResultIndices))

    expect(missing).toEqual([])
    expect(fields.length).toBeGreaterThan(0)
  })

  it('uses unique keys', () => {
    expect(new Set(METRICS.map((metric) => metric.key)).size).toBe(METRICS.length)
  })
})

describe('deriveMetrics', () => {
  it('reads single fields and sums', () => {
    const values = deriveMetrics({
      damage: 100000,
      ships_killed: 2,
      scouting_damage: 3000,
      agro_air: 1000,
      agro_art: 2000,
      agro_dbomb: 3000,
      agro_tpd: 4000,
      life_time_sec: 720,
      hits_main_he: 10,
      hits_main_ap: 20,
      hits_main_cs: 30,
      hits_tpd: 4,
    })

    expect(values.damage).toBe(100000)
    expect(values.frags).toBe(2)
    expect(values.scoutingDamage).toBe(3000)
    expect(values.potentialDamage).toBe(10000)
    expect(values.lifeTimeSec).toBe(720)
    expect(values.mainBatteryHits).toBe(60)
    expect(values.torpedoHits).toBe(4)
  })

  it('returns null for missing or non-numeric fields instead of zero', () => {
    const values = deriveMetrics({ damage: 100 })

    expect(values.damage).toBe(100)
    expect(values.frags).toBeNull()
    expect(values.potentialDamage).toBeNull()
    expect(values.mainBatteryHits).toBeNull()
  })

  it('supports ratio metrics and guards division by zero', () => {
    const ratio: MetricDefinition = {
      key: 'accuracy',
      labelKey: 'metric.accuracy',
      unit: 'percent',
      direction: 'higher-is-better',
      aggregation: 'ratio',
      source: { ratio: ['hits', 'shots'] },
    }

    expect(deriveMetrics({ hits: 25, shots: 100 }, [ratio]).accuracy).toBe(0.25)
    expect(deriveMetrics({ hits: 25, shots: 0 }, [ratio]).accuracy).toBeNull()
    expect(deriveMetrics({ hits: '25', shots: 100 }, [ratio]).accuracy).toBeNull()
  })

  it('ignores non-finite numbers in sums', () => {
    const values = deriveMetrics({
      damage: Number.NaN,
      hits_main_he: 10,
      hits_main_ap: Number.POSITIVE_INFINITY,
    })

    expect(values.damage).toBeNull()
    expect(values.mainBatteryHits).toBe(10)
  })
})
