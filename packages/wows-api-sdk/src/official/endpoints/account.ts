import type { WowsApiClient } from '../client.js'
import type { ApiResponseOk } from '../types/common.js'
import type { AccountAchievementsData, AccountInfoData, AccountListData } from '../types/api.js'
import type { CommonParams, IdList } from '../types/common.js'

export interface AccountListParams extends Omit<CommonParams, 'extra'> {
  search: string
  type?: 'startswith' | 'exact'
  limit?: number
}

export type AccountExtra =
  | 'private.grouped_contacts'
  | 'private.port'
  | 'statistics.clan'
  | 'statistics.club'
  | 'statistics.oper_div'
  | 'statistics.oper_div_hard'
  | 'statistics.oper_solo'
  | 'statistics.pve'
  | 'statistics.pve_div2'
  | 'statistics.pve_div3'
  | 'statistics.pve_solo'
  | 'statistics.pvp_div2'
  | 'statistics.pvp_div3'
  | 'statistics.pvp_solo'
  | 'statistics.rank_div2'
  | 'statistics.rank_div3'
  | 'statistics.rank_solo'

export interface AccountInfoParams extends Omit<CommonParams, 'extra'> {
  account_id: IdList
  access_token?: string
  extra?: AccountExtra | readonly AccountExtra[]
}

export interface AccountAchievementsParams extends Omit<CommonParams, 'extra'> {
  account_id: IdList
  access_token?: string
}

export class AccountApi {
  constructor(private readonly client: WowsApiClient) {}

  list(params: AccountListParams): Promise<ApiResponseOk<AccountListData>> {
    return this.client.request<AccountListData>('account/list', params)
  }

  info(params: AccountInfoParams): Promise<ApiResponseOk<AccountInfoData>> {
    return this.client.request<AccountInfoData>('account/info', params)
  }

  achievements(
    params: AccountAchievementsParams,
  ): Promise<ApiResponseOk<AccountAchievementsData>> {
    return this.client.request<AccountAchievementsData>('account/achievements', params)
  }
}
