import { describe, expect, it, vi } from 'vitest'
import {
  ExpectedValuesClient,
  ExpectedValuesValidationError,
  WowsNumbersParseError,
  MemoryStorage,
  parseExpectedValues,
  shipCount,
  shipExpectedValues,
} from '../src'

const document = {
  time: 1_792_458_369,
  data: {
    '3309254640': {
      average_damage_dealt: 99_113.24,
      average_frags: 0.825,
      win_rate: 49.9147,
      ignored: 'field',
    },
    '3248404240': [],
  },
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('parseExpectedValues', () => {
  it('normalizes ships and keeps empty entries', () => {
    const parsed = parseExpectedValues(document)

    expect(parsed.time).toBe(document.time)
    expect(parsed.data['3309254640']).toEqual({
      average_damage_dealt: 99_113.24,
      average_frags: 0.825,
      win_rate: 49.9147,
    })
    expect(parsed.data['3248404240']).toEqual([])
    expect(shipCount(parsed)).toBe(1)
    expect(shipExpectedValues(parsed, '3309254640')).toEqual(parsed.data['3309254640'])
    expect(shipExpectedValues(parsed, '3248404240')).toBeNull()
    expect(shipExpectedValues(parsed, 1)).toBeNull()
  })

  it('rejects a document without usable ships', () => {
    expect(() => parseExpectedValues({ time: 1, data: { 1: [] } })).toThrow(
      ExpectedValuesValidationError,
    )
  })

  it('rejects non-finite values', () => {
    expect(() =>
      parseExpectedValues({
        time: 1,
        data: { 1: { average_damage_dealt: 1, average_frags: 1, win_rate: Number.NaN } },
      }),
    ).toThrow(ExpectedValuesValidationError)
  })

  it('rejects HTML error pages', () => {
    expect(() => parseExpectedValues('<html>down</html>')).toThrow(ExpectedValuesValidationError)
  })
})

describe('ExpectedValuesClient', () => {
  it('fetches, validates and caches the table', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonResponse(document))
    const cache = new MemoryStorage()
    const client = new ExpectedValuesClient({ fetch: fetchMock, cache, now: () => 1_000 })

    const first = await client.get()
    const second = await client.get()

    expect(first.data['3309254640']).toBeDefined()
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await client.getCached()).toEqual(first)
  })

  it('refetches after the TTL', async () => {
    let now = 0
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () =>
      jsonResponse({ ...document, time: now }),
    )
    const client = new ExpectedValuesClient({
      fetch: fetchMock,
      ttl: 1_000,
      now: () => now,
    })

    await client.get()
    now = 1_001
    await client.get()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('forces a refetch', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonResponse(document))
    const client = new ExpectedValuesClient({ fetch: fetchMock, now: () => 0 })

    await client.get()
    await client.get({ force: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to a stale cache when refresh fails', async () => {
    let now = 0
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse(document))
      .mockResolvedValueOnce(jsonResponse({ error: 'down' }, 503))
    const client = new ExpectedValuesClient({ fetch: fetchMock, ttl: 10, now: () => now })

    await client.get()
    now = 100
    const stale = await client.get()

    expect(stale.data['3309254640']).toBeDefined()
  })

  it('does not cache invalid payloads', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(
      async () => new Response('<html>down</html>', { status: 200 }),
    )
    const client = new ExpectedValuesClient({ fetch: fetchMock, now: () => 0 })

    await expect(client.get()).rejects.toBeInstanceOf(WowsNumbersParseError)
    await expect(client.getCached()).resolves.toBeNull()
  })

  it('surfaces HTTP failures when there is no cache', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonResponse({}, 500))
    const client = new ExpectedValuesClient({ fetch: fetchMock })

    await expect(client.get()).rejects.toMatchObject({ name: 'WowsNumbersHttpError', status: 500 })
  })

  it('clears the cache', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonResponse(document))
    const client = new ExpectedValuesClient({ fetch: fetchMock, now: () => 0 })

    await client.get()
    await client.clearCache()

    await expect(client.getCached()).resolves.toBeNull()
  })
})
