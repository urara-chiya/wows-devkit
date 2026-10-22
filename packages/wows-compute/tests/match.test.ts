import { describe, expect, it } from 'vitest'
import {
  arenaKeyOf,
  fromArenaInfo,
  fromReplay,
  groupDivisions,
  matchRosterToRecord,
  mergeMatchRecords,
  outcomeOf,
  statOutcome,
} from '../src/match/index.js'
import type { MatchRecord, ReplayFacts, ReplayPlayerLike } from '../src/match/index.js'

function player(overrides: Partial<ReplayPlayerLike> & Pick<ReplayPlayerLike, 'accountId' | 'name' | 'teamId'>): ReplayPlayerLike {
  return {
    clanId: null,
    clanTag: null,
    shipId: 100,
    damage: 0,
    frags: 0,
    exp: 0,
    rawExp: 0,
    isAlive: true,
    lifeTimeSec: 600,
    scoutingDamage: 0,
    killerAccountId: null,
    interactions: {},
    fields: {},
    ...overrides,
  }
}

function completeFacts(): ReplayFacts {
  return {
    meta: {
      dateTime: '18.10.2026 21:50:36',
      mapId: 9,
      mapName: 'spaces/16_OC_bees_to_honey',
      gameMode: 15,
      matchGroup: 'pvp',
      clientVersionFromExe: '15,9,0,13357625',
      duration: 1200,
      playerName: 'Me',
      playerID: 0,
      vehicles: [],
    },
    battleResults: {
      arenaId: 3591333186162334,
      mappingVersion: '15.9',
      common: {
        winnerTeamId: 0,
        startDt: 1792331479,
        durationSec: 720,
        gameMode: 15,
      },
      players: [
        player({ accountId: 1, name: 'Me', teamId: 0, damage: 150000 }),
        player({ accountId: 2, name: 'Mate', teamId: 0, fields: { prebattle_id: 100 } }),
        player({ accountId: 3, name: 'DivMate', teamId: 0, fields: { prebattle_id: 100 } }),
        player({ accountId: 4, name: 'Enemy', teamId: 1, fields: { prebattle_id: 200 } }),
        player({ accountId: 5, name: 'Enemy2', teamId: 1, fields: { prebattle_id: 200 } }),
      ],
    },
  }
}

function metaOnlyFacts(): ReplayFacts {
  return {
    meta: {
      dateTime: '18.10.2026 21:50:36',
      mapId: 9,
      mapName: 'spaces/16_OC_bees_to_honey',
      gameMode: 15,
      matchGroup: 'pvp',
      playerName: 'Me',
      vehicles: [
        { id: 1, name: 'Me', shipId: 100, relation: 0 },
        { id: 2, name: 'Mate', shipId: 101, relation: 1 },
        { id: 3, name: 'Enemy', shipId: 102, relation: 2 },
      ],
    },
    battleResults: null,
  }
}

describe('outcomeOf', () => {
  it('treats negative winner ids as a draw and zero as a real team', () => {
    expect(outcomeOf(0, 0)).toBe('win')
    expect(outcomeOf(1, 0)).toBe('loss')
    expect(outcomeOf(0, -1)).toBe('draw')
    expect(outcomeOf(0, null)).toBe('unknown')
    expect(outcomeOf(null, 0)).toBe('unknown')
  })

  it('maps a draw to a statistical loss', () => {
    expect(statOutcome('draw')).toBe('loss')
    expect(statOutcome('unknown')).toBeNull()
  })
})

describe('arenaKeyOf', () => {
  it('prefers the numeric arena id', () => {
    expect(arenaKeyOf({ arenaId: 42, battleTime: 1, mapId: 2, accountIds: [3] })).toBe('arena:42')
  })

  it('derives a stable key from time, map and sorted accounts', () => {
    const key = arenaKeyOf({ battleTime: 1, mapId: 2, accountIds: [3, null, 1, 3] })
    expect(key).toBe('derived:1:2:1,3')
    expect(key).toBe(arenaKeyOf({ battleTime: 1, mapId: 2, accountIds: [1, 3] }))
  })

  it('falls back to an unknown marker', () => {
    expect(arenaKeyOf({ battleTime: null, mapId: null, accountIds: [] })).toMatch(/^unknown:[0-9a-f]{8}$/)
  })
})

describe('fromArenaInfo', () => {
  it('reads account ids and relations from tempArenaInfo', () => {
    const roster = fromArenaInfo({
      matchGroup: 'pvp',
      gameMode: 7,
      mapId: 34,
      mapName: '54_Faroe',
      dateTime: '01.01.2025 12:00:00',
      clientVersionFromExe: '15,3,0,12267945',
      playersPerTeam: 12,
      vehicles: [
        { id: 672020662, name: 'Me', shipId: 1, relation: 0 },
        { id: 672077952, name: 'Mate', shipId: 2, relation: 1 },
        { id: 672137090, name: 'Enemy', shipId: 3, relation: 2 },
        { id: 0, name: ':Bot', shipId: 4, relation: 2 },
      ],
    })

    expect(roster.battleTime).toBe(Date.UTC(2025, 0, 1, 4, 0, 0))
    expect(roster.participants.map((entry) => entry.relation)).toEqual(['self', 'ally', 'enemy', 'enemy'])
    expect(roster.participants[3].isBot).toBe(true)
    expect(roster.provisionalId).toContain('672020662')
  })
})

