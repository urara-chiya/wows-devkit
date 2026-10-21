import type {
  AccountAchievements,
  AccountInfo,
  AccountListEntry,
} from './generated/account.generated.js'
import type {
  ClanAccountInfo,
  ClanInfo,
  ClanListEntry,
  ClanSeason,
  ClanSeasonStats,
  ClansGlossary,
} from './generated/clans.generated.js'
import type {
  AccountLevel,
  BattleArena,
  BattleType,
  Collection,
  CollectionCard,
  Consumable,
  CrewRank,
  CrewSkill,
  EncyclopediaAchievement,
  EncyclopediaInfo,
  EncyclopediaShip,
  Module,
  ShipProfile,
} from './generated/encyclopedia.generated.js'
import type {
  RankedSeason,
  SeasonAccountInfo,
  SeasonShipStats,
} from './generated/seasons.generated.js'
import type { ShipBadge, ShipStats } from './generated/ships.generated.js'

export type * from './generated/account.generated.js'
export type * from './generated/clans.generated.js'
export type * from './generated/encyclopedia.generated.js'
export type * from './generated/seasons.generated.js'
export type * from './generated/ships.generated.js'

/** Response data keyed by account ID. */
export type AccountInfoData = Record<string, AccountInfo>
export type AccountListData = AccountListEntry[]
/** Response data keyed by account ID. */
export type AccountAchievementsData = Record<string, AccountAchievements>

/** Response data keyed by clan ID. */
export type ClanInfoData = Record<string, ClanInfo>
export type ClanListData = ClanListEntry[]
/** Response data keyed by account ID. */
export type ClanAccountInfoData = Record<string, ClanAccountInfo>
export type ClansGlossaryData = ClansGlossary
export type ClanSeasonData = Record<string, ClanSeason>
/** Response data keyed by account ID. */
export type ClanSeasonStatsData = Record<string, ClanSeasonStats>

/** Response data keyed by ship ID. */
export type EncyclopediaShipsData = Record<string, EncyclopediaShip>
export type ShipProfileData = Record<string, ShipProfile>
export type ModulesData = Record<string, Module>
export type ConsumablesData = Record<string, Consumable>
/** A commander definition returned by `encyclopedia/crews`. */
export interface Crew {
  base_training_hire_price?: number
  base_training_level?: number
  first_names?: string[]
  gold_retraining_price?: number
  gold_training_hire_price?: number
  gold_training_level?: number
  icons?: Array<Record<string, string>>
  is_retrainable?: boolean
  last_names?: string[]
  money_retraining_price?: number | null
  money_training_hire_price?: number
  money_training_level?: number
  nation?: string
  subnation_index?: number
}

/** Response data keyed by commander ID. */
export type CrewsData = Record<string, Crew>
export type CrewSkillsData = Record<string, CrewSkill>
/** Response data keyed by nation, each holding that nation's rank ladder. */
export type CrewRanksData = Record<string, CrewRank[]>
/** Achievement definitions keyed by achievement ID under the `battle` section. */
export type EncyclopediaAchievementsData = EncyclopediaAchievement
export type BattleArenasData = Record<string, BattleArena>
export type BattleTypesData = Record<string, BattleType>
export type CollectionsData = Record<string, Collection>
export type CollectionCardsData = Record<string, CollectionCard>
/** Response data keyed by Service Record level. */
export type AccountLevelsData = Record<string, AccountLevel>
export type EncyclopediaInfoData = EncyclopediaInfo

/** Response data keyed by season ID. */
export type SeasonsInfoData = Record<string, RankedSeason>
/** Response data keyed by account ID. */
export type SeasonAccountInfoData = Record<string, SeasonAccountInfo>
/** Response data keyed by account ID, each holding one entry per ship. */
export type SeasonShipStatsData = Record<string, SeasonShipStats[]>

/** Response data keyed by account ID, each holding one entry per ship. */
export type ShipStatsData = Record<string, ShipStats[]>
/** Response data is a list of ship badges. */
export type ShipBadgesData = ShipBadge[]
