import type { CacheStorage } from './cache.js'
import { MemoryStorage } from './cache.js'
import {
  ExpectedValuesValidationError,
  WowsNumbersHttpError,
  WowsNumbersNetworkError,
  WowsNumbersParseError,
} from './errors.js'
import type {
  ExpectedValuesDocument,
  ShipExpectedValues,
  ShipExpectedValuesEntry,
} from './types.js'

export const EXPECTED_VALUES_URL = 'https://api.wows-numbers.com/personal/rating/expected/json/'

/** wows-numbers refreshes the table slowly; the reference client uses 7 days. */
export const DEFAULT_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

export const DEFAULT_CACHE_KEY = 'wows-number:expected-values'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Validates and normalizes an expected-values payload.
 *
 * wows-numbers has served HTML error pages with a 200 status, so callers must
 * not trust the response shape. Unknown ship fields are dropped.
 */
export function parseExpectedValues(input: unknown): ExpectedValuesDocument {
  if (!isRecord(input) || !isFiniteNumber(input.time) || !isRecord(input.data)) {
    throw new ExpectedValuesValidationError(
      'invalid-document',
      'expected values must be an object with a numeric time and a data object',
    )
  }

  const data: Record<string, ShipExpectedValuesEntry> = {}
  let shipsWithValues = 0

  for (const [shipId, entry] of Object.entries(input.data)) {
    if (Array.isArray(entry)) {
      if (entry.length !== 0) {
        throw new ExpectedValuesValidationError(
          'invalid-ship-entry',
          `ship ${shipId} must be an object or an empty array`,
        )
      }
      data[shipId] = []
      continue
    }

    if (
      !isRecord(entry) ||
      !isFiniteNumber(entry.average_damage_dealt) ||
      !isFiniteNumber(entry.average_frags) ||
      !isFiniteNumber(entry.win_rate)
    ) {
      throw new ExpectedValuesValidationError(
        'invalid-ship-entry',
        `ship ${shipId} must have finite average_damage_dealt, average_frags and win_rate`,
      )
    }

    data[shipId] = {
      average_damage_dealt: entry.average_damage_dealt,
      average_frags: entry.average_frags,
      win_rate: entry.win_rate,
    }
    shipsWithValues += 1
  }

  if (shipsWithValues === 0) {
    throw new ExpectedValuesValidationError(
      'no-ships',
      'expected values contain no ships with usable values',
    )
  }

  return { time: input.time, data }
}

/** Expected values for one ship, or `null` when the ship has none. */
export function shipExpectedValues(
  document: ExpectedValuesDocument,
  shipId: number | string,
): ShipExpectedValues | null {
  const entry = document.data[String(shipId)]
  return entry === undefined || Array.isArray(entry) ? null : entry
}

/** Number of ships that actually carry expected values. */
export function shipCount(document: ExpectedValuesDocument): number {
  let count = 0
  for (const entry of Object.values(document.data)) {
    if (!Array.isArray(entry)) count += 1
  }
  return count
}

export interface ExpectedValuesClientOptions {
  url?: string
  fetch?: typeof globalThis.fetch
  timeout?: number
  /** Defaults to an in-memory cache. */
  cache?: CacheStorage
  cacheKey?: string
  /** Cache lifetime in milliseconds. Defaults to 7 days. */
  ttl?: number
  /** Injectable clock for tests. */
  now?: () => number
}

export interface ExpectedValuesRequestOptions {
  signal?: AbortSignal
  /** Skip a fresh cache entry. A stale entry is still used if the fetch fails. */
  force?: boolean
}

interface CacheEntry {
  savedAt: number
  document: ExpectedValuesDocument
}

export class ExpectedValuesClient {
  readonly url: string
  readonly ttl: number
  readonly cacheKey: string

  private readonly fetchImpl: typeof globalThis.fetch
  private readonly timeout?: number
  private readonly cache: CacheStorage
  private readonly now: () => number

  constructor(options: ExpectedValuesClientOptions = {}) {
    const fetchImpl = options.fetch ?? globalThis.fetch
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('No fetch implementation available. Pass a fetch option.')
    }

    this.url = options.url ?? EXPECTED_VALUES_URL
    this.fetchImpl = fetchImpl
    this.timeout = options.timeout
    this.cache = options.cache ?? new MemoryStorage()
    this.cacheKey = options.cacheKey ?? DEFAULT_CACHE_KEY
    this.ttl = options.ttl ?? DEFAULT_CACHE_TTL
    this.now = options.now ?? Date.now
  }

  /** Returns the expected-values table, fetching it when the cache is stale. */
  async get(options: ExpectedValuesRequestOptions = {}): Promise<ExpectedValuesDocument> {
    const cached = await this.readCache()

    if (!options.force && cached && this.now() - cached.savedAt < this.ttl) {
      return cached.document
    }

    try {
      const document = await this.fetchDocument(options.signal)
      await this.writeCache(document)
      return document
    } catch (error) {
      // A refresh failure must not discard a usable table.
      if (cached) return cached.document
      throw error
    }
  }

  /** Reads and validates the cache without touching the network. */
  async getCached(): Promise<ExpectedValuesDocument | null> {
    return (await this.readCache())?.document ?? null
  }

  async clearCache(): Promise<void> {
    await this.cache.delete?.(this.cacheKey)
  }

  private async fetchDocument(signal?: AbortSignal): Promise<ExpectedValuesDocument> {
    const signals: AbortSignal[] = []
    if (signal) signals.push(signal)
    if (this.timeout !== undefined) signals.push(AbortSignal.timeout(this.timeout))
    const combined =
      signals.length === 0 ? undefined : signals.length === 1 ? signals[0] : AbortSignal.any(signals)

    let response: Response
    try {
      response = await this.fetchImpl(this.url, {
        headers: { accept: 'application/json' },
        signal: combined,
      })
    } catch (cause) {
      throw new WowsNumbersNetworkError(this.url, { cause })
    }

    const text = await response.text()
    if (!response.ok) {
      let body: unknown = text
      try {
        body = JSON.parse(text)
      } catch {
        // Keep the raw body when the server did not return JSON.
      }
      throw new WowsNumbersHttpError({
        status: response.status,
        statusText: response.statusText,
        url: this.url,
        body,
      })
    }

    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch (cause) {
      throw new WowsNumbersParseError(this.url, { cause })
    }

    return parseExpectedValues(payload)
  }

  private async readCache(): Promise<CacheEntry | null> {
    try {
      const raw = await this.cache.get(this.cacheKey)
      if (!raw) return null

      const parsed: unknown = JSON.parse(raw)
      if (!isRecord(parsed) || !isFiniteNumber(parsed.savedAt)) return null

      return {
        savedAt: parsed.savedAt,
        document: parseExpectedValues(parsed.document),
      }
    } catch {
      return null
    }
  }

  private async writeCache(document: ExpectedValuesDocument): Promise<void> {
    const entry: CacheEntry = { savedAt: this.now(), document }
    try {
      await this.cache.set(this.cacheKey, JSON.stringify(entry))
    } catch {
      // Storage quota or permission failures must not fail the request.
    }
  }
}
