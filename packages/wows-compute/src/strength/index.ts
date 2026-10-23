import type { RatedValue } from '../rating/index.js'
import type { ArenaRoster, Relation } from '../match/index.js'
import type { Coverage, Weighting } from '../aggregate/index.js'

export type ShipRole =
  | 'submarine'
  | 'aircraft-carrier'
  | 'destroyer'
  | 'battleship'
  | 'cruiser-functional'
  | 'cruiser-firepower'
  | 'cruiser'
  | 'unknown'

/** Display / analysis order; not a composite score. */
export const ROLE_ORDER: readonly ShipRole[] = [
  'submarine',
  'aircraft-carrier',
  'destroyer',
  'battleship',
  'cruiser-functional',
  'cruiser-firepower',
  'cruiser',
  'unknown',
]

export interface ShipCatalogLike {
  role?: (shipId: number) => ShipRole | null
  tier?: (shipId: number) => number | null
}

export interface PlayerRatingSnapshot {
  pr?: RatedValue | null
  /** Lifetime win rate in percent, e.g. `54.3`. */
  winRate?: number | null
  battles?: number | null
  /** Lifetime average damage; `null` when unavailable. */
  avgDamage?: number | null
  /** Lifetime average frags; `null` when unavailable. */
  avgFrags?: number | null
  /** Platform-flagged hidden profile, distinct from "no data". */
  hidden?: boolean
}

export type PlayerRatingValue = RatedValue | PlayerRatingSnapshot
export type PlayerRatings = ReadonlyMap<number, PlayerRatingValue>

export interface PlayerPoint {
  accountId: number | null
  name: string | null
  /** `null` for pre-battle rosters; relations are known, team ids are not. */
  teamId: number | null
  shipId: number | null
  shipRole: ShipRole
  tier: number | null
  divisionId: number | null
  /** Percentage, e.g. `54.3`. */
  winRate: number | null
  pr: number | null
  prExact: boolean
  battles: number | null
  isBot: boolean
  /** Roster relation; used to group points into sides. */
  relation: Relation
  avgDamage: number | null
  avgFrags: number | null
  hidden: boolean
}

export interface ReferenceLines {
  winRateMedian: number | null
  prMedian: number | null
}

export type Quadrant = 'q1' | 'q2' | 'q3' | 'q4' | 'unknown'

export interface RoleWeightProfile {
  weights?: Partial<Record<ShipRole, number>>
}

export interface RoleMatchup {
  role: ShipRole
  allyCount: number
  enemyCount: number
  allyMedianPr: number | null
  enemyMedianPr: number | null
  allyMedianWinRate: number | null
  enemyMedianWinRate: number | null
  /** Ally median minus enemy median; `null` when either side lacks values. */
  prDiff: number | null
  winRateDiff: number | null
  weight: number | null
  sample: { ally: number; enemy: number }
  coverage: Coverage
}

function isRatedValue(value: PlayerRatingValue): value is RatedValue {
  return 'value' in value && 'basis' in value && 'exact' in value
}

interface NormalizedRating {
  pr: RatedValue | null
  winRate: number | null
  battles: number | null
  avgDamage: number | null
  avgFrags: number | null
  hidden: boolean
}

function normalize(value: PlayerRatingValue | undefined): NormalizedRating {
  if (value === undefined) {
    return {
      pr: null,
      winRate: null,
      battles: null,
      avgDamage: null,
      avgFrags: null,
      hidden: false,
    }
  }
  if (isRatedValue(value)) {
    return {
      pr: value,
      winRate: null,
      battles: value.sample.matches,
      avgDamage: null,
      avgFrags: null,
      hidden: false,
    }
  }
  return {
    pr: value.pr ?? null,
    winRate: value.winRate ?? null,
    battles: value.battles ?? value.pr?.sample.matches ?? null,
    avgDamage: value.avgDamage ?? null,
    avgFrags: value.avgFrags ?? null,
    hidden: value.hidden ?? false,
  }
}

