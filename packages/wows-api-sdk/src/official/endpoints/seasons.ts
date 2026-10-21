import type { WowsApiClient } from '../client.js'
import type { ApiResponseOk, CommonParams, IdList } from '../types/common.js'
import type {
  SeasonAccountInfoData,
  SeasonShipStatsData,
  SeasonsInfoData,
} from '../types/api.js'

export interface SeasonsInfoParams extends Omit<CommonParams, 'extra'> {
  season_id?: IdList
}

export interface SeasonAccountInfoParams extends Omit<CommonParams, 'extra'> {
  account_id: IdList
  access_token?: string
  season_id?: IdList
}

export interface SeasonShipStatsParams extends Omit<CommonParams, 'extra'> {
  account_id: IdList
  access_token?: string
  season_id?: IdList
  ship_id?: IdList
}

export class SeasonsApi {
  constructor(private readonly client: WowsApiClient) {}

  info(params: SeasonsInfoParams = {}): Promise<ApiResponseOk<SeasonsInfoData>> {
    return this.client.request<SeasonsInfoData>('seasons/info', params)
  }

  accountInfo(
    params: SeasonAccountInfoParams,
  ): Promise<ApiResponseOk<SeasonAccountInfoData>> {
    return this.client.request<SeasonAccountInfoData>('seasons/accountinfo', params)
  }

  shipStats(params: SeasonShipStatsParams): Promise<ApiResponseOk<SeasonShipStatsData>> {
    return this.client.request<SeasonShipStatsData>('seasons/shipstats', params)
  }
}
