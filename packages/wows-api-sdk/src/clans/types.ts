/** `/api/clanbase/{id}/claninfo/` — the service wraps the payload in `_meta_` + `clanview`. */
export interface ClanbaseInfoData {
  _meta_?: {
    model?: string
    [key: string]: unknown
  }
  clanview: ClanbaseView
  [key: string]: unknown
}

export interface ClanbaseView {
  clan: ClanbaseClan
  /** Only present when the clan exists and has achievements. */
  achievements?: ClanbaseAchievement[] | null
  wows_ladder?: ClanbaseLadder
  /** Stronghold buildings keyed by type. */
  buildings?: Record<string, ClanbaseBuilding>
  [key: string]: unknown
}

export interface ClanbaseClan {
  /** The service uses `id`, not `clan_id`. */
  id?: number
  clan_id?: number
  tag: string
  name: string
  /** Hex colour string such as `#cce4e4`. */
  color?: string
  /** ISO-8601 timestamp with microseconds. */
  created_at?: string
  creator_id?: number
  members_count?: number | null
  max_members_count?: number
  leveling?: number | null
  description?: string
  raw_description?: string
  motto?: string
  is_disbanded?: boolean
  is_suited_for_autorecruiting?: boolean
  recruiting_policy?: string
  community_urls?: Record<string, unknown>
  stats?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface ClanbaseAchievement {
  /** Achievement definition id. */
  cd?: number
  count?: number
  [key: string]: unknown
}

export interface ClanbaseBuilding {
  [key: string]: unknown
}

export interface ClanbaseLadder {
  id?: number
  realm?: string
  rating_realm?: string | null
  season_number?: number
  status?: string
  league?: number
  division?: number
  team_number?: number
  leading_team_number?: number
  battles_count?: number
  wins_count?: number
  total_battles_count?: number
  public_rating?: number
  initial_public_rating?: number
  max_public_rating?: number
  max_position?: Record<string, unknown> | null
  division_rating?: number
  division_rating_max?: number
  longest_winning_streak?: number
  current_winning_streak?: number
  members_count?: number | null
  is_best_season_rating?: boolean
  is_banned?: boolean
  is_disbanded?: boolean
  is_qualified?: boolean
  prime_time?: unknown
  planned_prime_time?: number | null
  /** ISO-8601 timestamp with offset. */
  last_battle_at?: string | null
  /** ISO-8601 timestamp with offset. */
  last_win_at?: string | null
  /** Season history, newest first. */
  ratings?: ClanbaseTeamRating[]
  [key: string]: unknown
}

export interface ClanbaseTeamRating {
  team_number?: number
  season_number?: number
  battles_count?: number
  wins_count?: number
  public_rating?: number
  league?: number
  division?: number
  division_rating?: number
  stage?: number
  [key: string]: unknown
}

/** `/api/members/{id}/` */
export interface ClanMembersData {
  status?: string
  clan_statistics?: ClanStatisticsSummary
  items: ClanMember[]
  /** ISO-8601 timestamp with microseconds. */
  last_updated_at?: string
  is_hidden_statistics?: boolean
  [key: string]: unknown
}

export interface ClanStatisticsSummary {
  battles_count?: number
  wins_percentage?: number
  exp_per_battle?: number
  damage_per_battle?: number
  [key: string]: unknown
}

export interface ClanMember {
  id: number
  name: string
  battles_count?: number
  wins_percentage?: number
  exp_per_battle?: number
  damage_per_battle?: number
  frags_per_battle?: number
  battles_per_day?: number
  days_in_clan?: number
  /** Unix timestamp in seconds. */
  last_battle_time?: number
  season_id?: number
  season_rank?: number | null
  rank?: number
  role?: ClanMemberRole
  leveling?: number | null
  is_hidden_statistics?: boolean
  is_banned?: boolean
  is_bonus_activated?: boolean | null
  is_press?: boolean
  abnormal_results?: boolean
  online_status?: unknown
  profile_link?: string
  [key: string]: unknown
}

export interface ClanMemberRole {
  name?: string
  rank?: number
  order?: number
  [key: string]: unknown
}

/** `/api/search/autocomplete/?search=...&type=clans` */
export interface ClanSearchData {
  _meta_?: {
    collection?: string
    total_clans?: number
    [key: string]: unknown
  }
  search_autocomplete_result: ClanSearchEntry[]
  [key: string]: unknown
}

export interface ClanSearchEntry {
  id: number
  tag: string
  name?: string
  hex_color?: string
  [key: string]: unknown
}

/** Bare array returned by `/api/ladder/structure/`. */
export type ClanLadderData = ClanLadderEntry[]

export interface ClanLadderEntry {
  id?: number
  name?: string
  tag?: string
  realm?: string
  rating_realm?: string
  season_number?: number
  league?: number
  division?: number
  division_rating?: number
  public_rating?: number
  rank?: number
  battles_count?: number
  wins_count?: number
  members_count?: number
  leading_team_number?: number
  disbanded?: boolean
  /** Hex colour string. */
  color?: string
  /** Hex colour string; usually identical to `color`. */
  hex_color?: string
  /** ISO-8601 timestamp with offset. */
  last_battle_at?: string
  /** ISO-8601 timestamp with offset. */
  last_win_at?: string
  [key: string]: unknown
}

/** Realm names used by the clan ladder endpoint. */
export type ClanLadderRealm = 'eu' | 'us' | 'sg' | 'ru' | 'cn360'

export interface ClanLadderParams {
  league?: number | string
  division?: number | string
  limit?: number
  realm?: ClanLadderRealm
}
