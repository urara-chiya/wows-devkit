import { describe, expect, it, vi } from 'vitest'
import { VortexClient, VortexError } from '../src/vortex'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function createClient(
  response: () => Response = () => jsonResponse({ status: 'ok', data: {} }),
  options: Partial<ConstructorParameters<typeof VortexClient>[0]> = {},
) {
  const fetchMock = vi.fn<typeof globalThis.fetch>(async () => response())
  const client = new VortexClient({ fetch: fetchMock, ...options })
  return { client, fetchMock }
}

describe('VortexClient', () => {
  it('uses the realm host and attaches the access token', async () => {
    const { client, fetchMock } = createClient(undefined, {
      realm: 'na',
      accessToken: 'secret',
    })

    await client.accounts.info(1001)

    const url = fetchMock.mock.calls[0]![0] as URL
    expect(url.origin).toBe('https://vortex.worldofwarships.com')
    expect(url.pathname).toBe('/api/accounts/1001/')
    expect(url.searchParams.get('ac')).toBe('secret')
  })

  it('builds clan, achievements, search and ship paths with encoded segments', async () => {
    const { client, fetchMock } = createClient()

    await client.accounts.clan(42)
    await client.accounts.achievements(42)
    await client.accounts.search('John Doe')
    await client.ships.all(42)
    await client.ships.stats(42, 'pvp_solo')
    await client.ships.stats(42, 'rank_div2')
    await client.ships.stats(42, 'rating_div')

    const paths = fetchMock.mock.calls.map(([input]) => (input as URL).pathname)
    expect(paths).toEqual([
      '/api/accounts/42/clans/',
      '/api/accounts/42/achievements/',
      '/api/accounts/search/John%20Doe/',
      '/api/accounts/42/ships/',
      '/api/accounts/42/ships/pvp_solo/',
      '/api/accounts/42/ships/rank_div2/',
      '/api/accounts/42/ships/rating_div/',
    ])
  })

  it('lets a request override or omit the client token', async () => {
    const { client, fetchMock } = createClient(undefined, { accessToken: 'default' })

    await client.accounts.info(1, { accessToken: 'override' })
    await client.accounts.info(1, { accessToken: null })

    expect((fetchMock.mock.calls[0]![0] as URL).searchParams.get('ac')).toBe('override')
    expect((fetchMock.mock.calls[1]![0] as URL).searchParams.has('ac')).toBe(false)
  })

  it('unwraps the envelope', async () => {
    const payload = { status: 'ok', data: { '1001': { name: 'Captain', created_at: 1 } } }
    const { client } = createClient(() => jsonResponse(payload))

    await expect(client.accounts.info(1001)).resolves.toEqual(payload.data)
  })

  it('returns null for 404', async () => {
    const { client } = createClient(() => jsonResponse({ error: 'not found' }, 404))

    await expect(client.accounts.info(999)).resolves.toBeNull()
    await expect(client.ships.pve(999)).resolves.toBeNull()
  })

  it('throws VortexError when status is not ok', async () => {
    const payload = { status: 'error', message: 'nope' }
    const { client } = createClient(() => jsonResponse(payload))

    await expect(client.accounts.info(1)).rejects.toBeInstanceOf(VortexError)
  })

  it('redacts the access token from error messages', async () => {
    const { client } = createClient(() => jsonResponse({}, 500), { accessToken: 'secret' })

    await expect(client.accounts.info(1)).rejects.toMatchObject({
      url: expect.not.stringContaining('secret'),
    })
  })
})
