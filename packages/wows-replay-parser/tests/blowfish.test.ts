import { Blowfish } from 'egoroof-blowfish'
import { describe, expect, test } from 'vitest'
import { decryptReplayStream, encryptReplayStream } from '../src/blowfish.js'

describe('Blowfish', () => {
  test('matches the standard zero-key test vector', () => {
    const cipher = new Blowfish(new Uint8Array(8), Blowfish.MODE.ECB, Blowfish.PADDING.NULL)
    const plain = new Uint8Array(8)
    const encrypted = cipher.encode(plain)

    expect(Buffer.from(encrypted).toString('hex')).toBe('4ef997456198dd78')
    expect(cipher.decode(encrypted, Blowfish.TYPE.UINT8_ARRAY)).toEqual(plain)
  })

  test('replay stream encryption round-trips', () => {
    const plain = Uint8Array.from({ length: 256 }, (_, index) => index & 0xff)
    const encrypted = encryptReplayStream(plain)

    expect(encrypted).not.toEqual(plain)
    expect(decryptReplayStream(encrypted)).toEqual(plain)
  })

  test('ignores a ragged trailing block', () => {
    const plain = Uint8Array.from({ length: 40 }, (_, index) => index)
    const encrypted = encryptReplayStream(plain)
    const withTail = new Uint8Array(encrypted.length + 3)
    withTail.set(encrypted)
    withTail.set([1, 2, 3], encrypted.length)

    expect(decryptReplayStream(withTail).subarray(0, 40)).toEqual(plain)
  })
})
