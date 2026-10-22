import type { ExpectedValuesDocument, ShipBattleStats } from 'wows-number-api-sdk'
import { accountPrPooled } from '../rating/index.js'
import type { RatedValue, SampleDescriptor } from '../rating/index.js'
import { outcomeOf, statOutcome } from '../match/index.js'
import type { MatchGroup, MatchParticipant, MatchRecord } from '../match/index.js'

export type RecentSubject =
  | { kind: 'self' }
  | { kind: 'participant'; accountId: number }

export interface RecentQuery {
  subject: RecentSubject
  /** Window size in matches; defaults to 20. */
  last?: number
  from?: number
  to?: number
  matchGroups?: readonly MatchGroup[]
  /** `loss` (default) counts a draw as a loss; `exclude` drops draws entirely. */
  drawPolicy?: 'loss' | 'exclude'
}

export interface RecentStats {
  battles: number
  wins: number
  losses: number
  draws: number
  /** Percentage, e.g. `54.3`; `null` when there are no battles. */
  winRate: number | null
  damage: number
  frags: number
  avgDamage: number | null
  avgFrags: number | null
  pr: RatedValue | null
}

export interface RecentResult {
  matches: MatchRecord[]
  sample: SampleDescriptor
  stats: RecentStats
}

const DEFAULT_WINDOW = 20

function subjectParticipant(record: MatchRecord, subject: RecentSubject): MatchParticipant | null {
  if (subject.kind === 'self') {
    return record.participants.find((participant) => participant.relation === 'self') ?? null
  }

  return record.participants.find((participant) => participant.accountId === subject.accountId) ?? null
}

function inDateRange(record: MatchRecord, from?: number, to?: number): boolean {
  if (from === undefined && to === undefined) return true
  if (record.battleTime === null) return false
  if (from !== undefined && record.battleTime < from) return false
  if (to !== undefined && record.battleTime > to) return false
  return true
}

function compareNewestFirst(a: MatchRecord, b: MatchRecord): number {
  const timeA = a.battleTime ?? Number.NEGATIVE_INFINITY
  const timeB = b.battleTime ?? Number.NEGATIVE_INFINITY
  if (timeA !== timeB) return timeB - timeA
  return a.arenaId.localeCompare(b.arenaId)
}

function emptyStats(): RecentStats {
  return {
    battles: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: null,
    damage: 0,
    frags: 0,
    avgDamage: null,
    avgFrags: null,
    pr: null,
  }
}

/**
 * Statistics over ingested matches only.
 *
 * No gap filling, no lifetime totals, no historical replay scan: a match is in
 * the window only when it was successfully parsed and stored by the caller.
 */
export function recentMatches(
  records: readonly MatchRecord[],
  query: RecentQuery,
  expected?: ExpectedValuesDocument,
): RecentResult {
  const drawPolicy = query.drawPolicy ?? 'loss'
  const limit = query.last === undefined ? DEFAULT_WINDOW : Math.max(0, Math.trunc(query.last))

  let matches = records.filter((record) => {
    if (query.matchGroups !== undefined && !query.matchGroups.includes(record.matchGroup)) return false
    if (!inDateRange(record, query.from, query.to)) return false

    const participant = subjectParticipant(record, query.subject)
    if (participant === null || participant.result === null) return false

    const outcome = outcomeOf(participant.teamId, record.winnerTeamId)
    if (statOutcome(outcome) === null) return false
    if (drawPolicy === 'exclude' && outcome === 'draw') return false
    return true
  })

  matches = matches.sort(compareNewestFirst).slice(0, limit)

  const stats = emptyStats()
  const ships = new Map<string, ShipBattleStats>()
  let damage = 0
  let frags = 0
  let wins = 0
  let losses = 0
  let draws = 0

  for (const record of matches) {
    const participant = subjectParticipant(record, query.subject)
    if (participant === null || participant.result === null) continue

    const outcome = outcomeOf(participant.teamId, record.winnerTeamId)
    if (outcome === 'win') wins += 1
    else if (outcome === 'loss') losses += 1
    else if (outcome === 'draw') draws += 1

    const resultDamage = participant.result.damage ?? 0
    const resultFrags = participant.result.frags ?? 0
    damage += resultDamage
    frags += resultFrags

    if (participant.shipId !== null) {
      const key = String(participant.shipId)
      const ship = ships.get(key)
      if (ship === undefined) {
        ships.set(key, {
          shipId: participant.shipId,
          battles: 1,
          damage: resultDamage,
          frags: resultFrags,
          wins: outcome === 'win' ? 1 : 0,
        })
      } else {
        ship.battles += 1
        ship.damage += resultDamage
        ship.frags += resultFrags
        if (outcome === 'win') ship.wins += 1
      }
    }
  }

  const battles = matches.length
  stats.battles = battles
  stats.wins = wins
  stats.losses = losses
  stats.draws = draws
  stats.winRate = battles === 0 ? null : (wins / battles) * 100
  stats.damage = damage
  stats.frags = frags
  stats.avgDamage = battles === 0 ? null : damage / battles
  stats.avgFrags = battles === 0 ? null : frags / battles

  const sample: SampleDescriptor = {
    kind: 'ingested',
    matches: battles,
  }
  if (query.from !== undefined) sample.from = new Date(query.from).toISOString()
  if (query.to !== undefined) sample.to = new Date(query.to).toISOString()
  if (query.subject.kind === 'participant') sample.sharedWith = battles

  if (expected !== undefined && ships.size > 0) {
    stats.pr = accountPrPooled([...ships.values()], expected, sample)
  }

  return { matches, sample, stats }
}
