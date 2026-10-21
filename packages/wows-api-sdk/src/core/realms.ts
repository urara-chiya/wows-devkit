/**
 * Host table for every Wargaming-operated service the SDK talks to.
 *
 * `official` is the classic World of Warships API, `vortex` is the newer
 * account/ship statistics service, and `clans` is the standalone clan service.
 * The three live on different hosts but share the same realm and region ids.
 */
export interface RealmEndpoints {
  /** Classic API origin. `null` when the realm has no official API (CN). */
  official: string | null
  /** Vortex origin. */
  vortex: string
  /** Clan service origin. */
  clans: string
  /** Realm name used by the clan ladder endpoint. */
  clanRealm: string
}

export const REALM_ENDPOINTS = {
  ru: {
    official: 'https://api.worldofwarships.ru',
    vortex: 'https://vortex.korabli.su',
    clans: 'https://clans.korabli.su',
    clanRealm: 'ru',
  },
  eu: {
    official: 'https://api.worldofwarships.eu',
    vortex: 'https://vortex.worldofwarships.eu',
    clans: 'https://clans.worldofwarships.eu',
    clanRealm: 'eu',
  },
  na: {
    official: 'https://api.worldofwarships.com',
    vortex: 'https://vortex.worldofwarships.com',
    clans: 'https://clans.worldofwarships.com',
    clanRealm: 'us',
  },
  asia: {
    official: 'https://api.worldofwarships.asia',
    vortex: 'https://vortex.worldofwarships.asia',
    clans: 'https://clans.worldofwarships.asia',
    clanRealm: 'sg',
  },
  cn: {
    official: null,
    vortex: 'https://vortex.wowsgame.cn',
    clans: 'https://clans.wowsgame.cn',
    clanRealm: 'cn360',
  },
} as const satisfies Record<string, RealmEndpoints>

export type WowsRealm = keyof typeof REALM_ENDPOINTS

export const WOWS_REALMS = Object.keys(REALM_ENDPOINTS) as WowsRealm[]

/** Realms served by the classic `api.worldofwarships.*` API. */
export type OfficialRealm = Exclude<WowsRealm, 'cn'>

export type OfficialHosts = Record<OfficialRealm, string>

export const OFFICIAL_HOSTS: OfficialHosts = {
  ru: REALM_ENDPOINTS.ru.official,
  eu: REALM_ENDPOINTS.eu.official,
  na: REALM_ENDPOINTS.na.official,
  asia: REALM_ENDPOINTS.asia.official,
}
