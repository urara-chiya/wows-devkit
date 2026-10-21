import { HttpClient, appendQuery, redactUrl } from '../core/http.js'
import { REALM_ENDPOINTS, type WowsRealm } from '../core/realms.js'
import { WowsHttpError } from '../core/errors.js'
import type {
  ClanLadderData,
  ClanLadderParams,
  ClanMembersData,
  ClanSearchData,
  ClanbaseInfoData,
} from './types.js'

export interface ClansClientOptions {
  /** Defaults to `eu`. Determines the host and the default ladder realm. */
  realm?: WowsRealm
  /** Clan service origin. Defaults to the realm host. */
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  /** Request timeout in milliseconds. */
  timeout?: number
}

export interface ClansRequestOptions {
  signal?: AbortSignal
}

export class ClansClient extends HttpClient {
  readonly realm: WowsRealm
  readonly ladderRealm: string

  private readonly baseUrl: string

  constructor(options: ClansClientOptions = {}) {
    super(options)
    this.realm = options.realm ?? 'eu'
    this.ladderRealm = REALM_ENDPOINTS[this.realm].clanRealm
    this.baseUrl = (options.baseUrl ?? REALM_ENDPOINTS[this.realm].clans).replace(/\/+$/, '')
  }

  /** `/api/clanbase/{id}/claninfo/` */
  info(clanId: number, options: ClansRequestOptions = {}): Promise<ClanbaseInfoData | null> {
    return this.request(`/api/clanbase/${encodeURIComponent(clanId)}/claninfo/`, {}, options)
  }

  /** `/api/members/{id}/` */
  members(clanId: number, options: ClansRequestOptions = {}): Promise<ClanMembersData | null> {
    return this.request(`/api/members/${encodeURIComponent(clanId)}/`, {}, options)
  }

  /** `/api/search/autocomplete/?search={tag}&type=clans` */
  search(tag: string, options: ClansRequestOptions = {}): Promise<ClanSearchData | null> {
    return this.request(
      '/api/search/autocomplete/',
      { search: tag, type: 'clans' },
      options,
    )
  }

  /** `/api/ladder/structure/` — a bare array, not an envelope. */
  ladder(params: ClanLadderParams, options: ClansRequestOptions = {}): Promise<ClanLadderData | null> {
    return this.request(
      '/api/ladder/structure/',
      {
        realm: params.realm ?? this.ladderRealm,
        league: params.league,
        division: params.division,
        limit: params.limit ?? 1000,
      },
      options,
    )
  }

  private async request<T>(
    path: string,
    params: Record<string, unknown>,
    options: ClansRequestOptions,
  ): Promise<T | null> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(params)) {
      appendQuery(url, key, value)
    }
    const requestUrl = redactUrl(url)

    try {
      const { payload } = await this.fetchJson(url, requestUrl, options.signal)
      return payload as T
    } catch (error) {
      if (error instanceof WowsHttpError && error.status === 404) return null
      throw error
    }
  }
}
