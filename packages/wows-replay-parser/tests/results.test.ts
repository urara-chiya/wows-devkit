import { describe, expect, test } from 'vitest'
import { LATEST_MAPPING } from '../src/constants.js'
import { getSelfPlayer, parseBattleResultsPayload, resolveBattleResults } from '../src/results.js'
import type { BattleResultsMapping, RawBattleResults } from '../src/types.js'
import { createMeta } from './helpers/replay.js'

const mapping: BattleResultsMapping = {
  version: 'test',
  build: 1,
  commonResults: ['arena_id', 'winner_team_id', 'duration_sec', 'game_mode'],
  publicResultIndices: {
    account_db_id: 0,
    name: 1,
    clan_tag: 2,
    team_id: 3,
    vehicle_type_id: 4,
    damage: 5,
    ships_killed: 6,
    is_alive: 7,
    life_time_sec: 8,
    exp: 9,
    raw_exp: 10,
    scouting_damage: 11,
    killer_db_id: 12,
    interactions: 13,
  },
  interactionDetails: ['is_killed', 'fires'],
}

const raw: RawBattleResults = {
  accountDBID: 42,
  arenaUniqueID: 99,
  commonList: [99, 1, 720, 15],
  playersPublicInfo: {
    42: [42, 'Alice', 'TAG', 1, 1234, 100000, 3, true, 720, 1500, 1400, 8000, 0, { 7: [1, 2] }],
    7: [7, 'Bob', 'ENY', 2, 5678, 50000, 1, false, 400, 900, 800, 0, 42, {}],
  },
}

describe('battle results', () => {
  test('resolves common and player fields through the mapping', () => {
    const results = resolveBattleResults(raw, mapping)

    expect(results.common).toMatchObject({ arenaId: 99, winnerTeamId: 1, durationSec: 720, gameMode: 15 })
    expect(results.players).toHaveLength(2)

    const alice = results.players.find((player) => player.name === 'Alice')
    expect(alice).toMatchObject({
      accountId: 42,
      clanTag: 'TAG',
      teamId: 1,
      shipId: 1234,
      damage: 100000,
      frags: 3,
      exp: 1500,
      rawExp: 1400,
      isAlive: true,
      lifeTimeSec: 720,
      scoutingDamage: 8000,
      killerAccountId: 0,
    })
    expect(alice?.interactions[7]).toEqual({ is_killed: 1, fires: 2 })
    expect(alice?.fields.damage).toBe(100000)
  })

  test('uses null for absent or mistyped fields', () => {
    const results = resolveBattleResults(
      { commonList: [], playersPublicInfo: { 1: [1, 'Sparse'] } },
      mapping,
    )

    expect(results.players[0]).toMatchObject({
      accountId: 1,
      name: 'Sparse',
      damage: null,
      isAlive: null,
      interactions: {},
    })
  })

  test('parses the length-prefixed battle results payload', () => {
    const body = new TextEncoder().encode(JSON.stringify(raw))
    const payload = new Uint8Array(4 + body.length)
    new DataView(payload.buffer).setUint32(0, body.length, true)
    payload.set(body, 4)

    expect(parseBattleResultsPayload(payload).commonList).toEqual(raw.commonList)
  })

  test('rejects a length prefix that does not match the payload', () => {
    const payload = new Uint8Array(8)
    new DataView(payload.buffer).setUint32(0, 99, true)
    expect(() => parseBattleResultsPayload(payload)).toThrow(/length prefix/)
  })

  test('finds the recording player by id or name', () => {
    const results = resolveBattleResults(raw, mapping)

    expect(getSelfPlayer(createMeta({ playerID: 42 }), results)?.name).toBe('Alice')
    expect(getSelfPlayer(createMeta({ playerID: 0, playerName: 'Bob' }), results)?.name).toBe('Bob')
  })

  test('ships the 15.9 mapping snapshot', () => {
    expect(LATEST_MAPPING.version).toBe('15.9')
    expect(LATEST_MAPPING.publicResultIndices.account_db_id).toBe(0)
    expect(LATEST_MAPPING.commonResults).toContain('winner_team_id')
  })
})
