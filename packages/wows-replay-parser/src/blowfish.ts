import { Blowfish } from 'egoroof-blowfish'

export const REPLAY_BLOWFISH_KEY = Uint8Array.from([
  0x29, 0xb7, 0xc9, 0x09, 0x38, 0x3f, 0x84, 0x88, 0xfa, 0x98, 0xec, 0x4e, 0x13, 0x19, 0x79, 0xfb,
])

const BLOCK_SIZE = 8

export function decryptReplayStream(encrypted: Uint8Array): Uint8Array {
  const length = encrypted.length - (encrypted.length % BLOCK_SIZE)
  if (length === 0) return new Uint8Array(0)

  const cipher = new Blowfish(REPLAY_BLOWFISH_KEY, Blowfish.MODE.ECB, Blowfish.PADDING.NULL)
  const plain = cipher.decode(encrypted.subarray(0, length), Blowfish.TYPE.UINT8_ARRAY)

  for (let offset = BLOCK_SIZE; offset < length; offset += BLOCK_SIZE) {
    for (let index = 0; index < BLOCK_SIZE; index += 1) {
      plain[offset + index] ^= plain[offset - BLOCK_SIZE + index]
    }
  }

  return plain
}

export function encryptReplayStream(plain: Uint8Array): Uint8Array {
  const length = plain.length - (plain.length % BLOCK_SIZE)
  if (length === 0) return new Uint8Array(0)

  const chained = new Uint8Array(length)
  const previous = new Uint8Array(BLOCK_SIZE)

  for (let offset = 0; offset < length; offset += BLOCK_SIZE) {
    for (let index = 0; index < BLOCK_SIZE; index += 1) {
      chained[offset + index] = plain[offset + index] ^ previous[index]
      previous[index] = plain[offset + index]
    }
  }

  const cipher = new Blowfish(REPLAY_BLOWFISH_KEY, Blowfish.MODE.ECB, Blowfish.PADDING.NULL)
  return cipher.encode(chained)
}