/** Maps a roster to scatter-plot points. Bots and hidden players stay in the list. */
export function buildPlayerPoints(
  roster: ArenaRoster,
  ratings: PlayerRatings,
  catalog?: ShipCatalogLike,
): PlayerPoint[] {
  return roster.participants.map((participant) => {
    const rating = participant.accountId === null
      ? normalize(undefined)
      : normalize(ratings.get(participant.accountId))

    return {
      accountId: participant.accountId,
      name: participant.name,
      teamId: null,
      shipId: participant.shipId,
      shipRole: participant.shipId === null
        ? 'unknown'
        : catalog?.role?.(participant.shipId) ?? 'unknown',
      tier: participant.shipId === null ? null : catalog?.tier?.(participant.shipId) ?? null,
      divisionId: null,
      winRate: rating.winRate,
      pr: rating.pr?.value ?? null,
      prExact: rating.pr?.exact ?? false,
      battles: rating.battles,
      isBot: participant.isBot,
      relation: participant.relation,
      avgDamage: rating.avgDamage,
      avgFrags: rating.avgFrags,
      hidden: rating.hidden,
    }
  })
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]!
  return (sorted[middle - 1]! + sorted[middle]!) / 2
}

export function referenceLines(points: readonly PlayerPoint[]): ReferenceLines {
  return {
    winRateMedian: median(
      points.map((point) => point.winRate).filter((value): value is number => value !== null),
    ),
    prMedian: median(
      points.map((point) => point.pr).filter((value): value is number => value !== null),
    ),
  }
}

/**
 * Quadrants relative to the reference lines.
 *
 * q1 high win rate + high PR, q2 low win rate + high PR,
 * q3 low + low, q4 high win rate + low PR.
 */
export function quadrantOf(point: PlayerPoint, reference: ReferenceLines): Quadrant {
  if (
    point.winRate === null
    || point.pr === null
    || reference.winRateMedian === null
    || reference.prMedian === null
  ) {
    return 'unknown'
  }

  const highWinRate = point.winRate >= reference.winRateMedian
  const highPr = point.pr >= reference.prMedian
  if (highWinRate) return highPr ? 'q1' : 'q4'
  return highPr ? 'q2' : 'q3'
}

function roleCoverage(ally: readonly PlayerPoint[], enemy: readonly PlayerPoint[]): Coverage {
  const coverage: Coverage = { total: 0, resolved: 0, hidden: 0, bot: 0, failed: 0 }

  for (const point of [...ally, ...enemy]) {
    coverage.total += 1
    if (point.isBot) {
      coverage.bot += 1
      continue
    }
    if (point.accountId === null) {
      coverage.hidden += 1
      continue
    }
    if (point.pr === null) {
      coverage.failed += 1
      continue
    }
    coverage.resolved += 1
  }

  return coverage
}

function diff(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right
}

/**
 * Per-role ally/enemy comparison.
 *
 * Returns differences and samples only; no composite score and no prediction.
 */
export function pairByRole(
  ally: readonly PlayerPoint[],
  enemy: readonly PlayerPoint[],
  profile?: RoleWeightProfile,
): RoleMatchup[] {
  const allyByRole = new Map<ShipRole, PlayerPoint[]>()
  const enemyByRole = new Map<ShipRole, PlayerPoint[]>()

  for (const point of ally) {
    const list = allyByRole.get(point.shipRole) ?? []
    list.push(point)
    allyByRole.set(point.shipRole, list)
  }
  for (const point of enemy) {
    const list = enemyByRole.get(point.shipRole) ?? []
    list.push(point)
    enemyByRole.set(point.shipRole, list)
  }

  const roles = ROLE_ORDER.filter(
    (role) => allyByRole.has(role) || enemyByRole.has(role),
  )

  return roles.map((role) => {
    const allies = allyByRole.get(role) ?? []
    const enemies = enemyByRole.get(role) ?? []
    const allyMedianPr = median(
      allies.map((point) => point.pr).filter((value): value is number => value !== null),
    )
    const enemyMedianPr = median(
      enemies.map((point) => point.pr).filter((value): value is number => value !== null),
    )
    const allyMedianWinRate = median(
      allies.map((point) => point.winRate).filter((value): value is number => value !== null),
    )
    const enemyMedianWinRate = median(
      enemies.map((point) => point.winRate).filter((value): value is number => value !== null),
    )

    return {
      role,
      allyCount: allies.length,
      enemyCount: enemies.length,
      allyMedianPr,
      enemyMedianPr,
      allyMedianWinRate,
      enemyMedianWinRate,
      prDiff: diff(allyMedianPr, enemyMedianPr),
      winRateDiff: diff(allyMedianWinRate, enemyMedianWinRate),
      weight: profile?.weights?.[role] ?? null,
      sample: { ally: allies.length, enemy: enemies.length },
      coverage: roleCoverage(allies, enemies),
    }
  })
}

