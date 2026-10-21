import { HttpClient, redactUrl } from '../core/http.js'
import { REALM_ENDPOINTS, type WowsRealm } from '../core/realms.js'
import { WowsHttpError, WowsParseError } from '../core/errors.js'
import type {
  VortexAccountClanData,
  VortexAccountSearchData,
  VortexAccountsInfoData,
  VortexAchievementsData,
  VortexShipMode,
  VortexShipStatsData,
} from './types.js'

export interface VortexClientOptions {
  /** Defaults to `eu`. */
  realm?: WowsRealm
  /** Vortex origin. Defaults to the realm host. */
  baseUrl?: string
  /** Optional WG access token, sent as `?ac=` on account and ship requests. */
  accessToken?: string
  fetch?: typeof globalThis.fetch
  /** Request timeout in milliseconds. */
  timeout?: number
}

export interface VortexRequestOptions {
  signal?: AbortSignal
  /** Per-request override. `null` omits the token. */
  accessToken?: string | null
}

/** Raised when Vortex answers 200 with a `status` other than `ok`. */
export class VortexError extends Error {
  readonly status: string
  readonly url: string
  readonly body: unknown

  constructor(status: string, url: string, body: unknown) {
    super(`Vortex request failed with status "${status}"`)
    this.name = 'VortexError'
    this.status = status
    this.url = url
    this.body = body
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOkEnvelope(value: unknown): value is { status: 'ok'; data: unknown } {
  return isRecord(value) && value.status === 'ok' && 'data' in value
}

export class VortexAccountsApi {
  constructor(private readonly client: VortexClient) {}

  /** `/api/accounts/{id}/` — account profile plus per-mode totals. */
  info(
    accountId: number,
    options: VortexRequestOptions = {},
  ): Promise<VortexAccountsInfoData | null> {
    return this.client.request('accounts', [accountId], options)
  }

  /** `/api/accounts/{id}/clans/` — the player's current clan. */
  clan(accountId: number, options: VortexRequestOptions = {}): Promise<VortexAccountClanData | null> {
    return this.client.request('accounts', [accountId, 'clans'], options)
  }

  /** `/api/accounts/{id}/achievements/` — achievement progress by achievement id. */
  achievements(
    accountId: number,
    options: VortexRequestOptions = {},
  ): Promise<VortexAchievementsData | null> {
    return this.client.request('accounts', [accountId, 'achievements'], options)
  }

  /** `/api/accounts/search/{nickname}/` */
  search(
    nickname: string,
    options: VortexRequestOptions = {},
  ): Promise<VortexAccountSearchData | null> {
    return this.client.request('accounts', ['search', nickname], options)
  }
}

export class VortexShipsApi {
  constructor(private readonly client: VortexClient) {}

  /** `/api/accounts/{id}/ships/` — every ship and every mode in one response. */
  all(accountId: number, options: VortexRequestOptions = {}) {
    return this.client.request<VortexShipStatsData>('accounts', [accountId, 'ships'], options)
  }

  /** `/api/accounts/{id}/ships/{mode}/` — per-ship totals for one mode. */
  stats(
    accountId: number,
    mode: VortexShipMode,
    options: VortexRequestOptions = {},
  ): Promise<VortexShipStatsData | null> {
    return this.client.request('accounts', [accountId, 'ships', mode], options)
  }

  pve(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'pve', options)
  }

  pvp(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'pvp', options)
  }

  pvpSolo(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'pvp_solo', options)
  }

  pvpDiv2(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'pvp_div2', options)
  }

  pvpDiv3(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'pvp_div3', options)
  }

  rankSolo(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'rank_solo', options)
  }

  ratingSolo(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'rating_solo', options)
  }

  ratingDiv(accountId: number, options: VortexRequestOptions = {}) {
    return this.stats(accountId, 'rating_div', options)
  }
}

export class VortexClient extends HttpClient {
  readonly realm: WowsRealm
  readonly accessToken?: string
  readonly accounts: VortexAccountsApi
  readonly ships: VortexShipsApi

  private readonly baseUrl: string

  constructor(options: VortexClientOptions = {}) {
    super(options)
    this.realm = options.realm ?? 'eu'
    this.accessToken = options.accessToken
    this.baseUrl = (options.baseUrl ?? REALM_ENDPOINTS[this.realm].vortex).replace(/\/+$/, '')
    this.accounts = new VortexAccountsApi(this)
    this.ships = new VortexShipsApi(this)
  }

  /**
   * Sends a Vortex request and unwraps `{ status: "ok", data }`.
   *
   * Returns `null` for 404, which Vortex uses for "account does not exist"
   * rather than as a transport error.
   */
  async request<T>(
    resource: string,
    segments: Array<string | number>,
    options: VortexRequestOptions = {},
  ): Promise<T | null> {
    const path = segments.map((segment) => encodeURIComponent(String(segment))).join('/')
    const url = new URL(`${this.baseUrl}/api/${resource}/${path}/`)
    const requestUrl = redactUrl(url)

    const token = options.accessToken === undefined ? this.accessToken : options.accessToken
    if (token) url.searchParams.set('ac', token)

    let payload: unknown
    try {
      ;({ payload } = await this.fetchJson(url, requestUrl, options.signal))
    } catch (error) {
      if (error instanceof WowsHttpError && error.status === 404) return null
      throw error
    }

    if (isOkEnvelope(payload)) return payload.data as T
    if (isRecord(payload) && typeof payload.status === 'string') {
      throw new VortexError(payload.status, requestUrl, payload)
    }
    throw new WowsParseError(requestUrl, 200)
  }
}

export type { VortexAccountsInfoData, VortexAccountSearchData, VortexShipStatsData }
