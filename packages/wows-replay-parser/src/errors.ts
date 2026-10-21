export type ReplayErrorCode =
  | 'INVALID_MAGIC'
  | 'TRUNCATED'
  | 'INVALID_METADATA'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_PACKET_STREAM'
  | 'INVALID_BATTLE_RESULTS'

export class ReplayError extends Error {
  readonly code: ReplayErrorCode
  readonly offset?: number

  constructor(code: ReplayErrorCode, message: string, options: { offset?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'ReplayError'
    this.code = code
    this.offset = options.offset
  }
}
