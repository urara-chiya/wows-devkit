export interface ApiErrorPayload {
  code: number | string
  message: string
  field?: string | null
  value?: string | null
}

export class WowsApiError extends Error {
  readonly code: number | string
  readonly field?: string | null
  readonly value?: string | null
  readonly url?: string

  constructor(error: ApiErrorPayload, url?: string) {
    super(error.message || `Wargaming API error ${error.code}`)
    this.name = 'WowsApiError'
    this.code = error.code
    this.field = error.field
    this.value = error.value
    this.url = url
  }
}

export interface WowsHttpErrorInit {
  status: number
  statusText: string
  url: string
  body: unknown
}

export class WowsHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly url: string
  readonly body: unknown

  constructor(init: WowsHttpErrorInit) {
    super(`Wargaming API request failed with HTTP ${init.status} ${init.statusText}`.trim())
    this.name = 'WowsHttpError'
    this.status = init.status
    this.statusText = init.statusText
    this.url = init.url
    this.body = init.body
  }
}

export class WowsParseError extends Error {
  readonly url: string
  readonly status: number

  constructor(url: string, status: number, options?: ErrorOptions) {
    super('Wargaming API returned an unexpected response', options)
    this.name = 'WowsParseError'
    this.url = url
    this.status = status
  }
}

export class WowsNetworkError extends Error {
  readonly url: string

  constructor(url: string, options?: ErrorOptions) {
    super('Wargaming API request failed', options)
    this.name = 'WowsNetworkError'
    this.url = url
  }
}
