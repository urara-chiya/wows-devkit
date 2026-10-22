import type { ExpectedValuesDocument, ShipBattleStats } from 'wows-number-api-sdk'
import { accountPrPooled } from '../rating/index.js'
import type { SampleDescriptor } from '../rating/index.js'
import { outcomeOf, statOutcome } from '../match/index.js'
import type { MatchGroup, MatchRecord } from '../match/index.js'
import { gameDay } from '../time/index.js'

export type Weighting = 'equal' | 'battles'
export type PrAggregation = 'mean' | 'pooled'

export interface Coverage {
  total: number
  resolved: number
  hidden: number
  bot: number
  failed: number
}

export interface AggregatedValue {
  value: number | null
  sample: SampleDescriptor
  coverage: Coverage
}

export interface AggregateOptions {
  weighting: Weighting
  prAggregation: PrAggregation
  expected?: ExpectedValuesDocument
  matchGroups?: readonly MatchGroup[]
  from?: number
  to?: number
}

export interface PlayerAggregate {
  accountId: number
  name: string | null
  battles: number
  wins: number
  losses: number
  draws: number
  damage: number
  frags: number
  winRate: AggregatedValue
  avgDamage: AggregatedValue
  avgFrags: AggregatedValue
  pr: AggregatedValue
}

export interface TeamAggregate {
  teamId: number | null
  players: number
  coverage: Coverage
  values: {
    winRate: AggregatedValue
    avgDamage: AggregatedValue
    avgFrags: AggregatedValue
    pr: AggregatedValue
  }
}

export interface ShipAggregate {
  shipId: number
  battles: number
  wins: number
  losses: number
  draws: number
  damage: number
  frags: number
  winRate: AggregatedValue
  avgDamage: AggregatedValue
  avgFrags: AggregatedValue
  pr: AggregatedValue
}

export interface DailyPoint {
  day: string
  matches: number
  battles: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  avgDamage: number | null
  avgFrags: number | null
  pr: AggregatedValue
}

export interface DailyOptions {
  timeZone: string
  boundaryHour?: number
  expected?: ExpectedValuesDocument
  matchGroups?: readonly MatchGroup[]
  from?: number
  to?: number
}

interface PlayerTotals {
  accountId: number
  name: string | null
  battles: number
  wins: number
  losses: number
  draws: number
  damage: number
  frags: number
  matches: number
  ships: Map<string, ShipBattleStats>
}

interface ShipTotals {
  shipId: number
  battles: number
  wins: number
  losses: number
  draws: number
  damage: number
  frags: number
  players: Set<number>
}

interface Scan {
  matches: number
  coverage: Coverage
  players: Map<number, PlayerTotals>
  ships: Map<number, ShipTotals>
}

function emptyCoverage(): Coverage {
  return { total: 0, resolved: 0, hidden: 0, bot: 0, failed: 0 }
}

function includedRecord(record: MatchRecord, options: AggregateOptions): boolean {
  if (options.matchGroups !== undefined && !options.matchGroups.includes(record.matchGroup)) return false
  if (record.battleTime === null) {
    return options.from === undefined && options.to === undefined
  }
  if (options.from !== undefined && record.battleTime < options.from) return false
  if (options.to !== undefined && record.battleTime > options.to) return false
  return true
}

function sampleOf(matches: number, players: number, options: AggregateOptions): SampleDescriptor {
  const sample: SampleDescriptor = { kind: 'ingested', matches, players }
  if (options.from !== undefined) sample.from = new Date(options.from).toISOString()
  if (options.to !== undefined) sample.to = new Date(options.to).toISOString()
  return sample
}

function addShip(
  map: Map<string, ShipBattleStats>,
  shipId: number,
  damage: number,
  frags: number,
  win: boolean,
): void {
  const key = String(shipId)
  const current = map.get(key)
  if (current === undefined) {
    map.set(key, { shipId, battles: 1, damage, frags, wins: win ? 1 : 0 })
  } else {
    current.battles += 1
    current.damage += damage
    current.frags += frags
    if (win) current.wins += 1
  }
}

