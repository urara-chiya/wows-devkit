import { normalizePrRatio } from 'wows-number-api-sdk'
import type { ExpectedValuesDocument } from 'wows-number-api-sdk'
import {
  accountPrEstimated,
  accountPrPooled,
  shipPr,
} from '../rating/index.js'
import type {
  AccountPrOptions,
  RatedValue,
  SampleDescriptor,
} from '../rating/index.js'
import { baselineFromComponents } from './baseline.js'
import { LEVEL_RULE_VERSION } from './bands.js'
import { metricBandFor, positionAtIndex, rawFloorsFor, ratioFloorsFor } from './evaluate.js'
import type {
  AccountStatTotals,
  CoreStatsLevelInput,
  CoreStatsLevels,
  LevelSample,
  MetricLevel,
  ShipStatTotals,
} from './types.js'

function finiteValue(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

function sampleFor(
  input: CoreStatsLevelInput,
  defaults: Partial<LevelSample>,
): LevelSample {
  const source = input.sample ?? {}
  return {
    battles: defaults.battles ?? input.battles,
    ships: defaults.ships ?? 0,
    exact: defaults.exact ?? true,
    aggregation: defaults.aggregation ?? 'pooled',
    baselineVersion: defaults.baselineVersion ?? null,
    ...(defaults.coverage !== undefined ? { coverage: defaults.coverage } : {}),
    ...(defaults.bias !== undefined ? { bias: defaults.bias } : {}),
    ...source,
  }
}

function normalizedLevel(
  metric: 'win-rate' | 'damage' | 'frags',
  value: number,
  expectedValue: number,
  sample: LevelSample,
): MetricLevel | null {
  if (!Number.isFinite(value) || !Number.isFinite(expectedValue) || expectedValue <= 0) {
    return null
  }

  const component = metric === 'win-rate' ? 'wins' : metric
  const ratio = value / expectedValue
  const normalized = normalizePrRatio(component, ratio)
  const band = metricBandFor(metric, normalized)
  if (band === null) return null

  const index = band.ordinal - 1
  return {
    metric,
    basis: 'normalized',
    value,
    expectedValue,
    ratio,
    normalized,
    band,
    ratioBand: positionAtIndex(index, ratio, ratioFloorsFor(metric)),
    rawBand: positionAtIndex(index, value, rawFloorsFor(metric, expectedValue)),
    sample,
    ruleVersion: LEVEL_RULE_VERSION,
  }
}

function absoluteLevel(
  metric: 'pr' | 'xp',
  value: number,
  sample: LevelSample,
): MetricLevel | null {
  if (!Number.isFinite(value)) return null
  const band = metricBandFor(metric, value)
  if (band === null) return null

  return {
    metric,
    basis: 'absolute',
    value,
    expectedValue: null,
    ratio: null,
    normalized: null,
    band,
    ratioBand: null,
    rawBand: null,
    sample,
    ruleVersion: LEVEL_RULE_VERSION,
  }
}

function normalizedSample(
  input: CoreStatsLevelInput,
): LevelSample {
  const baseline = input.baseline
  const source = input.sample ?? {}
  return {
    battles: baseline?.battles ?? input.battles,
    ships: source.ships ?? baseline?.ships ?? 0,
    exact: baseline === null || baseline === undefined
      ? false
      : baseline.exact && baseline.battles === input.battles,
    aggregation: source.aggregation ?? (baseline?.exact === false ? 'estimated' : 'pooled'),
    baselineVersion: baseline?.baselineVersion ?? null,
    ...(source.coverage !== undefined ? { coverage: source.coverage } : {}),
    ...(source.bias !== undefined ? { bias: source.bias } : {}),
  }
}

function prSample(input: CoreStatsLevelInput): LevelSample {
  const baseline = input.baseline
  return sampleFor(input, {
    battles: input.battles,
    ships: baseline?.ships ?? 0,
    exact: input.sample?.exact ?? baseline?.exact ?? true,
    aggregation: baseline?.exact === false ? 'estimated' : 'pooled',
    baselineVersion: baseline?.baselineVersion ?? null,
    bias: input.sample?.bias,
  })
}

function xpSample(input: CoreStatsLevelInput): LevelSample {
  const baseline = input.baseline
  const source = input.sample ?? {}
  return {
    battles: input.expBattles ?? input.battles,
    ships: source.ships ?? baseline?.ships ?? 0,
    exact: true,
    aggregation: 'pooled',
    baselineVersion: null,
    ...(source.coverage !== undefined ? { coverage: source.coverage } : {}),
  }
}

/** Evaluate all five core statistic levels from displayed values and a baseline. */
export function evaluateCoreStats(input: CoreStatsLevelInput): CoreStatsLevels {
  const baseline = input.baseline ?? null
  const normalized = normalizedSample(input)
  const prLevelSample = prSample(input)
  const xpLevelSample = xpSample(input)

  const winRate = finiteValue(input.winRate) && finiteValue(baseline?.winRate ?? null)
    ? normalizedLevel('win-rate', input.winRate, baseline!.winRate!, normalized)
    : null
  const damage = finiteValue(input.avgDamage) && finiteValue(baseline?.damage ?? null)
    ? normalizedLevel('damage', input.avgDamage, baseline!.damage!, normalized)
    : null
  const frags = finiteValue(input.avgFrags) && finiteValue(baseline?.frags ?? null)
    ? normalizedLevel('frags', input.avgFrags, baseline!.frags!, normalized)
    : null
  const pr = finiteValue(input.pr)
    ? absoluteLevel('pr', input.pr, prLevelSample)
    : null

  const expBattles = input.expBattles ?? input.battles
  const avgExp = expBattles > 0 && finiteValue(input.expTotal)
    ? input.expTotal / expBattles
    : null
  const xp = avgExp === null ? null : absoluteLevel('xp', avgExp, xpLevelSample)

  return { winRate, damage, frags, pr, xp }
}

function totalsOf(ships: readonly ShipStatTotals[]): AccountStatTotals {
  let battles = 0
  let wins = 0
  let damage = 0
  let frags = 0
  let exp = 0
  for (const ship of ships) {
    if (!Number.isFinite(ship.battles) || ship.battles <= 0) continue
    battles += ship.battles
    wins += ship.wins
    damage += ship.damage
    frags += ship.frags
    exp += ship.exp
  }
  return { battles, wins, damage, frags, exp }
}

function baselineOf(
  result: RatedValue | null,
  ships: number,
): ReturnType<typeof baselineFromComponents> {
  return result?.components === undefined
    ? null
    : baselineFromComponents(result.components, {
        ships,
        exact: result.exact,
        baselineVersion: result.baselineVersion,
      })
}

/** Levels for one ship, using that ship's own expected values. */
export function shipLevels(
  stats: ShipStatTotals,
  expected: ExpectedValuesDocument,
  sample: SampleDescriptor = { kind: 'lifetime', matches: stats.battles },
): CoreStatsLevels {
  const battles = stats.battles
  const pr = battles > 0 ? shipPr(stats, expected, sample) : null
  const baseline = baselineOf(pr, 1)
  const winRate = battles > 0 ? (stats.wins / battles) * 100 : null
  const avgDamage = battles > 0 ? stats.damage / battles : null
  const avgFrags = battles > 0 ? stats.frags / battles : null

  return evaluateCoreStats({
    winRate,
    avgDamage,
    avgFrags,
    expTotal: stats.exp,
    battles,
    pr: pr?.value ?? null,
    baseline,
    sample: {
      battles,
      ships: 1,
      exact: pr?.exact ?? true,
      aggregation: pr?.exact === false ? 'estimated' : 'pooled',
      baselineVersion: pr?.baselineVersion ?? null,
      ...(pr?.bias !== undefined ? { bias: pr.bias } : {}),
    },
  })
}

/** Exact pooled levels for an account's ship list. */
export function accountLevels(
  ships: readonly ShipStatTotals[],
  expected: ExpectedValuesDocument,
  sample: SampleDescriptor,
): CoreStatsLevels {
  const totals = totalsOf(ships)
  const pr = accountPrPooled(ships, expected, sample)
  const baseline = baselineOf(pr, ships.length)

  return evaluateCoreStats({
    winRate: totals.battles > 0 ? (totals.wins / totals.battles) * 100 : null,
    avgDamage: totals.battles > 0 ? totals.damage / totals.battles : null,
    avgFrags: totals.battles > 0 ? totals.frags / totals.battles : null,
    expTotal: totals.exp,
    battles: totals.battles,
    pr: pr?.value ?? null,
    baseline,
    sample: {
      battles: totals.battles,
      ships: ships.length,
      exact: pr?.exact ?? false,
      aggregation: 'pooled',
      baselineVersion: pr?.baselineVersion ?? null,
    },
  })
}

export interface AccountLevelOptions extends AccountPrOptions {
  sample?: Partial<LevelSample>
}

/** Approximate PR* levels for an account total (global unweighted baseline). */
export function accountLevelsEstimated(
  account: AccountStatTotals,
  expected: ExpectedValuesDocument,
  options: AccountLevelOptions = {},
): CoreStatsLevels {
  const pr = accountPrEstimated(
    {
      battles: account.battles,
      damage: account.damage,
      frags: account.frags,
      wins: account.wins,
    },
    expected,
    { shipMix: options.shipMix },
  )
  const baseline = baselineOf(pr, options.shipMix?.length ?? 0)

  return evaluateCoreStats({
    winRate: account.battles > 0 ? (account.wins / account.battles) * 100 : null,
    avgDamage: account.battles > 0 ? account.damage / account.battles : null,
    avgFrags: account.battles > 0 ? account.frags / account.battles : null,
    expTotal: account.exp,
    battles: account.battles,
    pr: pr?.value ?? null,
    baseline,
    sample: {
      ...options.sample,
      battles: account.battles,
      ships: options.shipMix?.length ?? 0,
      exact: false,
      aggregation: 'estimated',
      baselineVersion: pr?.baselineVersion ?? null,
      ...(pr?.bias !== undefined ? { bias: pr.bias } : {}),
    },
  })
}
