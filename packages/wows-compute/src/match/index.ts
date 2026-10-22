import { parseBattleTime } from '../time/index.js'
import type {
  ArenaInfoLike,
  ArenaKeyInput,
  ArenaRoster,
  Division,
  MatchGroup,
  MatchParticipant,
  MatchRecord,
  Outcome,
  PlayerResult,
  ReplayFacts,
  ReplayPlayerLike,
  ReplayVehicleLike,
  Relation,
  ResultValue,
  RosterParticipant,
  StatOutcome,
} from './types.js'

export type * from './types.js'

const QUALITY_RANK: Record<MatchRecord['quality'], number> = {
  'meta-only': 0,
  partial: 1,
  complete: 2,
}

const DEFAULT_TIME_ZONE = 'Asia/Shanghai'
/** Roster `dateTime` and results `startDt` differ by roughly 30–45 seconds in practice. */
const ROSTER_TIME_TOLERANCE_MS = 120_000

export interface FromArenaInfoOptions {
  timeZone?: string
}

export interface FromReplayOptions {
  timeZone?: string
  ingestedAt?: number
  parsedAt?: number
  source?: MatchRecord['source']
  /** Include the raw battle-results payload for later remapping. */
  includeRaw?: boolean
}

/** Draw counts as a loss for both teams in every statistical view. */
export function statOutcome(outcome: Outcome): StatOutcome | null {
  if (outcome === 'win') return 'win'
  if (outcome === 'loss' || outcome === 'draw') return 'loss'
  return null
}

/**
 * Resolves a team's outcome.
 *
 * `winnerTeamId` is a real team id (`0` included). Negative values mean a
 * draw; `null` means the result packet carried no verdict.
 */
export function outcomeOf(teamId: number | null, winnerTeamId: number | null): Outcome {
  if (teamId === null || winnerTeamId === null) return 'unknown'
  if (winnerTeamId < 0) return 'draw'
  return teamId === winnerTeamId ? 'win' : 'loss'
}

export function matchGroupOf(value: unknown): MatchGroup {
  if (typeof value !== 'string') return 'unknown'

  switch (value.trim().toLowerCase()) {
    case 'pvp':
    case 'random':
    case 'randombattle':
      return 'pvp'
    case 'ranked':
    case 'rank':
      return 'ranked'
    case 'coop':
    case 'cooperative':
    case 'pve':
      return 'coop'
    case 'clan':
    case 'clanbattle':
      return 'clan'
    case 'brawl':
      return 'brawl'
    case 'event':
      return 'event'
    default:
      return 'unknown'
  }
}

export function isBot(accountId: number | null, name: string | null): boolean {
  if (name !== null && name.startsWith(':')) return true
  return accountId !== null && accountId <= 0
}

