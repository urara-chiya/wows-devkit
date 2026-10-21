import { WowsHttpError, WowsNetworkError, WowsParseError } from './errors.js'

export interface HttpClientOptions {
  fetch?: typeof globalThis.fetch
  /** Request timeout in milliseconds. */
  timeout?: number
}

export interface JsonResponse {
  payload: unknown
  status: number
  statusText: string
}

export function appendQuery(url: URL, key: string, value: unknown): void {
  if (value === undefined || value === null) return
  url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
}

/** Builds a URL without leaking credentials into error messages. */
export function redactUrl(url: URL): string {
  const redacted = new URL(url)
  for (const key of ['application_id', 'ac']) {
    if (redacted.searchParams.has(key)) redacted.searchParams.set(key, '***')
  }
  return redacted.toString()
}

export class HttpClient {
  protected readonly fetchImpl: typeof globalThis.fetch
  protected readonly timeout?: number

  constructor(options: HttpClientOptions = {}) {
    const fetchImpl = options.fetch ?? globalThis.fetch
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('No fetch implementation available. Pass a fetch option.')
    }
    this.fetchImpl = fetchImpl
    this.timeout = options.timeout
  }

  protected async fetchJson(
    url: URL,
    requestUrl: string,
    signal?: AbortSignal,
  ): Promise<JsonResponse> {
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal:
          signal ??
          (this.timeout === undefined ? undefined : AbortSignal.timeout(this.timeout)),
      })
    } catch (cause) {
      throw new WowsNetworkError(requestUrl, { cause })
    }

    const text = await response.text()
    if (!response.ok) {
      let body: unknown = text
      try {
        body = JSON.parse(text)
      } catch {
        // Keep the raw body when the server did not return JSON.
      }
      throw new WowsHttpError({
        status: response.status,
        statusText: response.statusText,
        url: requestUrl,
        body,
      })
    }

    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch (cause) {
      throw new WowsParseError(requestUrl, response.status, { cause })
    }

    return { payload, status: response.status, statusText: response.statusText }
  }
}