function scan(records: readonly MatchRecord[], options: AggregateOptions, teamId?: number): Scan {
  const coverage = emptyCoverage()
  const players = new Map<number, PlayerTotals>()
  const ships = new Map<number, ShipTotals>()
  let matches = 0

  for (const record of records) {
    if (!includedRecord(record, options)) continue

    const participants = teamId === undefined
      ? record.participants
      : record.participants.filter((participant) => participant.teamId === teamId)
    if (participants.length === 0) continue
    matches += 1

    for (const participant of participants) {
      coverage.total += 1
      if (participant.isBot) {
        coverage.bot += 1
        continue
      }
      if (participant.accountId === null) {
        coverage.hidden += 1
        continue
      }
      if (participant.result === null) {
        coverage.failed += 1
        continue
      }

      const outcome = outcomeOf(participant.teamId, record.winnerTeamId)
      const statistical = statOutcome(outcome)
      if (statistical === null) {
        coverage.failed += 1
        continue
      }
      coverage.resolved += 1

      const accountId = participant.accountId
      const damage = participant.result.damage ?? 0
      const frags = participant.result.frags ?? 0
      const win = statistical === 'win'

      let player = players.get(accountId)
      if (player === undefined) {
        player = {
          accountId,
          name: participant.name,
          battles: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          damage: 0,
          frags: 0,
          matches: 0,
          ships: new Map(),
        }
        players.set(accountId, player)
      }

      player.matches += 1
      player.battles += 1
      if (outcome === 'win') player.wins += 1
      else if (outcome === 'loss') player.losses += 1
      else if (outcome === 'draw') player.draws += 1
      player.damage += damage
      player.frags += frags

      if (participant.shipId !== null) {
        addShip(player.ships, participant.shipId, damage, frags, win)

        const ship = ships.get(participant.shipId)
        if (ship === undefined) {
          ships.set(participant.shipId, {
            shipId: participant.shipId,
            battles: 1,
            wins: win ? 1 : 0,
            losses: outcome === 'loss' ? 1 : 0,
            draws: outcome === 'draw' ? 1 : 0,
            damage,
            frags,
            players: new Set([accountId]),
          })
        } else {
          ship.battles += 1
          if (outcome === 'win') ship.wins += 1
          else if (outcome === 'loss') ship.losses += 1
          else ship.draws += 1
          ship.damage += damage
          ship.frags += frags
          ship.players.add(accountId)
        }
      }
    }
  }

  return { matches, coverage, players, ships }
}

