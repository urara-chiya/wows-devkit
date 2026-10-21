export class WowsNumbersHttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly url: string
  readonly body: unknown

  constructor(init: {
    status: number
    statusText: string
    url: string
    body: unknown
  }) {
    super(`wows-numbers request failed with HTTP ${init.status} ${init.statusText}`.trim())
    this.name = 'WowsNumbersHttpError'
    this.status = init.status
    this.statusText = init.statusText
    this.url = init.url
    this.body = init.body
  }
}

export class WowsNumbersNetworkError extends Error {
  readonly url: string

  constructor(url: string, options?: ErrorOptions) {
    super('wows-numbers request failed', options)
    this.name = 'WowsNumbersNetworkError'
    this.url = url
  }
}

export class WowsNumbersParseError extends Error {
  readonly url: string

  constructor(url: string, options?: ErrorOptions) {
    super('wows-numbers returned a non-JSON response', options)
    this.name = 'WowsNumbersParseError'
    this.url = url
  }
}

export type ExpectedValuesValidationReason =
  | 'invalid-document'
  | 'invalid-ship-entry'
  | 'no-ships'

export class ExpectedValuesValidationError extends Error {
  readonly reason: ExpectedValuesValidationReason

  constructor(reason: ExpectedValuesValidationReason, message: string) {
    super(message)
    this.name = 'ExpectedValuesValidationError'
    this.reason = reason
  }
}
