import type { WowsApiClient } from '../client.js'
import type { ApiResponseOk, CommonParams, IdList } from '../types/common.js'
import type { ShipBadgesData, ShipStatsData } from '../types/api.js'

export type ShipStatsExtra =
  | 'clan'
  | 'club'
  | 'oper_div'
  | 'oper_div_hard'
  | 'oper_solo'
  | 'pve'
  | 'pve_div2'
  | 'pve_div3'
  | 'pve_solo'
  | 'pvp_div2'
  | 'pvp_div3'
  | 'pvp_solo'
  | 'rank_div2'
  | 'rank_div3'
  | 'rank_solo'

export interface ShipStatsParams extends Omit<CommonParams, 'extra'> {
  account_id: IdList
  access_token?: string
  /** The API only accepts `1` or `0`; booleans are converted automatically. */
  in_garage?: boolean | 0 | 1
  ship_id?: IdList
  extra?: ShipStatsExtra | readonly ShipStatsExtra[]
}

export interface ShipBadgesParams extends Omit<CommonParams, 'extra'> {
  account_id: IdList
  ship_id?: IdList
}

export class ShipsApi {
  constructor(private readonly client: WowsApiClient) {}

  stats(params: ShipStatsParams): Promise<ApiResponseOk<ShipStatsData>> {
    const { in_garage, ...rest } = params
    return this.client.request<ShipStatsData>('ships/stats', {
      ...rest,
      ...(in_garage === undefined ? {} : { in_garage: in_garage ? 1 : 0 }),
    })
  }

  badges(params: ShipBadgesParams): Promise<ApiResponseOk<ShipBadgesData>> {
    return this.client.request<ShipBadgesData>('ships/badges', params)
  }
}
