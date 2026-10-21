export interface ReplayVersion {
  major: number
  minor: number
  patch: number
  build: number | null
  raw: string
}

export interface ReplayVehicle {
  shipId: number
  relation: number
  id: number
  name: string
}

export interface ReplayMeta {
  matchGroup?: string
  gameMode: number
  gameType?: string
  clientVersionFromExe: string
  clientVersionFromXml?: string
  scenarioUiCategoryId?: number
  mapDisplayName: string
  mapId: number
  mapName: string
  duration: number
  battleDuration?: number
  name: string
  scenario: string
  playerID: number
  playerName: string
  playerVehicle: string
  vehicles: ReplayVehicle[]
  playersPerTeam: number
  teamsCount: number
  dateTime: string
  scenarioConfigId: number
  weatherParams?: Record<string, string[]>
  version: ReplayVersion | null
  [key: string]: unknown
}

export type BattleResultValue =
  | string
  | number
  | boolean
  | null
  | BattleResultValue[]
  | { [key: string]: BattleResultValue }

export interface RawBattleResults {
  commonList: unknown[]
  playersPublicInfo: Record<string, unknown[]>
  accountDBID?: number
  arenaUniqueID?: number
  privateDataList?: unknown[]
  buildings?: unknown
  preBattlesInfo?: unknown
  [key: string]: unknown
}

export interface BattleResultsMapping {
  version: string
  build: number
  commonResults: string[]
  publicResultIndices: Record<string, number>
  interactionDetails: string[]
}

export interface BattlePlayer {
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
  interactions: Record<string, Record<string, BattleResultValue>>
  fields: Record<string, BattleResultValue>
}

export interface CommonBattleResults {
  arenaId: number | null
  winnerTeamId: number | null
  durationSec: number | null
  gameMode: number | null
  scenarioName: string | null
  startDt: number | null
  winTypeId: number | null
  fields: Record<string, BattleResultValue>
}

export interface BattleResults {
  raw: RawBattleResults
  mappingVersion: string
  mappingBuild: number
  accountId: number | null
  arenaId: number | null
  common: CommonBattleResults
  players: BattlePlayer[]
}

export interface ParsedReplay {
  meta: ReplayMeta
  battleResults: BattleResults | null
}

export interface ReplayPacket {
  size: number
  type: number
  clock: number
  payload: Uint8Array
}

export interface InflateOptions {
  maxOutputLength?: number
}

export type Inflate = (data: Uint8Array, options?: InflateOptions) => Uint8Array

export interface ParseReplayOptions {
  inflate: Inflate
  mapping?: BattleResultsMapping
  maxDecompressedBytes?: number
  maxMetadataBytes?: number
}

export interface ParseReplayMetaOptions {
  maxMetadataBytes?: number
}

export interface ReplayContainer {
  meta: ReplayMeta
  metaJson: string
  extraBlocks: Uint8Array[]
  decompressedSize: number
  compressedSize: number
  packetStream: Uint8Array
}
