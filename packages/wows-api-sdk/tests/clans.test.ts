import { describe, expect, it, vi } from 'vitest'
import { ClansClient } from '../src/clans'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function createClient(
  response: () => Response = () => jsonResponse({}),
  options: Partial<ConstructorParameters<typeof ClansClient>[0]> = {},
) {
  const fetchMock = vi.fn<typeof globalThis.fetch>(async () => response())
  const client = new ClansClient({ fetch: fetchMock, ...options })
  return { client, fetchMock }
}

describe('ClansClient', () => {
  it('builds clan base paths on the realm host', async () => {
    const { client, fetchMock } = createClient(undefined, { realm: 'eu' })

    await client.info(123)
    await client.members(123)

    const urls = fetchMock.mock.calls.map(([input]) => input as URL)
    expect(urls[0]!.origin).toBe('https://clans.worldofwarships.eu')
    expect(urls[0]!.pathname).toBe('/api/clanbase/123/claninfo/')
    expect(urls[1]!.pathname).toBe('/api/members/123/')
  })

  it('encodes the clan tag in search', async () => {
    const { client, fetchMock } = createClient()

    await client.search('-TAG & Co')

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.pathname).toBe('/api/search/autocomplete/')
    expect(url.searchParams.get('search')).toBe('-TAG & Co')
    expect(url.searchParams.get('type')).toBe('clans')
  })

  it('maps the realm for ladder requests and applies defaults', async () => {
    const { client, fetchMock } = createClient(undefined, { realm: 'asia' })

    await client.ladder({ league: 1, division: 2 })

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.pathname).toBe('/api/ladder/structure/')
    expect(url.searchParams.get('realm')).toBe('sg')
    expect(url.searchParams.get('league')).toBe('1')
    expect(url.searchParams.get('division')).toBe('2')
    expect(url.searchParams.get('limit')).toBe('1000')
  })

  it('omits ladder filters when they are not provided', async () => {
    const { client, fetchMock } = createClient(undefined, { realm: 'asia' })

    await client.ladder({})

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.searchParams.get('realm')).toBe('sg')
    expect(url.searchParams.has('league')).toBe(false)
    expect(url.searchParams.has('division')).toBe(false)
  })

  it('returns the bare ladder array', async () => {
    const ladder = [{ clan_id: 1, public_rating: 1000 }]
    const { client } = createClient(() => jsonResponse(ladder))

    await expect(client.ladder({ league: 1, division: 1 })).resolves.toEqual(ladder)
  })

  it('returns null for 404', async () => {
    const { client } = createClient(() => jsonResponse({}, 404))

    await expect(client.info(999)).resolves.toBeNull()
  })
})
