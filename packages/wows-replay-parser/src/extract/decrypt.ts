import { inflateSync } from 'node:zlib'
import { isPyCode, MarshalReader, type PyCode, type PyValue } from './marshal.js'

const DELIMITER = new TextEncoder().encode('<<<>>>')
const BASE64 = (() => {
  const table = new Int16Array(256).fill(-1)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (let index = 0; index < alphabet.length; index += 1) {
    table[alphabet.charCodeAt(index)] = index
  }
  table[0x3d] = -2
  return table
})()

export function decryptPyc(data: Uint8Array): PyCode {
  let outer: PyValue
  try {
    outer = new MarshalReader(data, 8).read()
  } catch (error) {
    throw new Error(`pyc: cannot read outer code object: ${String(error)}`)
  }

  if (!isPyCode(outer)) throw new Error('pyc: outer object is not a code object')

  try {
    const key = outer.code
    const encrypted = outer.consts[outer.consts.length - 1]
    if (!(encrypted instanceof Uint8Array)) throw new Error('stage 1 payload is not a string')

    const xored = new Uint8Array(encrypted.length)
    for (let index = 0; index < encrypted.length; index += 1) {
      xored[index] = encrypted[index] ^ key[index % key.length]
    }

    const inner = parseCode(inflateSync(base64Decode(xored)))

    const stage2Code = inner.consts[8]
    if (!isPyCode(stage2Code)) throw new Error('stage 2 co_consts[8] is not a code object')
    const swapMap = stage2Code.consts[1]
    if (!(swapMap instanceof Map) && !Array.isArray(swapMap)) {
      throw new Error('stage 2 swap map is not a mapping or sequence')
    }

    const ciphered = new Uint8Array(key.length)
    for (let index = 0; index < key.length; index += 1) {
      const mapped = lookup(swapMap, key[index])
      let value = (mapped ^ 38) & 0xff
      value = (value & 126) | ((value >> 7) & 1) | ((value & 1) << 7)
      ciphered[key.length - 1 - index] = (value ^ 89) & 0xff
    }

    const stage3 = parseCode(ciphered)
    const delimiterStart = findBytes(stage3.code, DELIMITER)
    if (delimiterStart < 0) throw new Error('stage 4 delimiter not found')

    const after = stage3.code.subarray(delimiterStart + DELIMITER.length)
    const delimiterEnd = findBytes(after, DELIMITER)
    const payload = (delimiterEnd >= 0 ? after.subarray(0, delimiterEnd) : after).slice().reverse()

    return parseCode(inflateSync(base64Decode(payload)))
  } catch {
    return outer
  }
}

export function base64Decode(input: Uint8Array): Uint8Array {
  const output = new Uint8Array(Math.ceil((input.length * 3) / 4))
  let outputOffset = 0
  let accumulator = 0
  let bits = 0

  for (const byte of input) {
    const value = BASE64[byte]
    if (value === -2) break
    if (value < 0) continue
    accumulator = (accumulator << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output[outputOffset++] = (accumulator >> bits) & 0xff
      accumulator &= (1 << bits) - 1
    }
  }

  return output.subarray(0, outputOffset)
}

function parseCode(data: Uint8Array): PyCode {
  const value = new MarshalReader(data).read()
  if (!isPyCode(value)) throw new Error('expected a code object')
  return value
}

function lookup(swapMap: Map<PyValue, PyValue> | PyValue[], key: number): number {
  if (swapMap instanceof Map) {
    const value = swapMap.get(key)
    return typeof value === 'number' ? value : 0
  }
  const value = swapMap[key]
  return typeof value === 'number' ? value : 0
}

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) continue outer
    }
    return index
  }
  return -1
}
