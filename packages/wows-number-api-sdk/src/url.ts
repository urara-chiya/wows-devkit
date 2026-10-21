/** Realm subdomains confirmed by the reference client. */
export const WOWS_NUMBERS_REALMS = ['eu', 'na', 'asia'] as const

export type WowsNumbersRealm = (typeof WOWS_NUMBERS_REALMS)[number]

export interface PlayerUrlOptions {
  /**
   * wows-numbers subdomain. `eu`, `na` and `asia` are verified; other
   * strings are passed through lowercased for forward compatibility.
   */
  realm: WowsNumbersRealm | (string & {})
  accountId: number
  name: string
}

/**
 * Builds `https://{realm}.wows-numbers.com/player/{id},{name}`.
 *
 * The name is percent-encoded; the comma separator is not.
 */
export function playerUrl(options: PlayerUrlOptions): string {
  const realm = options.realm.trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(realm)) {
    throw new TypeError(`invalid wows-numbers realm: "${options.realm}"`)
  }
  if (!Number.isInteger(options.accountId) || options.accountId <= 0) {
    throw new TypeError(`invalid account id: "${options.accountId}"`)
  }
  if (!options.name) {
    throw new TypeError('player name is required')
  }

  return `https://${realm}.wows-numbers.com/player/${options.accountId},${encodeURIComponent(options.name)}`
}
