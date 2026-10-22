import { describe, expect, it } from 'vitest'
import { calculatePR } from 'wows-number-api-sdk'
import type { ExpectedValuesDocument, ShipBattleStats } from 'wows-number-api-sdk'
import {
  aggregatePlayers,
  aggregateShips,
  aggregateTeam,
  dailySeries,
} from '../src/aggregate/index.js'
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
        { accountId: 1, name: 'A', teamId: 0, shipId: 1, damage: 100000, frags: 2 },
        { accountId: 2, name: 'B', teamId: 0, shipId: 2, damage: 50000, frags: 1 },
        { accountId: 0, name: ':Bot', teamId: 0, shipId: 1, isBot: true },
        { accountId: null, name: 'Hidden', teamId: 0, shipId: 1 },
        { accountId: 4, name: 'Broken', teamId: 0, shipId: 1, noResult: true },
        { accountId: 3, name: 'C', teamId: 1, shipId: 2, damage: 20000 },
      ],
    }),
    makeRecord({
      arenaId: 'r2',
      battleTime: 2000,
      winnerTeamId: 1,
      participants: [
        { accountId: 1, name: 'A', teamId: 0, shipId: 1, damage: 40000 },
        { accountId: 2, name: 'B', teamId: 0, shipId: 1, damage: 30000, frags: 1 },
        { accountId: 3, name: 'C', teamId: 1, shipId: 1, damage: 80000, frags: 2 },
      ],
    }),
    makeRecord({
      arenaId: 'r3',
      battleTime: 3000,
      winnerTeamId: -1,
      participants: [
        { accountId: 1, name: 'A', teamId: 0, shipId: 2, damage: 10000 },
        { accountId: 2, name: 'B', teamId: 0, shipId: 2, damage: 20000 },
        { accountId: 3, name: 'C', teamId: 1, shipId: 2, damage: 30000 },
      ],
    }),
    makeRecord({
      arenaId: 'r4',
      battleTime: 4000,
      winnerTeamId: 0,
      participants: [
        { accountId: 1, name: 'A', teamId: 0, shipId: 1, damage: 30000 },
        { accountId: 3, name: 'C', teamId: 1, shipId: 1, damage: 10000 },
      ],
    }),
  ]
}

const options = { weighting: 'battles' as const, prAggregation: 'pooled' as const, expected }

describe('aggregatePlayers', () => {
  it('orders by battles and keeps draws in battles', () => {
    const rows = aggregatePlayers(records(), options)

    expect(rows.map((row) => [row.accountId, row.battles, row.wins, row.losses, row.draws])).toEqual([
      [1, 4, 2, 1, 1],
      [3, 4, 1, 2, 1],
      [2, 3, 1, 1, 1],
    ])
    expect(rows[0]?.winRate.value).toBe(50)
    expect(rows[0]?.avgDamage.value).toBe(45000)
  })

  it('computes a pooled PR per player', () => {
    const rows = aggregatePlayers(records(), options)
    const stats: ShipBattleStats = {
      shipId: 1,
      battles: 3,
      damage: 170000,
      frags: 2,
      wins: 2,
    }
    const withShip2: ShipBattleStats = {
      shipId: 2,
      battles: 1,
      damage: 10000,
      frags: 0,
      wins: 0,
    }

    expect(rows[0]?.pr.value).toBeCloseTo(calculatePR([stats, withShip2], expected)!.pr, 10)
  })
})

describe('aggregateTeam', () => {
  it('separates equal and battles weighting', () => {
    const equal = aggregateTeam(records(), 0, { ...options, weighting: 'equal' })
    const battles = aggregateTeam(records(), 0, options)

    expect(equal.values.winRate.value).toBeCloseTo((50 + 100 / 3) / 2, 10)
    expect(battles.values.winRate.value).toBeCloseTo((2 + 1) / (4 + 3) * 100, 10)
    expect(battles.values.avgDamage.value).toBeCloseTo(280000 / 7, 10)
  })

  it('reports coverage whose parts sum to the total', () => {
    const team = aggregateTeam(records(), 0, options)

    expect(team.coverage).toEqual({ total: 10, resolved: 7, hidden: 1, bot: 1, failed: 1 })
    expect(team.players).toBe(2)
    expect(team.coverage.resolved + team.coverage.hidden + team.coverage.bot + team.coverage.failed)
      .toBe(team.coverage.total)
  })

  it('distinguishes mean and pooled PR', () => {
    const mean = aggregateTeam(records(), 0, { ...options, prAggregation: 'mean' })
    const pooled = aggregateTeam(records(), 0, options)

    expect(mean.values.pr.value).not.toBeCloseTo(pooled.values.pr.value!, 6)
  })

  it('returns null with an empty team', () => {
    const team = aggregateTeam(records(), 9, options)

    expect(team.players).toBe(0)
    expect(team.values.winRate.value).toBeNull()
    expect(team.values.pr.value).toBeNull()
  })
})

describe('aggregateShips', () => {
  it('aggregates by ship and ignores unknown winners', () => {
    const rows = aggregateShips(records(), options)
    const byShip = new Map(rows.map((row) => [row.shipId, row]))

    expect([...byShip.keys()]).toEqual([1, 2])
    expect(byShip.get(1)).toMatchObject({ battles: 6, wins: 3, losses: 3, draws: 0 })
    expect(byShip.get(2)).toMatchObject({ battles: 5, wins: 1, losses: 1, draws: 3 })
  })

  it('keeps coverage parts equal to the total', () => {
    for (const row of aggregateShips(records(), options)) {
      expect(row.winRate.coverage.resolved + row.winRate.coverage.hidden
        + row.winRate.coverage.bot + row.winRate.coverage.failed)
        .toBe(row.winRate.coverage.total)
    }
  })
})

describe('dailySeries', () => {
  it('groups by game day with the boundary hour', () => {
    const list = [
      makeRecord({
        arenaId: 'd1',
        battleTime: Date.UTC(2026, 9, 18, 19, 0, 0),
        winnerTeamId: 0,
        participants: [
          { accountId: 1, teamId: 0, relation: 'self', shipId: 1, damage: 66000 },
        ],
      }),
      makeRecord({
        arenaId: 'd2',
        battleTime: Date.UTC(2026, 9, 18, 20, 0, 0),
        winnerTeamId: 1,
        participants: [
          { accountId: 1, teamId: 0, relation: 'self', shipId: 1, damage: 44000 },
        ],
      }),
      makeRecord({
        arenaId: 'd3',
        battleTime: null,
        winnerTeamId: 0,
        participants: [
          { accountId: 1, teamId: 0, relation: 'self', shipId: 1 },
        ],
      }),
    ]

    const points = dailySeries(list, { timeZone: 'Asia/Shanghai', expected })

    expect(points.map((point) => point.day)).toEqual(['2026-10-18', '2026-10-19'])
    expect(points[0]).toMatchObject({ matches: 1, wins: 1, winRate: 100, avgDamage: 66000 })
    expect(points[1]).toMatchObject({ matches: 1, wins: 0, losses: 1, winRate: 0 })
    expect(points[0]?.pr.value).not.toBeNull()
  })

  it('applies match group filters', () => {
    const list = [
      makeRecord({
        arenaId: 'd1',
        battleTime: 1000,
        winnerTeamId: 0,
        matchGroup: 'ranked',
        participants: [{ accountId: 1, teamId: 0, relation: 'self', shipId: 1 }],
      }),
    ]

    expect(dailySeries(list, { timeZone: 'Asia/Shanghai', matchGroups: ['pvp'] })).toEqual([])
  })
})
