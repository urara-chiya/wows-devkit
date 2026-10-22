import {
  calculateBattlePR,
  calculatePR,
  shipExpectedValues,
} from 'wows-number-api-sdk'
import type {
  ExpectedValuesDocument,
  PersonalRatingResult,
  ShipBattleStats,
  SingleBattleInput,
} from 'wows-number-api-sdk'

export interface SampleDescriptor {
  kind: 'ingested' | 'lifetime' | 'match'
  matches: number
  /** ISO timestamps; present for date windows. */
  from?: string
  to?: string
  /** When querying another player: matches shared with the local player. */
  sharedWith?: number
  players?: number
}

export interface EstimateBias {
  direction: 'underestimate' | 'overestimate' | 'mixed' | 'unknown'
  reason: 'ship-mix' | 'insufficient-data'
  /** Relative baseline difference: pooled baseline / global average - 1. */
  delta?: { damage?: number; frags?: number; wins?: number }
}

export interface RatedValue {
  value: number
  basis: 'ship' | 'account'
  exact: boolean
  sample: SampleDescriptor
  /** Expected-values version, taken from `expected.time`. */
  baselineVersion: string
  /** Only present when `exact === false`. */
  bias?: EstimateBias
}

export interface AccountTotals {
  battles: number
  damage: number
  frags: number
  wins: number
}

export interface ShipMixEntry {
  shipId: number | string
  battles: number
}

export interface AccountPrOptions {
  shipMix?: readonly ShipMixEntry[]
}

interface Averages {
  damage: number
  frags: number
  winRate: number
}

const ACCOUNT_SHIP_ID = '__account__'

function baselineOf(expected: ExpectedValuesDocument): string {
  return String(expected.time)
}

function resultValue(result: PersonalRatingResult | null): number | null {
  return result === null ? null : result.pr
}

/** Unweighted mean of every ship that carries expected values. */
function globalAverages(expected: ExpectedValuesDocument): Averages | null {
  let damage = 0
  let frags = 0
  let winRate = 0
  let count = 0

  for (const entry of Object.values(expected.data)) {
    if (Array.isArray(entry)) continue
    damage += entry.average_damage_dealt
    frags += entry.average_frags
    winRate += entry.win_rate
    count += 1
  }

  if (count === 0) return null
  return { damage: damage / count, frags: frags / count, winRate: winRate / count }
}

function estimateBias(
  expected: ExpectedValuesDocument,
  averages: Averages,
  shipMix: readonly ShipMixEntry[] | undefined,
): EstimateBias {
  if (shipMix === undefined || shipMix.length === 0) {
    return { direction: 'unknown', reason: 'insufficient-data' }
  }

  let battles = 0
  let expectedDamage = 0
  let expectedFrags = 0
  let expectedWins = 0

  for (const entry of shipMix) {
    if (!Number.isFinite(entry.battles) || entry.battles <= 0) continue
    const values = shipExpectedValues(expected, entry.shipId)
    if (values === null) continue

    battles += entry.battles
    expectedDamage += values.average_damage_dealt * entry.battles
    expectedFrags += values.average_frags * entry.battles
    expectedWins += (values.win_rate / 100) * entry.battles
  }

  if (battles === 0) {
    return { direction: 'unknown', reason: 'insufficient-data' }
  }

  const delta = {
    damage: expectedDamage / battles / averages.damage - 1,
    frags: expectedFrags / battles / averages.frags - 1,
    wins: expectedWins / battles / (averages.winRate / 100) - 1,
  }
  const directions = [delta.damage, delta.frags, delta.wins]
  const positives = directions.filter((value) => value > 1e-9).length
  const negatives = directions.filter((value) => value < -1e-9).length

  let direction: EstimateBias['direction'] = 'unknown'
  if (positives === directions.length) direction = 'overestimate'
  else if (negatives === directions.length) direction = 'underestimate'
  else if (positives > 0 && negatives > 0) direction = 'mixed'

  return { direction, reason: 'ship-mix', delta }
}

/** Personal Rating for one ship, using that ship's own expected values. */
export function shipPr(
  stats: ShipBattleStats,
  expected: ExpectedValuesDocument,
  sample: SampleDescriptor = { kind: 'lifetime', matches: stats.battles },
): RatedValue | null {
  const value = resultValue(calculatePR([stats], expected))
  if (value === null) return null

  return {
    value,
    basis: 'ship',
    exact: true,
    sample,
    baselineVersion: baselineOf(expected),
  }
}

/** Personal Rating for a single battle. */
export function battlePr(
  battle: SingleBattleInput,
  expected: ExpectedValuesDocument,
  sample: SampleDescriptor = { kind: 'match', matches: 1 },
): RatedValue | null {
  const value = resultValue(calculateBattlePR(battle, expected))
  if (value === null) return null

  return {
    value,
    basis: 'ship',
    exact: true,
    sample,
    baselineVersion: baselineOf(expected),
  }
}

/**
 * Fast account PR*: account totals against the unweighted average of all
 * expected values.
 *
 * This is an estimate, not a different formula: the account is treated as one
 * synthetic ship. `exact: false` is a product promise — UI must mark it `PR*`.
 */
export function accountPrEstimated(
  account: AccountTotals,
  expected: ExpectedValuesDocument,
  options: AccountPrOptions = {},
): RatedValue | null {
  if (!Number.isFinite(account.battles) || account.battles <= 0) return null

  const averages = globalAverages(expected)
  if (averages === null) return null

  const syntheticExpected: ExpectedValuesDocument = {
    time: expected.time,
    data: {
      [ACCOUNT_SHIP_ID]: {
        average_damage_dealt: averages.damage,
        average_frags: averages.frags,
        win_rate: averages.winRate,
      },
    },
  }
  const synthetic: ShipBattleStats = {
    shipId: ACCOUNT_SHIP_ID,
    battles: account.battles,
    damage: account.damage,
    frags: account.frags,
    wins: account.wins,
  }
  const value = resultValue(calculatePR([synthetic], syntheticExpected))
  if (value === null) return null

  return {
    value,
    basis: 'account',
    exact: false,
    sample: { kind: 'lifetime', matches: account.battles },
    baselineVersion: baselineOf(expected),
    bias: estimateBias(expected, averages, options.shipMix),
  }
}

/**
 * Exact weighted account PR: pools per-ship totals and per-ship baselines.
 *
 * Ships without expected values are skipped by `calculatePR`, not counted
 * as zero.
 */
export function accountPrPooled(
  ships: readonly ShipBattleStats[],
  expected: ExpectedValuesDocument,
  sample: SampleDescriptor,
): RatedValue | null {
  const value = resultValue(calculatePR(ships, expected))
  if (value === null) return null

  return {
    value,
    basis: 'account',
    exact: true,
    sample,
    baselineVersion: baselineOf(expected),
  }
}