function relationOf(value: unknown): Relation {
  if (value === 0) return 'self'
  if (value === 1) return 'ally'
  if (value === 2) return 'enemy'
  return 'unknown'
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function positiveInteger(value: unknown): number | null {
  const number = finiteNumber(value)
  return number !== null && number > 0 ? Math.trunc(number) : null
}

function hashString(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function provisionalId(
  battleTime: number | null,
  mapId: number | null,
  accountIds: readonly (number | null)[],
): string {
  const ids = [...new Set(accountIds.filter((id): id is number => id !== null && id > 0))]
    .sort((a, b) => a - b)
  return `roster:${battleTime ?? '?'}:${mapId ?? '?'}:${ids.join(',')}`
}

/**
 * Stable match key. Prefers the numeric arena id, then a deterministic derived
 * key, then an opaque unknown marker.
 */
export function arenaKeyOf(input: ArenaKeyInput): string {
  if (input.arenaId !== undefined && input.arenaId !== null) return `arena:${input.arenaId}`

  const ids = [...new Set(input.accountIds.filter((id): id is number => id !== null && id > 0))]
    .sort((a, b) => a - b)
  const derived = `${input.battleTime ?? '?'}:${input.mapId ?? '?'}:${ids.join(',')}`

  if (input.battleTime !== null || input.mapId !== null || ids.length > 0) {
    return `derived:${derived}`
  }

  return `unknown:${hashString(derived)}`
}

export function fromArenaInfo(input: ArenaInfoLike, options: FromArenaInfoOptions = {}): ArenaRoster {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE
  const battleTime = typeof input.dateTime === 'string'
    ? parseBattleTime(input.dateTime, timeZone)
    : null
  const vehicles = input.vehicles ?? []
  const participants: RosterParticipant[] = vehicles.map((vehicle) => {
    const accountId = positiveInteger(vehicle.id)
    return {
      accountId,
      name: typeof vehicle.name === 'string' ? vehicle.name : null,
      clanId: null,
      clanTag: null,
      shipId: finiteNumber(vehicle.shipId),
      relation: relationOf(vehicle.relation),
      isBot: isBot(accountId, typeof vehicle.name === 'string' ? vehicle.name : null),
    }
  })

  return {
    provisionalId: provisionalId(
      battleTime,
      finiteNumber(input.mapId),
      participants.map((participant) => participant.accountId),
    ),
    battleTime,
    gameMode: finiteNumber(input.gameMode),
    matchGroup: matchGroupOf(input.matchGroup),
    mapId: finiteNumber(input.mapId),
    mapName: typeof input.mapName === 'string' ? input.mapName : null,
    clientVersion: typeof input.clientVersionFromExe === 'string' ? input.clientVersionFromExe : null,
    durationSec: finiteNumber(input.battleDuration) ?? finiteNumber(input.duration),
    playersPerTeam: finiteNumber(input.playersPerTeam),
    participants,
    raw: input,
  }
}

function selfPlayerOf(facts: ReplayFacts): ReplayPlayerLike | null {
  const results = facts.battleResults
  if (results === null) return null

  const playerId = facts.meta.playerID
  if (typeof playerId === 'number' && playerId > 0) {
    const byId = results.players.find((player) => player.accountId === playerId)
    if (byId) return byId
  }

  const name = facts.meta.playerName
  if (typeof name !== 'string' || name.length === 0) return null

  const matches = results.players.filter((player) => player.name === name)
  return matches.length === 1 ? matches[0]! : null
}

function resultOf(player: ReplayPlayerLike): PlayerResult {
  return {
    damage: player.damage,
    frags: player.frags,
    exp: player.exp,
    rawExp: player.rawExp,
    isAlive: player.isAlive,
    lifeTimeSec: player.lifeTimeSec,
    scoutingDamage: player.scoutingDamage,
    killerAccountId: player.killerAccountId,
    interactions: player.interactions,
    fields: player.fields,
  }
}

function divisionIdOf(fields: Record<string, ResultValue>): number | null {
  return positiveInteger(fields.prebattle_id)
}

function metaParticipants(vehicles: readonly ReplayVehicleLike[] | null | undefined): MatchParticipant[] {
  return (vehicles ?? []).map((vehicle) => {
    const accountId = positiveInteger(vehicle.id)
    const name = typeof vehicle.name === 'string' ? vehicle.name : null
    return {
      accountId,
      name,
      clanId: null,
      clanTag: null,
      shipId: finiteNumber(vehicle.shipId),
      teamId: null,
      relation: relationOf(vehicle.relation),
      isBot: isBot(accountId, name),
      divisionId: null,
      result: null,
    }
  })
}

export function fromReplay(facts: ReplayFacts, options: FromReplayOptions = {}): MatchRecord {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE
  const results = facts.battleResults
  const common = results?.common ?? null
  const meta = facts.meta
  const self = selfPlayerOf(facts)
  const selfTeamId = self?.teamId ?? null

  const participants: MatchParticipant[] = results !== null
    ? results.players.map((player) => {
      const name = player.name
      return {
        accountId: player.accountId,
        name,
        clanId: player.clanId,
        clanTag: player.clanTag,
        shipId: player.shipId,
        teamId: player.teamId,
        relation: self !== null && player.accountId !== null && player.accountId === self.accountId
          ? 'self'
          : selfTeamId !== null && player.teamId !== null
            ? player.teamId === selfTeamId ? 'ally' : 'enemy'
            : 'unknown',
        isBot: isBot(player.accountId, name),
        divisionId: divisionIdOf(player.fields),
        result: resultOf(player),
      }
    })
    : metaParticipants(meta.vehicles)

  const winnerTeamId = finiteNumber(common?.winnerTeamId)
  const arenaId = results === null ? null : finiteNumber(results.arenaId)
  const startDt = finiteNumber(common?.startDt)
  const metaTime = typeof meta.dateTime === 'string'
    ? parseBattleTime(meta.dateTime, timeZone)
    : null
  const battleTime = startDt !== null && startDt > 0 ? startDt * 1000 : metaTime
  const mapId = finiteNumber(meta.mapId)

  let quality: MatchRecord['quality'] = 'meta-only'
  if (results !== null) {
    quality = participants.length > 0 && winnerTeamId !== null ? 'complete' : 'partial'
  }

  const record: MatchRecord = {
    arenaId: arenaId !== null
      ? String(arenaId)
      : arenaKeyOf({
        battleTime,
        mapId,
        accountIds: participants.map((participant) => participant.accountId),
      }),
    provisionalIds: [],
    battleTime,
    gameMode: finiteNumber(common?.gameMode) ?? finiteNumber(meta.gameMode),
    matchGroup: matchGroupOf(meta.matchGroup ?? meta.gameType),
    mapId,
    mapName: typeof meta.mapName === 'string' ? meta.mapName : null,
    clientVersion: typeof meta.clientVersionFromExe === 'string' ? meta.clientVersionFromExe : null,
    durationSec: finiteNumber(common?.durationSec)
      ?? finiteNumber(meta.battleDuration)
      ?? finiteNumber(meta.duration),
    winnerTeamId,
    outcome: outcomeOf(selfTeamId, winnerTeamId),
    participants,
    quality,
    ingestedAt: options.ingestedAt ?? Date.now(),
    parsedAt: options.parsedAt ?? Date.now(),
    mappingVersion: results?.mappingVersion ?? null,
    source: options.source ?? { kind: 'replay' },
  }

  if (options.includeRaw && results?.raw !== undefined) record.raw = results.raw

  return record
}

function participantKey(participant: MatchParticipant): string {
  if (participant.accountId !== null) return `account:${participant.accountId}`
  return `name:${participant.name ?? '?'}:${participant.shipId ?? '?'}`
}

function mergeResult(base: PlayerResult | null, fallback: PlayerResult | null): PlayerResult | null {
  if (base === null) return fallback
  if (fallback === null) return base

  return {
    damage: base.damage ?? fallback.damage,
    frags: base.frags ?? fallback.frags,
    exp: base.exp ?? fallback.exp,
    rawExp: base.rawExp ?? fallback.rawExp,
    isAlive: base.isAlive ?? fallback.isAlive,
    lifeTimeSec: base.lifeTimeSec ?? fallback.lifeTimeSec,
    scoutingDamage: base.scoutingDamage ?? fallback.scoutingDamage,
    killerAccountId: base.killerAccountId ?? fallback.killerAccountId,
    interactions: { ...fallback.interactions, ...base.interactions },
    fields: { ...fallback.fields, ...base.fields },
  }
}

function mergeParticipant(
  base: MatchParticipant,
  fallback: MatchParticipant,
): MatchParticipant {
  return {
    accountId: base.accountId ?? fallback.accountId,
    name: base.name ?? fallback.name,
    clanId: base.clanId ?? fallback.clanId,
    clanTag: base.clanTag ?? fallback.clanTag,
    shipId: base.shipId ?? fallback.shipId,
    teamId: base.teamId ?? fallback.teamId,
    relation: base.relation !== 'unknown' ? base.relation : fallback.relation,
    isBot: base.isBot,
    divisionId: base.divisionId ?? fallback.divisionId,
    result: mergeResult(base.result, fallback.result),
  }
}

/**
 * Combines two parses of the same match.
 *
 * Higher quality wins; within the same quality the newer parse wins. Fields
 * missing from the winner are filled from the other record.
 */
export function mergeMatchRecords(a: MatchRecord, b: MatchRecord): MatchRecord {
  const aRank = QUALITY_RANK[a.quality]
  const bRank = QUALITY_RANK[b.quality]
  const sameQuality = aRank === bRank
  const base = bRank > aRank || (sameQuality && b.parsedAt > a.parsedAt) ? b : a
  const fallback = base === a ? b : a

  const byKey = new Map<string, MatchParticipant>()
  for (const participant of fallback.participants) {
    byKey.set(participantKey(participant), participant)
  }

  const participants = base.participants.map((participant) => {
    const key = participantKey(participant)
    const other = byKey.get(key)
    if (other === undefined) return participant
    byKey.delete(key)
    return mergeParticipant(participant, other)
  })
  participants.push(...byKey.values())

  const arenaId = base.arenaId.startsWith('unknown:') ? fallback.arenaId : base.arenaId

  const merged: MatchRecord = {
    arenaId,
    provisionalIds: [...new Set([...base.provisionalIds, ...fallback.provisionalIds])],
    battleTime: base.battleTime ?? fallback.battleTime,
    gameMode: base.gameMode ?? fallback.gameMode,
    matchGroup: base.matchGroup !== 'unknown' ? base.matchGroup : fallback.matchGroup,
    mapId: base.mapId ?? fallback.mapId,
    mapName: base.mapName ?? fallback.mapName,
    clientVersion: base.clientVersion ?? fallback.clientVersion,
    durationSec: base.durationSec ?? fallback.durationSec,
    winnerTeamId: base.winnerTeamId ?? fallback.winnerTeamId,
    outcome: base.outcome !== 'unknown' ? base.outcome : fallback.outcome,
    participants,
    quality: QUALITY_RANK[base.quality] >= QUALITY_RANK[fallback.quality] ? base.quality : fallback.quality,
    ingestedAt: Math.min(base.ingestedAt, fallback.ingestedAt),
    parsedAt: Math.max(base.parsedAt, fallback.parsedAt),
    mappingVersion: base.mappingVersion ?? fallback.mappingVersion,
    source: base.source,
  }

  const raw = base.raw ?? fallback.raw
  if (raw !== undefined) merged.raw = raw

  return merged
}

/**
 * Links a pre-battle roster to a finished record.
 *
 * Returns `null` unless exactly one roster matches; ambiguity is never guessed.
 */
export function matchRosterToRecord(
  rosters: readonly ArenaRoster[],
  record: MatchRecord,
): ArenaRoster | null {
  const known = rosters.filter((roster) => record.provisionalIds.includes(roster.provisionalId))
  if (known.length > 0) return known.length === 1 ? known[0]! : null

  if (record.battleTime === null || record.mapId === null) return null

  const candidates = rosters.filter((roster) => {
    if (roster.battleTime === null || roster.mapId !== record.mapId) return false
    return Math.abs(roster.battleTime - record.battleTime!) <= ROSTER_TIME_TOLERANCE_MS
  })
  return candidates.length === 1 ? candidates[0]! : null
}

/** Groups participants by `teamId + prebattle_id`; solo players are omitted. */
export function groupDivisions(participants: readonly MatchParticipant[]): Division[] {
  const groups = new Map<string, Division>()

  for (const participant of participants) {
    if (participant.divisionId === null || participant.divisionId <= 0) continue

    const key = `${participant.teamId ?? '?'}:${participant.divisionId}`
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, {
        teamId: participant.teamId,
        divisionId: participant.divisionId,
        participants: [participant],
      })
    } else {
      group.participants.push(participant)
    }
  }

  return [...groups.values()].filter((group) => group.participants.length >= 2)
}
