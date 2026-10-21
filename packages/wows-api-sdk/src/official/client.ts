import { HttpClient, appendQuery, redactUrl } from '../core/http.js'
import { OFFICIAL_HOSTS, type OfficialRealm, type WowsRealm } from '../core/realms.js'
import { WowsApiError, WowsParseError } from '../core/errors.js'
import { AccountApi } from './endpoints/account.js'
import { ClansApi } from './endpoints/clans.js'
import { EncyclopediaApi } from './endpoints/encyclopedia.js'
import { SeasonsApi } from './endpoints/seasons.js'
import { ShipsApi } from './endpoints/ships.js'
import type {
  ApiResponseError,
  ApiResponseOk,
  LanguageCode,
  RequestOptions,
} from './types/common.js'

export interface WowsApiClientOptions {
  applicationId: string
  /** Defaults to `eu`. CN has no official API and is rejected. */
  realm?: WowsRealm
  /** Default language applied to every request. */
  language?: LanguageCode
  /** API origin or an origin ending in `/wows`. Defaults to the realm host. */
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  /** Request timeout in milliseconds. */
  timeout?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isApiErrorResponse(value: unknown): value is ApiResponseError {
  return (
    isRecord(value) &&
    value.status === 'error' &&
    isRecord(value.error) &&
    'code' in value.error &&
    typeof value.error.message === 'string'
  )
}

function isApiOkResponse(value: unknown): value is ApiResponseOk<unknown> {
  return isRecord(value) && value.status === 'ok' && 'data' in value
}

export class WowsApiClient extends HttpClient {
  readonly applicationId: string
  readonly realm: OfficialRealm
  readonly language?: LanguageCode
  readonly account: AccountApi
  readonly clans: ClansApi
  readonly encyclopedia: EncyclopediaApi
  readonly seasons: SeasonsApi
  readonly ships: ShipsApi

  private readonly baseUrl: string

  constructor(options: WowsApiClientOptions) {
    super(options)

    if (!options.applicationId?.trim()) {
      throw new TypeError('WowsApiClient requires a non-empty applicationId')
    }

    const realm = options.realm ?? 'eu'
    if (realm === 'cn') {
      throw new TypeError('CN has no official World of Warships API; use the Vortex or Clans client')
    }

    this.applicationId = options.applicationId
    this.realm = realm
    this.language = options.language
    this.baseUrl = (options.baseUrl ?? OFFICIAL_HOSTS[realm]).replace(/\/+$/, '')

    this.account = new AccountApi(this)
    this.clans = new ClansApi(this)
    this.encyclopedia = new EncyclopediaApi(this)
    this.seasons = new SeasonsApi(this)
    this.ships = new ShipsApi(this)
  }

  async request<T>(
    path: string,
    params: object = {},
    options: RequestOptions = {},
  ): Promise<ApiResponseOk<T>> {
    const url = this.buildUrl(path, params)
    const requestUrl = redactUrl(url)
    const { payload, status } = await this.fetchJson(url, requestUrl, options.signal)

    if (isApiErrorResponse(payload)) {
      throw new WowsApiError(payload.error, requestUrl)
    }
    if (!isApiOkResponse(payload)) {
      throw new WowsParseError(requestUrl, status)
    }

    return payload as ApiResponseOk<T>
  }

  private buildUrl(path: string, params: object): URL {
    const endpoint = path.replace(/^\/+|\/+$/g, '')
    const apiBase = this.baseUrl.endsWith('/wows') ? this.baseUrl : `${this.baseUrl}/wows`
    const url = new URL(`${apiBase}/${endpoint}/`)

    url.searchParams.set('application_id', this.applicationId)
    if (this.language) url.searchParams.set('language', this.language)

    for (const [key, value] of Object.entries(params)) {
      appendQuery(url, key, value)
    }

    return url
  }
}
