import { describe, expect, it } from 'vitest'
import {
  CATEGORY_COLORS,
  CHIP_TINT_ALPHA,
  categoryColor,
  chipBackground,
  playerUrl,
  withAlpha,
} from '../src'

describe('playerUrl', () => {
  it('builds a realm-scoped player URL', () => {
    expect(playerUrl({ realm: 'NA', accountId: 1_003_924_023, name: 'G4ngB4r3ng' })).toBe(
      'https://na.wows-numbers.com/player/1003924023,G4ngB4r3ng',
    )
  })

  it('encodes the player name but keeps the comma separator', () => {
    expect(playerUrl({ realm: 'eu', accountId: 42, name: 'John Doe & Co' })).toBe(
      'https://eu.wows-numbers.com/player/42,John%20Doe%20%26%20Co',
    )
  })

  it('rejects invalid realms and ids', () => {
    expect(() => playerUrl({ realm: 'eu/path', accountId: 1, name: 'a' })).toThrow(TypeError)
    expect(() => playerUrl({ realm: 'eu', accountId: 0, name: 'a' })).toThrow(TypeError)
    expect(() => playerUrl({ realm: 'eu', accountId: 1, name: '' })).toThrow(TypeError)
  })
})

describe('colors', () => {
  it('exposes a colour for every category', () => {
    expect(categoryColor('unicum').primary).toBe('#D042F3')
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(8)
  })

  it('converts a hue to an rgba tint', () => {
    expect(withAlpha('#FF0000', CHIP_TINT_ALPHA)).toBe('rgba(255, 0, 0, 0.18)')
    expect(chipBackground('great')).toBe('rgba(2, 201, 179, 0.18)')
  })

  it('rejects malformed colours', () => {
    expect(() => withAlpha('red', 10)).toThrow(TypeError)
  })
})
