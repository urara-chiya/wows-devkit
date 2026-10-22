export type MatchGroup =
  | 'pvp' | 'ranked' | 'coop' | 'clan' | 'brawl' | 'event' | 'unknown'

export type Relation = 'self' | 'ally' | 'enemy' | 'unknown'

export type Outcome = 'win' | 'loss' | 'draw' | 'unknown'

/** Statistical outcome: a draw counts as a loss for both teams. */
export type StatOutcome = 'win' | 'loss'

export type RecordQuality = 'meta-only' | 'partial' | 'complete'

export type ResultValue =
  | string
  | number
  | boolean
  | null
  | ResultValue[]
  | { [key: string]: ResultValue }

export interface ArenaRoster {
  provisionalId: string
  battleTime: number | null
  gameMode: number | null
  matchGroup: MatchGroup
  mapId: number | null
  mapName: string | null
  clientVersion: string | null
  durationSec: number | null
  playersPerTeam: number | null
  participants: RosterParticipant[]
  raw: unknown
}

export interface RosterParticipant {
  accountId: number | null
  name: string | null
  clanId: number | null
  clanTag: string | null
  shipId: number | null
  relation: Relation
  isBot: boolean
}

export interface MatchRecord {
  arenaId: string
  provisionalIds: string[]
  battleTime: number | null
  gameMode: number | null
  matchGroup: MatchGroup
  mapId: number | null
  mapName: string | null
  clientVersion: string | null
  durationSec: number | null
  winnerTeamId: number | null
  outcome: Outcome
  participants: MatchParticipant[]
  quality: RecordQuality
  ingestedAt: number
  parsedAt: number
  mappingVersion: string | null
  source: MatchSource
  raw?: unknown
}

export interface MatchSource {
  kind: 'replay'
  fileName?: string
  size?: number
  mtimeMs?: number
}

export interface MatchParticipant {
  accountId: number | null
  name: string | null
  clanId: number | null
  clanTag: string | null
  shipId: number | null
  teamId: number | null
  relation: Relation
  isBot: boolean
  divisionId: number | null
  result: PlayerResult | null
}

export interface PlayerResult {
  damage: number | null
  frags: number | null
  exp: number | null
  rawExp: number | null
  isAlive: boolean | null
  lifeTimeSec: number | null
  scoutingDamage: number | null
  killerAccountId: number | null
  interactions: Record<string, Record<string, ResultValue>>
  fields: Record<string, ResultValue>
}

export interface ArenaInfoVehicle {
  id?: number | null
  name?: string | null
  shipId?: number | null
  relation?: number | null
}

/** Structural subset of `tempArenaInfo.json`; unknown keys are preserved in `raw`. */
export interface ArenaInfoLike {
  matchGroup?: string | null
  gameMode?: number | null
  mapId?: number | null
  mapName?: string | null
  clientVersionFromExe?: string | null
  duration?: number | null
  battleDuration?: number | null
  playersPerTeam?: number | null
  dateTime?: string | null
  vehicles?: readonly ArenaInfoVehicle[] | null
  [key: string]: unknown
}

export interface ReplayVehicleLike {
  id?: number | null
  name?: string | null
  shipId?: number | null
  relation?: number | null
}

export interface ReplayMetaLike {
  dateTime?: string | null
  mapId?: number | null
  mapName?: string | null
  gameMode?: number | null
  gameType?: string | null
  matchGroup?: string | null
  clientVersionFromExe?: string | null
  duration?: number | null
  battleDuration?: number | null
  playersPerTeam?: number | null
  playerID?: number | null
  playerName?: string | null
  vehicles?: readonly ReplayVehicleLike[] | null
  [key: string]: unknown
}

export interface ReplayPlayerLike {
  accountId: number | null
  name: string | null
  clanId: number | null
  clanTag: string | null
  teamId: number | null
  shipId: number | null
  damage: number | null
  frags: number | null
  exp: number | null
  rawExp: number | null
  isAlive: boolean | null
  lifeTimeSec: number | null
  scoutingDamage: number | null
  killerAccountId: number | null
  interactions: Record<string, Record<string, ResultValue>>
  fields: Record<string, ResultValue>
}

export interface ReplayCommonLike {
  winnerTeamId?: number | null
  durationSec?: number | null
  gameMode?: number | null
  scenarioName?: string | null
  startDt?: number | null
}

export interface ReplayResultsLike {
  arenaId?: number | null
  accountId?: number | null
  mappingVersion?: string | null
  common?: ReplayCommonLike | null
  players: readonly ReplayPlayerLike[]
  raw?: unknown
}

/** Structural subset of `ParsedReplay` from `wows-replay-parser`. */
export interface ReplayFacts {
  meta: ReplayMetaLike
  battleResults: ReplayResultsLike | null
}

export interface ArenaKeyInput {
  arenaId?: number | null
  battleTime: number | null
  mapId: number | null
  accountIds: readonly (number | null)[]
}

export interface Division {
  teamId: number | null
  divisionId: number
  participants: MatchParticipant[]
}
