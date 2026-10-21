import type { WowsApiClient } from '../client.js'
import type { ApiResponseOk, CommonParams, IdList } from '../types/common.js'
import type {
  AccountLevelsData,
  BattleArenasData,
  BattleTypesData,
  CollectionCardsData,
  CollectionsData,
  ConsumablesData,
  CrewRanksData,
  CrewSkillsData,
  CrewsData,
  EncyclopediaAchievementsData,
  EncyclopediaInfoData,
  EncyclopediaShipsData,
  ModulesData,
  ShipProfileData,
} from '../types/api.js'

export interface EncyclopediaShipsParams extends Omit<CommonParams, 'extra'> {
  ship_id?: IdList
  nation?: string
  type?: string
  page_no?: number
  limit?: number
}

export interface ShipProfileParams extends Omit<CommonParams, 'extra'> {
  ship_id: IdList
  artillery_id?: number
  dive_bomber_id?: number
  engine_id?: number
  fighter_id?: number
  fire_control_id?: number
  flight_control_id?: number
  hull_id?: number
  submarine_sonar_id?: number
  torpedo_bomber_id?: number
  torpedoes_id?: number
}

export interface EncyclopediaModulesParams extends Omit<CommonParams, 'extra'> {
  module_id?: IdList
  type?: string
  page_no?: number
  limit?: number
}

export interface EncyclopediaConsumablesParams extends Omit<CommonParams, 'extra'> {
  consumable_id?: IdList
  type?: string
  page_no?: number
  limit?: number
}

export interface CrewsParams extends Omit<CommonParams, 'extra'> {
  commander_id?: IdList
}

export interface CrewSkillsParams extends Omit<CommonParams, 'extra'> {
  skill_id?: IdList
}

export interface CrewRanksParams extends Omit<CommonParams, 'extra'> {
  nation?: string
}

export interface EncyclopediaListParams extends Omit<CommonParams, 'extra'> {}

export interface AccountLevelsParams {
  fields?: string | readonly string[]
}

export class EncyclopediaApi {
  constructor(private readonly client: WowsApiClient) {}

  ships(params: EncyclopediaShipsParams = {}): Promise<ApiResponseOk<EncyclopediaShipsData>> {
    return this.client.request<EncyclopediaShipsData>('encyclopedia/ships', params)
  }

  shipProfile(params: ShipProfileParams): Promise<ApiResponseOk<ShipProfileData>> {
    return this.client.request<ShipProfileData>('encyclopedia/shipprofile', params)
  }

  modules(params: EncyclopediaModulesParams = {}): Promise<ApiResponseOk<ModulesData>> {
    return this.client.request<ModulesData>('encyclopedia/modules', params)
  }

  consumables(
    params: EncyclopediaConsumablesParams = {},
  ): Promise<ApiResponseOk<ConsumablesData>> {
    return this.client.request<ConsumablesData>('encyclopedia/consumables', params)
  }

  crews(params: CrewsParams = {}): Promise<ApiResponseOk<CrewsData>> {
    return this.client.request<CrewsData>('encyclopedia/crews', params)
  }

  crewSkills(params: CrewSkillsParams = {}): Promise<ApiResponseOk<CrewSkillsData>> {
    return this.client.request<CrewSkillsData>('encyclopedia/crewskills', params)
  }

  crewRanks(params: CrewRanksParams = {}): Promise<ApiResponseOk<CrewRanksData>> {
    return this.client.request<CrewRanksData>('encyclopedia/crewranks', params)
  }

  achievements(
    params: EncyclopediaListParams = {},
  ): Promise<ApiResponseOk<EncyclopediaAchievementsData>> {
    return this.client.request<EncyclopediaAchievementsData>('encyclopedia/achievements', params)
  }

  battleArenas(params: EncyclopediaListParams = {}): Promise<ApiResponseOk<BattleArenasData>> {
    return this.client.request<BattleArenasData>('encyclopedia/battlearenas', params)
  }

  battleTypes(params: EncyclopediaListParams = {}): Promise<ApiResponseOk<BattleTypesData>> {
    return this.client.request<BattleTypesData>('encyclopedia/battletypes', params)
  }

  collections(params: EncyclopediaListParams = {}): Promise<ApiResponseOk<CollectionsData>> {
    return this.client.request<CollectionsData>('encyclopedia/collections', params)
  }

  collectionCards(
    params: EncyclopediaListParams = {},
  ): Promise<ApiResponseOk<CollectionCardsData>> {
    return this.client.request<CollectionCardsData>('encyclopedia/collectioncards', params)
  }

  accountLevels(params: AccountLevelsParams = {}): Promise<ApiResponseOk<AccountLevelsData>> {
    return this.client.request<AccountLevelsData>('encyclopedia/accountlevels', params)
  }

  info(params: EncyclopediaListParams = {}): Promise<ApiResponseOk<EncyclopediaInfoData>> {
    return this.client.request<EncyclopediaInfoData>('encyclopedia/info', params)
  }
}
