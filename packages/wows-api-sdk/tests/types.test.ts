import { describe, expect, it } from 'vitest'
import type {
  ClanSeasonData,
  CrewRanksData,
  EncyclopediaAchievementsData,
  SeasonShipStatsData,
  SeasonsInfoData,
  ShipStatsData,
} from '../src/official'
import type { ClanbaseInfoData, ClanMembersData } from '../src/clans'
import type { VortexAchievementsData, VortexShipStatsData } from '../src/vortex'

/**
 * These literals pin response container shapes that differ from the generated
 * reference documentation.
 */
describe('response container shapes', () => {
  it('keys ships/stats by account and stores an array per account', () => {
    const data = {
      '1000000001': [
        {
          account_id: 1000000001,
          ship_id: 3540000001,
          battles: 7,
          distance: 424,
          pvp: { battles: 7, wins: 6, losses: 1, damage_dealt: 100000 },
        },
      ],
    } satisfies ShipStatsData

    expect(data['1000000001']).toHaveLength(1)
    expect(data['1000000001']![0]!.pvp?.wins).toBe(6)
  })

  it('keys seasons/info by season id', () => {
    const data = {
      '1031': {
        season_id: 1031,
        season_name: 'Pilot Season',
        leagues: { '1': { league_name: 'Gold League' } },
      },
    } satisfies SeasonsInfoData

    expect(data['1031']!.leagues?.['1']!.league_name).toBe('Gold League')
  })

  it('stores season ship stats as an array per account', () => {
    const data = {
      '1000000001': [
        {
          account_id: 1000000001,
          ship_id: 3540000001,
          seasons: { '1031': { rank_solo: { battles: 2 } } },
        },
      ],
    } satisfies SeasonShipStatsData

    expect(data['1000000001']![0]!.ship_id).toBe(3540000001)
  })

  it('keys clans/season by season id', () => {
    const data = {
      '35': {
        season_id: 35,
        name: 'Hotspot',
        leagues: [{ name: 'Squall League', color: '#CC9966' }],
      },
    } satisfies ClanSeasonData

    expect(data['35']!.leagues?.[0]!.name).toBe('Squall League')
  })

  it('keys crew ranks by nation and stores an array per nation', () => {
    const data = {
      japan: [{ rank: 0, experience: 0, names: { en: 'Kaigun Shōi Kōhosei' } }],
    } satisfies CrewRanksData

    expect(data.japan).toHaveLength(1)
  })

  it('nests achievement definitions under the battle section', () => {
    const data = {
      battle: {
        PCH001_DoubleKill: {
          achievement_id: 'PCH001_DoubleKill',
          name: 'Double Strike',
          battle_types: ['PVP', 'RANKED'],
        },
      },
    } satisfies EncyclopediaAchievementsData

    expect(data.battle?.PCH001_DoubleKill?.name).toBe('Double Strike')
  })

  it('models the Vortex ship response as account → statistics → ship → mode', () => {
    const data = {
      '1000000001': {
        name: 'TestCaptain',
        statistics: {
          '3540000001': {
            mastery_sign: 'No_Sign',
            pvp_solo: { battles_count: 26, wins: 18, survived: 16 },
          },
        },
      },
    } satisfies VortexShipStatsData

    const stats = data['1000000001']!.statistics?.['3540000001'] as
      | { pvp_solo?: { battles_count?: number } }
      | undefined
    expect(stats?.pvp_solo?.battles_count).toBe(26)
  })

  it('models Vortex achievements by achievement id', () => {
    const data = {
      '1000000001': {
        name: 'TestCaptain',
        created_at: 1700000000,
        statistics: {
          achievements: {
            '3000000001': { count: 1, last_time: 1700000001, ship_id: 0 },
          },
        },
      },
    } satisfies VortexAchievementsData

    expect(data['1000000001']!.statistics?.achievements?.['3000000001']!.count).toBe(1)
  })

  it('models the clan service envelopes', () => {
    const info = {
      _meta_: { model: 'clanview' },
      clanview: {
        clan: { id: 1000000003, tag: 'TEST', name: 'Test Clan' },
        wows_ladder: { realm: 'sg', league: 3, division: 3, public_rating: 1200 },
        buildings: { headquarters: {} },
      },
    } satisfies ClanbaseInfoData

    const members = {
      status: 'ok',
      clan_statistics: { battles_count: 1200, wins_percentage: 55.5 },
      items: [{ id: 1000000002, name: '122mm', role: { name: 'recruitment_officer' } }],
    } satisfies ClanMembersData

    expect(info.clanview.wows_ladder?.public_rating).toBe(1200)
    expect(members.items[0]!.role?.name).toBe('recruitment_officer')
  })
})
