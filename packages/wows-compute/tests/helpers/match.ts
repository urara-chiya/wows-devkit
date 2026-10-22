import type {
  MatchGroup,
  MatchParticipant,
  MatchRecord,
  Outcome,
  Relation,
} from '../../src/match/index.js'
import { outcomeOf } from '../../src/match/index.js'

export interface ParticipantSpec {
  accountId: number | null
  name?: string | null
  teamId?: number | null
  shipId?: number | null
  damage?: number | null
  frags?: number | null
  relation?: Relation
  divisionId?: number | null
  isBot?: boolean
  noResult?: boolean
}

export interface RecordSpec {
  arenaId: string
  battleTime: number | null
  winnerTeamId: number | null
  participants: ParticipantSpec[]
  matchGroup?: MatchGroup
  outcome?: Outcome
  quality?: MatchRecord['quality']
}

export function makeParticipant(spec: ParticipantSpec): MatchParticipant {
  return {
    accountId: spec.accountId,
    name: spec.name ?? (spec.accountId === null ? null : `P${spec.accountId}`),
    clanId: null,
    clanTag: null,
    shipId: spec.shipId ?? null,
    teamId: spec.teamId ?? null,
    relation: spec.relation ?? 'unknown',
    isBot: spec.isBot ?? false,
    divisionId: spec.divisionId ?? null,
    result: spec.noResult === true
      ? null
      : {
        damage: spec.damage ?? 0,
        frags: spec.frags ?? 0,
        exp: 0,
        rawExp: 0,
        isAlive: true,
        lifeTimeSec: 600,
        scoutingDamage: 0,
        killerAccountId: null,
        interactions: {},
        fields: {},
      },
  }
}

export function makeRecord(spec: RecordSpec): MatchRecord {
  const participants = spec.participants.map(makeParticipant)
  const self = participants.find((participant) => participant.relation === 'self')

  return {
    arenaId: spec.arenaId,
    provisionalIds: [],
    battleTime: spec.battleTime,
    gameMode: 7,
    matchGroup: spec.matchGroup ?? 'pvp',
    mapId: 1,
    mapName: 'map',
    clientVersion: '15,9,0,1',
    durationSec: 600,
    winnerTeamId: spec.winnerTeamId,
    outcome: spec.outcome ?? outcomeOf(self?.teamId ?? null, spec.winnerTeamId),
    participants,
    quality: spec.quality ?? 'complete',
    ingestedAt: 0,
    parsedAt: 0,
    mappingVersion: '15.9',
    source: { kind: 'replay' },
  }
}
