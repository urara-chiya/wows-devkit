import type { WowsApiClient } from '../client.js'
import type { ApiResponseOk, CommonParams, IdList } from '../types/common.js'
import type {
  ClanAccountInfoData,
  ClanInfoData,
  ClanListData,
  ClanSeasonData,
  ClanSeasonStatsData,
  ClansGlossaryData,
} from '../types/api.js'

export interface ClanListParams extends Omit<CommonParams, 'extra'> {
  search?: string
  limit?: number
  page_no?: number
}

export type ClanInfoExtra = 'members'

export interface ClanInfoParams extends Omit<CommonParams, 'extra'> {
  clan_id: IdList
  extra?: ClanInfoExtra | readonly ClanInfoExtra[]
}

export interface ClanAccountInfoParams extends CommonParams {
  account_id: IdList
}

export interface ClansGlossaryParams extends Omit<CommonParams, 'extra'> {}

export interface ClanSeasonParams extends Omit<CommonParams, 'extra'> {}

export interface ClanSeasonStatsParams extends Omit<CommonParams, 'extra'> {
  account_id: IdList
  access_token?: string
}

export class ClansApi {
  constructor(private readonly client: WowsApiClient) {}

  list(params: ClanListParams = {}): Promise<ApiResponseOk<ClanListData>> {
    return this.client.request<ClanListData>('clans/list', params)
  }

  info(params: ClanInfoParams): Promise<ApiResponseOk<ClanInfoData>> {
    return this.client.request<ClanInfoData>('clans/info', params)
  }

  accountInfo(params: ClanAccountInfoParams): Promise<ApiResponseOk<ClanAccountInfoData>> {
    return this.client.request<ClanAccountInfoData>('clans/accountinfo', params)
  }

  glossary(params: ClansGlossaryParams = {}): Promise<ApiResponseOk<ClansGlossaryData>> {
    return this.client.request<ClansGlossaryData>('clans/glossary', params)
  }

  season(params: ClanSeasonParams = {}): Promise<ApiResponseOk<ClanSeasonData>> {
    return this.client.request<ClanSeasonData>('clans/season', params)
  }

  seasonStats(params: ClanSeasonStatsParams): Promise<ApiResponseOk<ClanSeasonStatsData>> {
    return this.client.request<ClanSeasonStatsData>('clans/seasonstats', params)
  }
}
