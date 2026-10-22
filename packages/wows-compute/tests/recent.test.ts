import { describe, expect, it } from 'vitest'
import type { ExpectedValuesDocument } from 'wows-number-api-sdk'
import { recentMatches } from '../src/recent/index.js'
import type { MatchRecord } from '../src/match/index.js'
import { makeRecord } from './helpers/match.js'

const expected: ExpectedValuesDocument = {
  time: 1,
  data: {
    1: { average_damage_dealt: 50000, average_frags: 0.8, win_rate: 50 },
    2: { average_damage_dealt: 60000, average_frags: 0.6, win_rate: 52 },
  },
}

function records(): MatchRecord[] {
  return [
    makeRecord({
      arenaId: 'r1',
      battleTime: 1000,
      winnerTeamId: 0,
      participants: [
        { accountId: 1, name: 'Self', teamId: 0, relation: 'self', shipId: 1, damage: 100000, frags: 2 },
        { accountId: 3, name: 'Enemy', teamId: 1, shipId: 2, damage: 20000 },
      ],
    }),
    makeRecord({
      arenaId: 'r2',
      battleTime: 2000,
      winnerTeamId: 1,
      participants: [
        { accountId: 1, name: 'Self', teamId: 0, relation: 'self', shipId: 1, damage: 50000, frags: 1 },
        { accountId: 3, name: 'Enemy', teamId: 1, shipId: 2, damage: 80000, frags: 2 },
      ],
    }),
    makeRecord({
      arenaId: 'r3',
      battleTime: 3000,
      winnerTeamId: 0,
      participants: [
        { accountId: 1, name: 'Self', teamId: 0, relation: 'self', shipId: 2, damage: 60000 },
        { accountId: 3, name: 'Enemy', teamId: 1, shipId: 1, damage: 10000 },
      ],
    }),
    makeRecord({
      arenaId: 'r4',
      battleTime: 4000,
      winnerTeamId: -1,
      participants: [
        { accountId: 1, name: 'Self', teamId: 0, relation: 'self', shipId: 1, damage: 10000 },
        { accountId: 3, name: 'Enemy', teamId: 1, shipId: 1, damage: 10000 },
      ],
    }),
  ]
}

describe('recentMatches', () => {
  it('windows self matches newest first and counts a draw as a loss', () => {
    const result = recentMatches(records(), { subject: { kind: 'self' } }, expected)

    expect(result.matches.map((record) => record.arenaId)).toEqual(['r4', 'r3', 'r2', 'r1'])
    expect(result.stats).toMatchObject({
      battles: 4,
      wins: 2,
      losses: 1,
      draws: 1,
      winRate: 50,
      damage: 220000,
      frags: 3,
      avgDamage: 55000,
    })
    expect(result.stats.pr).toMatchObject({ basis: 'account', exact: true })
    expect(result.sample).toEqual({ kind: 'ingested', matches: 4 })
  })

  it('applies the match-count window after sorting', () => {
    const result = recentMatches(records(), { subject: { kind: 'self' }, last: 2 }, expected)

    expect(result.matches.map((record) => record.arenaId)).toEqual(['r4', 'r3'])
    expect(result.stats).toMatchObject({ battles: 2, wins: 1, draws: 1, winRate: 50 })
  })

  it('returns an empty result for a zero window', () => {
    const result = recentMatches(records(), { subject: { kind: 'self' }, last: 0 }, expected)

    expect(result.matches).toEqual([])
    expect(result.stats).toMatchObject({ battles: 0, winRate: null, pr: null })
  })

  it('keeps date bounds and reports them in the sample', () => {
    const result = recentMatches(
      records(),
      { subject: { kind: 'self' }, from: 1500, to: 2500 },
      expected,
    )

    expect(result.matches.map((record) => record.arenaId)).toEqual(['r2'])
    expect(result.sample).toEqual({
      kind: 'ingested',
      matches: 1,
      from: new Date(1500).toISOString(),
      to: new Date(2500).toISOString(),
    })
  })

  it('can exclude draws for special analysis', () => {
    const result = recentMatches(
      records(),
      { subject: { kind: 'self' }, drawPolicy: 'exclude' },
      expected,
    )

    expect(result.stats).toMatchObject({ battles: 3, wins: 2, losses: 1, draws: 0 })
    expect(result.stats.winRate).toBeCloseTo(200 / 3, 10)
  })

  it('reports shared matches when querying another participant', () => {
    const result = recentMatches(
      records(),
      { subject: { kind: 'participant', accountId: 3 } },
      expected,
    )

    expect(result.stats).toMatchObject({ battles: 4, wins: 1, losses: 2, draws: 1, winRate: 25 })
    expect(result.sample.sharedWith).toBe(4)
  })

  it('filters match groups and unusable records', () => {
    const list: MatchRecord[] = records().map((record) => ({ ...record, matchGroup: 'ranked' }))
    list.push(makeRecord({
      arenaId: 'meta',
      battleTime: 5000,
      winnerTeamId: null,
      participants: [
        { accountId: 1, name: 'Self', teamId: 0, relation: 'self', shipId: 1, noResult: true },
      ],
      quality: 'meta-only',
    }))
    list.push(makeRecord({
      arenaId: 'no-winner',
      battleTime: 4500,
      winnerTeamId: null,
      participants: [
        { accountId: 1, name: 'Self', teamId: 0, relation: 'self', shipId: 1, damage: 99999 },
      ],
      quality: 'partial',
    }))

    expect(recentMatches(list, { subject: { kind: 'self' }, matchGroups: ['pvp'] }).matches).toEqual([])
    const all = recentMatches(list, { subject: { kind: 'self' } })
    expect(all.matches).toHaveLength(4)
    expect(all.matches.map((record) => record.arenaId)).not.toContain('no-winner')
  })
})