function ratioOf(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

function weightedMean(
  entries: readonly { value: number; weight: number }[],
  weighting: Weighting,
): number | null {
  let total = 0
  let weight = 0
  for (const entry of entries) {
    const entryWeight = weighting === 'equal' ? 1 : entry.weight
    if (entryWeight <= 0) continue
    total += entry.value * entryWeight
    weight += entryWeight
  }
  return weight === 0 ? null : total / weight
}

function playerPr(
  player: PlayerTotals,
  options: AggregateOptions,
  sample: SampleDescriptor,
): number | null {
  if (options.expected === undefined || player.ships.size === 0) return null
  return accountPrPooled([...player.ships.values()], options.expected, sample)?.value ?? null
}

function playerCoverage(player: PlayerTotals): Coverage {
  return {
    total: player.battles,
    resolved: player.battles,
    hidden: 0,
    bot: 0,
    failed: 0,
  }
}

function playerValues(
  player: PlayerTotals,
  options: AggregateOptions,
  sample: SampleDescriptor,
): PlayerAggregate {
  const coverage = playerCoverage(player)
  return {
    accountId: player.accountId,
    name: player.name,
    battles: player.battles,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    damage: player.damage,
    frags: player.frags,
    winRate: {
      value: ratioOf(player.wins * 100, player.battles),
      sample,
      coverage,
    },
    avgDamage: {
      value: ratioOf(player.damage, player.battles),
      sample,
      coverage,
    },
    avgFrags: {
      value: ratioOf(player.frags, player.battles),
      sample,
      coverage,
    },
    pr: {
      value: playerPr(player, options, sample),
      sample,
      coverage,
    },
  }
}

/** Per-player aggregates over the selected records. Ordered by battles, then account id. */
export function aggregatePlayers(
  records: readonly MatchRecord[],
  options: AggregateOptions,
): PlayerAggregate[] {
  const scanned = scan(records, options)
  return [...scanned.players.values()]
    .map((player) => playerValues(player, options, sampleOf(player.matches, 1, options)))
    .sort((a, b) => b.battles - a.battles || a.accountId - b.accountId)
}

/** One team's aggregate; coverage only counts that team's participants. */
export function aggregateTeam(
  records: readonly MatchRecord[],
  teamId: number | null,
  options: AggregateOptions,
): TeamAggregate {
  const scanned = teamId === null ? scan(records, options) : scan(records, options, teamId)
  const players = [...scanned.players.values()]
  const sample = sampleOf(scanned.matches, players.length, options)
  const coverage = scanned.coverage

  const winRate = weightedMean(
    players
      .filter((player) => player.battles > 0)
      .map((player) => ({ value: (player.wins / player.battles) * 100, weight: player.battles })),
    options.weighting,
  )
  const avgDamage = weightedMean(
    players
      .filter((player) => player.battles > 0)
      .map((player) => ({ value: player.damage / player.battles, weight: player.battles })),
    options.weighting,
  )
  const avgFrags = weightedMean(
    players
      .filter((player) => player.battles > 0)
      .map((player) => ({ value: player.frags / player.battles, weight: player.battles })),
    options.weighting,
  )

  let pr: number | null = null
  if (options.expected !== undefined) {
    if (options.prAggregation === 'pooled') {
      const ships = players.flatMap((player) => [...player.ships.values()])
      pr = ships.length === 0
        ? null
        : accountPrPooled(ships, options.expected, sample)?.value ?? null
    } else {
      pr = weightedMean(
        players
          .map((player) => ({
            value: playerPr(player, options, sample),
            weight: player.battles,
          }))
          .filter((entry): entry is { value: number; weight: number } => entry.value !== null),
        options.weighting,
      )
    }
  }

  return {
    teamId,
    players: players.length,
    coverage,
    values: {
      winRate: { value: winRate, sample, coverage },
      avgDamage: { value: avgDamage, sample, coverage },
      avgFrags: { value: avgFrags, sample, coverage },
      pr: { value: pr, sample, coverage },
    },
  }
}

/** Per-ship aggregates over the selected records. Ordered by battles, then ship id. */
export function aggregateShips(
  records: readonly MatchRecord[],
  options: AggregateOptions,
): ShipAggregate[] {
  const scanned = scan(records, options)
  const coverage = scanned.coverage
  const rows: ShipAggregate[] = []

  for (const ship of scanned.ships.values()) {
    const sample = sampleOf(scanned.matches, ship.players.size, options)
    const stats: ShipBattleStats = {
      shipId: ship.shipId,
      battles: ship.battles,
      damage: ship.damage,
      frags: ship.frags,
      wins: ship.wins,
    }
    const pr = options.expected === undefined
      ? null
      : accountPrPooled([stats], options.expected, sample)?.value ?? null

    rows.push({
      shipId: ship.shipId,
      battles: ship.battles,
      wins: ship.wins,
      losses: ship.losses,
      draws: ship.draws,
      damage: ship.damage,
      frags: ship.frags,
      winRate: { value: ratioOf(ship.wins * 100, ship.battles), sample, coverage },
      avgDamage: { value: ratioOf(ship.damage, ship.battles), sample, coverage },
      avgFrags: { value: ratioOf(ship.frags, ship.battles), sample, coverage },
      pr: { value: pr, sample, coverage },
    })
  }

  return rows.sort((a, b) => b.battles - a.battles || a.shipId - b.shipId)
}

interface DayTotals {
  day: string
  matches: number
  wins: number
  losses: number
  draws: number
  damage: number
  frags: number
  ships: Map<string, ShipBattleStats>
}

/** Self performance per game day, ordered oldest first. */
export function dailySeries(
  records: readonly MatchRecord[],
  options: DailyOptions,
): DailyPoint[] {
  const days = new Map<string, DayTotals>()

  for (const record of records) {
    if (record.battleTime === null) continue
    if (options.matchGroups !== undefined && !options.matchGroups.includes(record.matchGroup)) continue
    if (options.from !== undefined && record.battleTime < options.from) continue
    if (options.to !== undefined && record.battleTime > options.to) continue

    const self = record.participants.find((participant) => participant.relation === 'self')
    if (self === undefined || self.result === null) continue

    const outcome = outcomeOf(self.teamId, record.winnerTeamId)
    if (statOutcome(outcome) === null) continue

    const day = gameDay(record.battleTime, options.timeZone, options.boundaryHour)
    let totals = days.get(day)
    if (totals === undefined) {
      totals = {
        day,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        damage: 0,
        frags: 0,
        ships: new Map(),
      }
      days.set(day, totals)
    }

    totals.matches += 1
    if (outcome === 'win') totals.wins += 1
    else if (outcome === 'loss') totals.losses += 1
    else totals.draws += 1

    const damage = self.result.damage ?? 0
    const frags = self.result.frags ?? 0
    totals.damage += damage
    totals.frags += frags

    if (self.shipId !== null) {
      addShip(totals.ships, self.shipId, damage, frags, outcome === 'win')
    }
  }

  const points: DailyPoint[] = []
  for (const totals of days.values()) {
    const battles = totals.matches
    const coverage: Coverage = {
      total: battles,
      resolved: battles,
      hidden: 0,
      bot: 0,
      failed: 0,
    }
    const sample: SampleDescriptor = { kind: 'ingested', matches: battles }
    const pr = options.expected === undefined || totals.ships.size === 0
      ? null
      : accountPrPooled([...totals.ships.values()], options.expected, sample)?.value ?? null

    points.push({
      day: totals.day,
      matches: totals.matches,
      battles,
      wins: totals.wins,
      losses: totals.losses,
      draws: totals.draws,
      winRate: battles === 0 ? null : (totals.wins / battles) * 100,
      avgDamage: battles === 0 ? null : totals.damage / battles,
      avgFrags: battles === 0 ? null : totals.frags / battles,
      pr: { value: pr, sample, coverage },
    })
  }

  return points.sort((a, b) => a.day.localeCompare(b.day))
}