export interface SummaryOptions {
  /**
   * `equal` (default): one player, one vote.
   * `battles`: weight by the player's lifetime battles.
   */
  weighting?: Weighting
}

export interface PlayerSummary {
  /** All slots on the side, including bots. */
  total: number
  /** Non-bot slots. */
  players: number
  /** Sum of non-null lifetime battles for non-bot players. */
  battles: number
  /** Counts slots, not participant-match samples. */
  coverage: Coverage
  /** Percentage, e.g. `54.3`. */
  winRate: number | null
  avgDamage: number | null
  avgFrags: number | null
  pr: number | null
  /**
   * Always false: a mean of account PR values is not an official team PR.
   * UI must mark it `PR*`.
   */
  prExact: false
}

export interface RosterSummary {
  ally: PlayerSummary
  enemy: PlayerSummary
  /** Slots that cannot be assigned to a side (`relation === 'unknown'`). */
  unassigned: number
}

type SummaryMetric = 'winRate' | 'avgDamage' | 'avgFrags' | 'pr'

function summaryCoverage(points: readonly PlayerPoint[]): Coverage {
  const coverage: Coverage = { total: 0, resolved: 0, hidden: 0, bot: 0, failed: 0 }

  for (const point of points) {
    coverage.total += 1
    if (point.isBot) {
      coverage.bot += 1
      continue
    }
    if (point.hidden || point.accountId === null) {
      coverage.hidden += 1
      continue
    }
    if (
      point.winRate === null
      && point.avgDamage === null
      && point.avgFrags === null
      && point.pr === null
    ) {
      coverage.failed += 1
      continue
    }
    coverage.resolved += 1
  }

  return coverage
}

function meanOf(
  points: readonly PlayerPoint[],
  metric: SummaryMetric,
  weighting: Weighting,
): number | null {
  let total = 0
  let weightSum = 0

  for (const point of points) {
    const value = point[metric]
    if (value === null) continue
    const weight = weighting === 'battles' ? point.battles ?? 0 : 1
    if (weight <= 0) continue
    total += value * weight
    weightSum += weight
  }

  return weightSum === 0 ? null : total / weightSum
}

/**
 * Reduces normalized player points into one side's overview.
 *
 * Averages only over non-null values; `0` is a valid value. Empty input
 * returns an all-zero summary rather than throwing.
 */
export function summarizePlayers(
  points: readonly PlayerPoint[],
  options: SummaryOptions = {},
): PlayerSummary {
  const weighting = options.weighting ?? 'equal'
  const coverage = summaryCoverage(points)
  const members = points.filter((point) => !point.isBot)

  let battles = 0
  for (const point of members) {
    if (point.battles !== null) battles += point.battles
  }

  return {
    total: coverage.total,
    players: coverage.total - coverage.bot,
    battles,
    coverage,
    winRate: meanOf(members, 'winRate', weighting),
    avgDamage: meanOf(members, 'avgDamage', weighting),
    avgFrags: meanOf(members, 'avgFrags', weighting),
    pr: meanOf(members, 'pr', weighting),
    prExact: false,
  }
}

/** Groups points by `relation` and summarizes both sides. */
export function summarizeRoster(
  points: readonly PlayerPoint[],
  options: SummaryOptions = {},
): RosterSummary {
  const ally: PlayerPoint[] = []
  const enemy: PlayerPoint[] = []
  let unassigned = 0

  for (const point of points) {
    if (point.relation === 'self' || point.relation === 'ally') ally.push(point)
    else if (point.relation === 'enemy') enemy.push(point)
    else unassigned += 1
  }

  return {
    ally: summarizePlayers(ally, options),
    enemy: summarizePlayers(enemy, options),
    unassigned,
  }
}

export { groupDivisions } from '../match/index.js'