describe('fromReplay', () => {
  it('builds a complete record from the results packet', () => {
    const record = fromReplay(completeFacts())

    expect(record.arenaId).toBe('3591333186162334')
    expect(record.battleTime).toBe(1792331479 * 1000)
    expect(record.outcome).toBe('win')
    expect(record.quality).toBe('complete')
    expect(record.durationSec).toBe(720)
    expect(record.mappingVersion).toBe('15.9')
    expect(record.participants.find((entry) => entry.name === 'Me')?.relation).toBe('self')
    expect(record.participants.find((entry) => entry.name === 'Enemy')?.relation).toBe('enemy')
  })

  it('keeps a meta-only record when no results packet exists', () => {
    const record = fromReplay(metaOnlyFacts())

    expect(record.quality).toBe('meta-only')
    expect(record.outcome).toBe('unknown')
    expect(record.winnerTeamId).toBeNull()
    expect(record.arenaId).toMatch(/^derived:/)
    expect(record.participants).toHaveLength(3)
    expect(record.participants[0]?.result).toBeNull()
  })

  it('prefers startDt over the recorder-local dateTime', () => {
    const facts = completeFacts()
    facts.meta.dateTime = '01.01.2025 00:00:00'
    expect(fromReplay(facts).battleTime).toBe(1792331479 * 1000)
  })

  it('only includes the raw payload when asked', () => {
    const facts = completeFacts()
    facts.battleResults!.raw = { commonList: [] }

    expect(fromReplay(facts).raw).toBeUndefined()
    expect(fromReplay(facts, { includeRaw: true }).raw).toEqual({ commonList: [] })
  })
})

describe('groupDivisions', () => {
  it('groups by team and prebattle id, ignoring solo players', () => {
    const divisions = groupDivisions(fromReplay(completeFacts()).participants)

    expect(divisions).toHaveLength(2)
    expect(divisions[0]).toMatchObject({ teamId: 0, divisionId: 100 })
    expect(divisions[0]?.participants.map((entry) => entry.name)).toEqual(['Mate', 'DivMate'])
    expect(divisions[1]).toMatchObject({ teamId: 1, divisionId: 200 })
  })

  it('does not mix a shared id across teams', () => {
    const record = fromReplay(completeFacts())
    record.participants[0]!.divisionId = 100

    const divisions = groupDivisions(record.participants)
    expect(divisions[0]?.participants).toHaveLength(3)
    expect(divisions[1]?.participants).toHaveLength(2)
  })
})

describe('mergeMatchRecords', () => {
  it('prefers the complete parse and fills missing fields', () => {
    const complete = fromReplay(completeFacts(), { ingestedAt: 100, parsedAt: 200 })
    complete.provisionalIds = ['roster:a']
    const metaOnly = fromReplay(metaOnlyFacts(), { ingestedAt: 50, parsedAt: 300 })

    const merged = mergeMatchRecords(complete, metaOnly)

    expect(merged.quality).toBe('complete')
    expect(merged.participants).toHaveLength(5)
    expect(merged.ingestedAt).toBe(50)
    expect(merged.parsedAt).toBe(300)
    expect(merged.provisionalIds).toEqual(['roster:a'])
    expect(merged.outcome).toBe('win')
  })

  it('is order independent for the same inputs', () => {
    const a = fromReplay(completeFacts(), { ingestedAt: 100, parsedAt: 200 })
    const b = fromReplay(metaOnlyFacts(), { ingestedAt: 50, parsedAt: 300 })

    expect(mergeMatchRecords(a, b)).toEqual(mergeMatchRecords(b, a))
  })

  it('fills a missing result from the other parse', () => {
    const complete = fromReplay(completeFacts(), { ingestedAt: 100, parsedAt: 200 })
    const metaOnly = fromReplay(metaOnlyFacts(), { ingestedAt: 50, parsedAt: 300 })
    const merged = mergeMatchRecords(metaOnly, complete)

    expect(merged.participants.every((entry) => entry.result !== null)).toBe(true)
  })
})

describe('matchRosterToRecord', () => {
  const record = fromReplay(completeFacts())

  it('returns a unique time + map match and refuses ambiguity', () => {
    const roster = fromArenaInfo({
      dateTime: '18.10.2026 21:50:36',
      mapId: 9,
      vehicles: [{ id: 1, name: 'Me', relation: 0 }],
    })
    expect(matchRosterToRecord([roster], record)).toBe(roster)

    const twin = fromArenaInfo({
      dateTime: '18.10.2026 21:50:37',
      mapId: 9,
      vehicles: [{ id: 9, name: 'Other', relation: 0 }],
    })
    expect(matchRosterToRecord([roster, twin], record)).toBeNull()
  })

  it('uses provisionalIds before time', () => {
    const roster = fromArenaInfo({ dateTime: '01.01.2025 00:00:00', mapId: 1, vehicles: [] })
    const linked: MatchRecord = { ...record, provisionalIds: [roster.provisionalId] }

    expect(matchRosterToRecord([roster], linked)).toBe(roster)
  })
})
