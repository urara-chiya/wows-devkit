/** Account id → account. Vortex keys every top-level account map by id as a string. */
export type VortexAccountsInfoData = Record<string, VortexAccount>

export interface VortexAccount {
  name: string
  /** Unix timestamp in seconds. */
  created_at: number
  /** Unix timestamp in seconds. Usually equal to `created_at`. */
  activated_at?: number
  /** `false` for a public profile; hidden profiles may omit `statistics`. */
  visibility_settings?: boolean
  dog_tag?: VortexDogTag
  /** Present when the player hides their profile. */
  hidden_profile?: true
  statistics?: VortexAccountStatistics
  [key: string]: unknown
}

export interface VortexDogTag {
  texture_id?: number
  symbol_id?: number
  border_color_id?: number
  background_color_id?: number
  background_id?: number
  [key: string]: unknown
}

export interface VortexAccountStatistics {
  basic?: VortexBasicStats
  pve?: VortexModeStats
  pvp?: VortexModeStats
  pvp_solo?: VortexModeStats
  pvp_div2?: VortexModeStats
  pvp_div3?: VortexModeStats
  rank_solo?: VortexModeStats
  rank_div2?: VortexModeStats
  rank_div3?: VortexModeStats
  rank_old_solo?: VortexModeStats
  rank_old_div2?: VortexModeStats
  rank_old_div3?: VortexModeStats
  /** RU only. */
  rating_solo?: VortexModeStats
  /** RU only. */
  rating_div?: VortexModeStats
  /** Ranked progress keyed by season id. */
  rank_info?: Record<string, unknown>
  /** Season totals keyed by season id. */
  seasons?: Record<string, VortexModeStats>
  mastery_sign?: string | null
  mark_of_excellence?: VortexMarkOfExcellence
  [key: string]: unknown
}

export interface VortexMarkOfExcellence {
  personal?: Record<string, unknown>
  division?: Record<string, unknown>
  [key: string]: unknown
}

export interface VortexBasicStats {
  /** Unix timestamp in seconds. */
  created_at?: number
  karma?: number
  last_battle_time?: number
  leveling_points?: number
  leveling_tier?: number
  [key: string]: unknown
}

/** Cumulative statistics for one battle mode. */
export interface VortexModeStats {
  battles_count?: number
  wins?: number
  losses?: number
  draws?: number
  damage_dealt?: number
  frags?: number
  /** Base experience before bonuses. */
  exp?: number
  /** Experience including bonuses. */
  original_exp?: number
  premium_exp?: number
  max_exp?: number
  max_premium_exp?: number
  max_frags?: number
  max_damage_dealt?: number
  max_planes_killed?: number
  max_scouting_damage?: number
  max_total_agro?: number
  max_ships_spotted?: number
  survived?: number
  win_and_survived?: number
  planes_killed?: number
  ships_spotted?: number
  scouting_damage?: number
  art_agro?: number
  tpd_agro?: number
  capture_points?: number
  dropped_capture_points?: number
  control_captured_points?: number
  control_dropped_points?: number
  team_control_captured_points?: number
  team_control_dropped_points?: number
  frags_by_main?: number
  frags_by_tpd?: number
  frags_by_planes?: number
  frags_by_atba?: number
  frags_by_ram?: number
  frags_by_dbomb?: number
  hits_by_main?: number
  shots_by_main?: number
  hits_by_tpd?: number
  shots_by_tpd?: number
  hits_by_atba?: number
  shots_by_atba?: number
  hits_by_bomb?: number
  shots_by_bomb?: number
  hits_by_tbomb?: number
  shots_by_tbomb?: number
  hits_by_rocket?: number
  shots_by_rocket?: number
  hits_by_skip?: number
  shots_by_skip?: number
  [key: string]: unknown
}

