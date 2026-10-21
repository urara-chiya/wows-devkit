import { describe, expect, it, vi } from 'vitest'
import {
  WowsApiClient,
  WowsApiError,
  WowsHttpError,
  WowsNetworkError,
  WowsParseError,
  unwrap,
} from '../src'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function createClient(
  response: () => Response = () => jsonResponse({ status: 'ok', meta: {}, data: {} }),
  options: Partial<ConstructorParameters<typeof WowsApiClient>[0]> = {},
) {
  const fetchMock = vi.fn<typeof globalThis.fetch>(async () => response())
  const client = new WowsApiClient({
    applicationId: 'app-id',
    fetch: fetchMock,
    ...options,
  })
  return { client, fetchMock }
}

describe('WowsApiClient', () => {
  it('builds realm URLs and serializes query parameters', async () => {
    const { client, fetchMock } = createClient()
    await client.account.info({
      account_id: [1001, 1002],
      fields: ['nickname', 'statistics.pvp_solo'],
      extra: ['statistics.pvp_solo'],
    })

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.origin).toBe('https://api.worldofwarships.eu')
    expect(url.pathname).toBe('/wows/account/info/')
    expect(url.searchParams.get('application_id')).toBe('app-id')
    expect(url.searchParams.get('account_id')).toBe('1001,1002')
    expect(url.searchParams.get('fields')).toBe('nickname,statistics.pvp_solo')
    expect(url.searchParams.get('extra')).toBe('statistics.pvp_solo')
  })

  it('applies the default language and lets requests override it', async () => {
    const { client, fetchMock } = createClient(undefined, { language: 'zh-cn' })

    await client.account.list({ search: 'warspite' })
    await client.account.list({ search: 'warspite', language: 'en' })

    const first = fetchMock.mock.calls[0]![0] as URL
    const second = fetchMock.mock.calls[1]![0] as URL
    expect(first.searchParams.get('language')).toBe('zh-cn')
    expect(second.searchParams.get('language')).toBe('en')
  })

  it('serializes booleans and numbers', async () => {
    const { client, fetchMock } = createClient()
    await client.ships.stats({ account_id: 1001, in_garage: true, ship_id: 42 })

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.searchParams.get('account_id')).toBe('1001')
    expect(url.searchParams.get('in_garage')).toBe('1')
    expect(url.searchParams.get('ship_id')).toBe('42')
  })

  it('accepts an API base URL that already includes /wows', async () => {
    const { client, fetchMock } = createClient(undefined, {
      baseUrl: 'https://proxy.example.com/wows/',
    })
    await client.clans.glossary()

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.toString()).toMatch(/^https:\/\/proxy\.example\.com\/wows\/clans\/glossary\//)
  })

  it('returns the parsed response and exposes data through unwrap', async () => {
    const { client } = createClient(() =>
      jsonResponse({ status: 'ok', meta: { count: 1 }, data: { 1: { nickname: 'Test' } } }),
    )

    const response = await client.account.info({ account_id: 1 })
    expect(response.meta.count).toBe(1)
    expect(unwrap(response)).toEqual({ 1: { nickname: 'Test' } })
  })

  it('throws WowsApiError for API-level errors', async () => {
    const { client } = createClient(() =>
      jsonResponse({
        status: 'error',
        error: { code: 407, message: 'NOT_ENOUGH_SEARCH_LENGTH', field: 'search', value: 'a' },
      }),
    )

    const error = await client.account.list({ search: 'a' }).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(WowsApiError)
    expect(error).toMatchObject({
      code: 407,
      message: 'NOT_ENOUGH_SEARCH_LENGTH',
      field: 'search',
      value: 'a',
    })
    expect((error as WowsApiError).url).not.toContain('app-id')
  })

  it('throws WowsHttpError for non-2xx responses', async () => {
    const { client } = createClient(() => new Response('upstream failed', { status: 502 }))

    const error = await client.account.list({ search: 'test' }).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(WowsHttpError)
    expect(error).toMatchObject({ status: 502, body: 'upstream failed' })
  })

  it('throws WowsParseError for non-JSON responses', async () => {
    const { client } = createClient(() => new Response('<html>oops</html>', { status: 200 }))

    await expect(client.account.list({ search: 'test' })).rejects.toBeInstanceOf(WowsParseError)
  })

  it('throws WowsNetworkError when fetch rejects', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('fetch failed')
    })
    const client = new WowsApiClient({
      applicationId: 'app-id',
      fetch: fetchMock,
    })

    await expect(client.account.list({ search: 'test' })).rejects.toBeInstanceOf(WowsNetworkError)
  })

  it('uses the realm host by default and validates the application ID', () => {
    expect(() => new WowsApiClient({ applicationId: '' })).toThrow(TypeError)
    expect(
      new WowsApiClient({
        applicationId: 'app-id',
        realm: 'asia',
        fetch: vi.fn<typeof globalThis.fetch>(),
      }).realm,
    ).toBe('asia')
  })
})

describe('endpoint routing', () => {
  const calls: Array<[string, (client: WowsApiClient) => Promise<unknown>]> = [
    ['account/list', (client) => client.account.list({ search: 'test' })],
    ['account/info', (client) => client.account.info({ account_id: 1 })],
    ['account/achievements', (client) => client.account.achievements({ account_id: 1 })],
    ['clans/list', (client) => client.clans.list()],
    ['clans/info', (client) => client.clans.info({ clan_id: 1 })],
    ['clans/accountinfo', (client) => client.clans.accountInfo({ account_id: 1 })],
    ['clans/glossary', (client) => client.clans.glossary()],
    ['clans/season', (client) => client.clans.season()],
    ['clans/seasonstats', (client) => client.clans.seasonStats({ account_id: 1 })],
    ['encyclopedia/ships', (client) => client.encyclopedia.ships()],
    ['encyclopedia/shipprofile', (client) => client.encyclopedia.shipProfile({ ship_id: 1 })],
    ['encyclopedia/modules', (client) => client.encyclopedia.modules()],
    ['encyclopedia/consumables', (client) => client.encyclopedia.consumables()],
    ['encyclopedia/crews', (client) => client.encyclopedia.crews()],
    ['encyclopedia/crewskills', (client) => client.encyclopedia.crewSkills()],
    ['encyclopedia/crewranks', (client) => client.encyclopedia.crewRanks()],
    ['encyclopedia/achievements', (client) => client.encyclopedia.achievements()],
    ['encyclopedia/battlearenas', (client) => client.encyclopedia.battleArenas()],
    ['encyclopedia/battletypes', (client) => client.encyclopedia.battleTypes()],
    ['encyclopedia/collections', (client) => client.encyclopedia.collections()],
    ['encyclopedia/collectioncards', (client) => client.encyclopedia.collectionCards()],
    ['encyclopedia/accountlevels', (client) => client.encyclopedia.accountLevels()],
    ['encyclopedia/info', (client) => client.encyclopedia.info()],
    ['seasons/info', (client) => client.seasons.info()],
    ['seasons/accountinfo', (client) => client.seasons.accountInfo({ account_id: 1 })],
    ['seasons/shipstats', (client) => client.seasons.shipStats({ account_id: 1 })],
    ['ships/stats', (client) => client.ships.stats({ account_id: 1 })],
    ['ships/badges', (client) => client.ships.badges({ account_id: 1 })],
  ]

  it.each(calls)('routes %s', async (path, call) => {
    const { client, fetchMock } = createClient()
    await call(client)

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.pathname).toBe(`/wows/${path}/`)
  })
})
