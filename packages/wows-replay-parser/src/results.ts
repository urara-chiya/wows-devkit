import { readUint32LE } from './container.js'
import { LATEST_MAPPING } from './constants.js'
import { ReplayError } from './errors.js'
import type {
  BattlePlayer,
  BattleResultValue,
  BattleResults,
  BattleResultsMapping,
  CommonBattleResults,
  RawBattleResults,
  ReplayMeta,
} from './types.js'

const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function parseBattleResultsPayload(payload: Uint8Array): RawBattleResults {
  if (payload.length < 4) {
    throw new ReplayError('INVALID_BATTLE_RESULTS', 'battle results packet is shorter than its length prefix')
  }

  const length = readUint32LE(payload, 0)
  if (length + 4 !== payload.length) {
    throw new ReplayError(
      'INVALID_BATTLE_RESULTS',
      `battle results length prefix says ${length} bytes, packet carries ${payload.length - 4}`,
    )
  }

  let text: string
  try {
    text = textDecoder.decode(payload.subarray(4))
  } catch (cause) {
    throw new ReplayError('INVALID_BATTLE_RESULTS', 'battle results are not valid UTF-8', { cause })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new ReplayError('INVALID_BATTLE_RESULTS', 'battle results are not valid JSON', { cause })
  }

  if (!isRecord(parsed)) {
    throw new ReplayError('INVALID_BATTLE_RESULTS', 'battle results are not a JSON object')
  }
  if (!Array.isArray(parsed.commonList)) {
    throw new ReplayError('INVALID_BATTLE_RESULTS', 'battle results are missing commonList')
  }
  if (!isRecord(parsed.playersPublicInfo)) {
    throw new ReplayError('INVALID_BATTLE_RESULTS', 'battle results are missing playersPublicInfo')
  }

  return parsed as RawBattleResults
}

export function resolveBattleResults(
  raw: RawBattleResults,
  mapping: BattleResultsMapping = LATEST_MAPPING,
): BattleResults {
  const commonFields = resolveByNames(mapping.commonResults, raw.commonList)
  const players: BattlePlayer[] = []

  for (const [accountKey, values] of Object.entries(raw.playersPublicInfo)) {
    if (!Array.isArray(values)) {
      throw new ReplayError('INVALID_BATTLE_RESULTS', `player ${accountKey} has no positional result array`)
    }

    const fields = resolveByIndices(mapping, values)
    const rawInteractions = fields.interactions
    const interactions: Record<string, Record<string, BattleResultValue>> = {}

    if (isRecord(rawInteractions)) {
      for (const [victimId, victimValues] of Object.entries(rawInteractions)) {
        if (Array.isArray(victimValues)) {
          interactions[victimId] = resolveInteraction(mapping.interactionDetails, victimValues)
        }
      }
    }

    players.push({
      accountId: asNumber(fields.account_db_id) ?? (Number.parseInt(accountKey, 10) || null),
      name: asString(fields.name),
      clanId: asNumber(fields.clan_id),
      clanTag: asString(fields.clan_tag),
      teamId: asNumber(fields.team_id),
      shipId: asNumber(fields.vehicle_type_id),
      damage: asNumber(fields.damage),
      frags: asNumber(fields.ships_killed),
      exp: asNumber(fields.exp),
      rawExp: asNumber(fields.raw_exp),
      isAlive: asBoolean(fields.is_alive),
      lifeTimeSec: asNumber(fields.life_time_sec),
      scoutingDamage: asNumber(fields.scouting_damage),
      killerAccountId: asNumber(fields.killer_db_id),
      interactions,
      fields,
    })
  }

  return {
    raw,
    mappingVersion: mapping.version,
    mappingBuild: mapping.build,
    accountId: asNumber(raw.accountDBID),
    arenaId: asNumber(raw.arenaUniqueID),
    common: buildCommon(commonFields),
    players,
  }
}

export function getSelfPlayer(meta: ReplayMeta, results: BattleResults): BattlePlayer | null {
  if (meta.playerID) {
    const byId = results.players.find((player) => player.accountId === meta.playerID)
    if (byId) return byId
  }

  const selfName = meta.playerName || meta.vehicles.find((vehicle) => vehicle.relation === 0)?.name
  if (!selfName) return null

  return results.players.find((player) => player.name === selfName) ?? null
}

function buildCommon(fields: Record<string, BattleResultValue>): CommonBattleResults {
  return {
    arenaId: asNumber(fields.arena_id),
    winnerTeamId: asNumber(fields.winner_team_id),
    durationSec: asNumber(fields.duration_sec),
    gameMode: asNumber(fields.game_mode),
    scenarioName: asString(fields.scenario_name),
    startDt: asNumber(fields.start_dt),
    winTypeId: asNumber(fields.win_type_id),
    fields,
  }
}

function resolveByNames(names: readonly string[], values: readonly unknown[]): Record<string, BattleResultValue> {
  const resolved: Record<string, BattleResultValue> = {}
  for (let index = 0; index < names.length && index < values.length; index += 1) {
    const value = values[index]
    if (value !== undefined) resolved[names[index]] = value as BattleResultValue
  }
  return resolved
}

function resolveByIndices(
  mapping: BattleResultsMapping,
  values: readonly unknown[],
): Record<string, BattleResultValue> {
  const resolved: Record<string, BattleResultValue> = {}
  for (const [name, index] of Object.entries(mapping.publicResultIndices)) {
    if (index >= 0 && index < values.length) {
      const value = values[index]
      if (value !== undefined) resolved[name] = value as BattleResultValue
    }
  }
  return resolved
}

function resolveInteraction(
  names: readonly string[],
  values: readonly unknown[],
): Record<string, BattleResultValue> {
  return resolveByNames(names, values)
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
