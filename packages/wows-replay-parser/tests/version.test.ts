import { describe, expect, test } from 'vitest'
import { isSupportedVersion, parseReplayVersion } from '../src/version.js'

describe('parseReplayVersion', () => {
  test('parses game versions with spaces', () => {
    expect(parseReplayVersion('15, 9, 0, 13357625')).toEqual({
      major: 15,
      minor: 9,
      patch: 0,
      build: 13357625,
      raw: '15, 9, 0, 13357625',
    })
  })

  test('accepts a version without a build number', () => {
    expect(parseReplayVersion('13,2,0')).toMatchObject({ major: 13, minor: 2, patch: 0, build: null })
  })

  test('rejects malformed versions', () => {
    expect(parseReplayVersion('')).toBeNull()
    expect(parseReplayVersion('15,9')).toBeNull()
    expect(parseReplayVersion('a,b,c')).toBeNull()
    expect(parseReplayVersion(undefined)).toBeNull()
  })
})

describe('isSupportedVersion', () => {
  test('requires 12.6.0 or newer', () => {
    expect(isSupportedVersion(parseReplayVersion('12,5,0,1'))).toBe(false)
    expect(isSupportedVersion(parseReplayVersion('12,6,0,1'))).toBe(true)
    expect(isSupportedVersion(parseReplayVersion('12,6,1,1'))).toBe(true)
    expect(isSupportedVersion(parseReplayVersion('13,0,0,1'))).toBe(true)
    expect(isSupportedVersion(null)).toBe(false)
  })
})