/** `/api/accounts/{id}/clans/` — the player's current clan, or no clan. */
export interface VortexAccountClanData {
  clan_id: number | null
  /** ISO-8601 timestamp with fractional seconds. */
  joined_at?: string
  role?: string
  clan?: {
    tag?: string
    name?: string
    color?: number
    members_count?: number
    max_members_count?: number
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type VortexAccountSearchData = VortexAccountSearchEntry[]

export interface VortexAccountSearchEntry {
  spa_id: number
  name: string
  hidden?: boolean
  statistics?: Record<string, VortexModeStats>
  [key: string]: unknown
}

/** `/api/accounts/{id}/achievements/` — account id → achievement progress. */
export type VortexAchievementsData = Record<string, VortexAccountAchievements>

export interface VortexAccountAchievements {
  name: string
  created_at: number
  activated_at?: number
  statistics?: {
    achievements?: Record<string, VortexAchievement>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface VortexAchievement {
  count: number
  counter_a?: number
  /** Unix timestamp in seconds of the last time this was earned. */
  last_time?: number
  /** Ship that earned it; `0` when it is not ship-specific. */
  ship_id?: number
  [key: string]: unknown
}

/** Path segment accepted by `/api/accounts/{id}/ships/{mode}/`. */
export type VortexShipMode =
  | 'pve'
  | 'pvp'
  | 'pvp_solo'
  | 'pvp_div2'
  | 'pvp_div3'
  | 'rank_solo'
  | 'rank_div2'
  | 'rank_div3'
  | 'rank_old_solo'
  | 'rank_old_div2'
  | 'rank_old_div3'
  | 'clan'
  | 'club'
  | 'rating_solo'
  | 'rating_div'

/** `data[accountId]` for every `/ships/` response. */
export type VortexShipStatsData = Record<string, VortexShipStatistics>

export interface VortexShipStatistics {
  name?: string
  created_at?: number
  activated_at?: number
  visibility_settings?: boolean
  /** Ship id → per-mode totals. */
  statistics?: Record<string, VortexShipStatsEntry>
  [key: string]: unknown
}

export interface VortexShipStatsEntry {
  mastery_sign?: string | null
  mark_of_excellence?: VortexMarkOfExcellence
  pvp?: VortexShipStats
  pvp_solo?: VortexShipStats
  pvp_div2?: VortexShipStats
  pvp_div3?: VortexShipStats
  pve?: VortexShipStats
  rank_solo?: VortexShipStats
  rank_div2?: VortexShipStats
  rank_div3?: VortexShipStats
  rank_old_solo?: VortexShipStats
  rank_old_div2?: VortexShipStats
  rank_old_div3?: VortexShipStats
  clan?: VortexShipStats
  club?: VortexShipStats
  rating_solo?: VortexShipStats
  rating_div?: VortexShipStats
  seasons?: Record<string, unknown>
  [mode: string]: unknown
}

/** Cumulative statistics for one ship in one mode. */
export interface VortexShipStats {
  battles_count?: number
  battles_count_0711?: number
  battles_count_078?: number
  battles_count_0910?: number
  battles_count_510?: number
  battles_count_512?: number
  wins?: number
  losses?: number
  draws?: number
  damage_dealt?: number
  frags?: number
  survived?: number
  win_and_survived?: number
  /** Some older payloads expose scouting damage under this name. */
  assist_damage?: number
  scouting_damage?: number
  art_agro?: number
  tpd_agro?: number
  /** Base experience before bonuses. */
  exp?: number
  original_exp?: number
  premium_exp?: number
  planes_killed?: number
  hits_by_main?: number
  shots_by_main?: number
  hits_by_tpd?: number
  shots_by_tpd?: number
  hits_by_atba?: number
  shots_by_atba?: number
  hits_by_bomb?: number
  shots_by_bomb?: number
  hits_by_tbomb?: number
  shots_by_tbomb?: number
  hits_by_rocket?: number
  shots_by_rocket?: number
  hits_by_skip?: number
  shots_by_skip?: number
  capture_points?: number
  dropped_capture_points?: number
  control_captured_points?: number
  control_dropped_points?: number
  team_control_captured_points?: number
  team_control_dropped_points?: number
  max_damage_dealt?: number
  max_frags?: number
  max_exp?: number
  max_premium_exp?: number
  max_planes_killed?: number
  max_scouting_damage?: number
  max_total_agro?: number
  max_ships_spotted?: number
  [key: string]: unknown
}
