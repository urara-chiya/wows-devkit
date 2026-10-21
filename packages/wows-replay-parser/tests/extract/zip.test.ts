import { deflateRawSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { ZipArchive } from '../../src/extract/zip.js'

interface TestEntry {
  name: string
  data: string
  deflate?: boolean
}

describe('zip archive', () => {
  test('reads stored and deflated entries', () => {
    const archive = new ZipArchive(buildZip([
      { name: 'scripts/a.txt', data: 'stored' },
      { name: 'scripts/b.txt', data: 'deflated '.repeat(20), deflate: true },
    ]))

    expect(archive.names()).toEqual(['scripts/a.txt', 'scripts/b.txt'])
    expect(new TextDecoder().decode(archive.read('scripts/a.txt'))).toBe('stored')
    expect(new TextDecoder().decode(archive.read('scripts/b.txt'))).toBe('deflated '.repeat(20))
  })

  test('rejects a missing entry', () => {
    const archive = new ZipArchive(buildZip([{ name: 'a.txt', data: 'a' }]))
    expect(() => archive.read('missing')).toThrow(/not found/)
  })
})

function buildZip(entries: TestEntry[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name)
    const raw = new TextEncoder().encode(entry.data)
    const stored = entry.deflate ? deflateRawSync(raw) : raw
    const method = entry.deflate ? 8 : 0
    const local = concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(stored.length),
      uint32(raw.length),
      uint16(name.length),
      uint16(0),
      name,
      stored,
    ])
    localParts.push(local)

    centralParts.push(
      concat([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(method),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(stored.length),
        uint32(raw.length),
        uint16(name.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(localOffset),
        name,
      ]),
    )

    localOffset += local.length
  }

  const localData = concat(localParts)
  const centralData = concat(centralParts)
  const eocd = concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralData.length),
    uint32(localData.length),
    uint16(0),
  ])

  return concat([localData, centralData, eocd])
}

function concat(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function uint16(value: number): Uint8Array {
  const output = new Uint8Array(2)
  new DataView(output.buffer).setUint16(0, value, true)
  return output
}

function uint32(value: number): Uint8Array {
  const output = new Uint8Array(4)
  new DataView(output.buffer).setUint32(0, value, true)
  return output
}
