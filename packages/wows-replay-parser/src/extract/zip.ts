import { inflateRawSync } from 'node:zlib'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const EOCD_MIN_SIZE = 22
const EOCD_MAX_SEARCH = 65557

export interface ZipEntry {
  name: string
  compression: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

export class ZipArchive {
  private readonly entries = new Map<string, ZipEntry>()

  constructor(private readonly buffer: Uint8Array) {
    let eocd = -1
    const searchStart = Math.max(0, buffer.length - EOCD_MAX_SEARCH)
    for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= searchStart; offset -= 1) {
      if (readUint32LE(buffer, offset) === EOCD_SIGNATURE) {
        eocd = offset
        break
      }
    }
    if (eocd < 0) throw new Error('scripts.zip: end of central directory not found')

    const entryCount = readUint16LE(buffer, eocd + 10)
    const centralOffset = readUint32LE(buffer, eocd + 16)
    if (centralOffset === 0xffffffff) throw new Error('scripts.zip: zip64 archives are not supported')

    let offset = centralOffset
    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > buffer.length) throw new Error('scripts.zip: truncated central directory')
      if (readUint32LE(buffer, offset) !== CENTRAL_SIGNATURE) {
        throw new Error(`scripts.zip: bad central directory entry at ${offset}`)
      }

      const compression = readUint16LE(buffer, offset + 10)
      const compressedSize = readUint32LE(buffer, offset + 20)
      const uncompressedSize = readUint32LE(buffer, offset + 24)
      const nameLength = readUint16LE(buffer, offset + 28)
      const extraLength = readUint16LE(buffer, offset + 30)
      const commentLength = readUint16LE(buffer, offset + 32)
      const localHeaderOffset = readUint32LE(buffer, offset + 42)

      if (compressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
        throw new Error('scripts.zip: zip64 entries are not supported')
      }

      const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLength)
      const name = new TextDecoder('utf-8').decode(nameBytes)
      this.entries.set(name, {
        name,
        compression,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      })

      offset += 46 + nameLength + extraLength + commentLength
    }
  }

  names(): string[] {
    return [...this.entries.keys()]
  }

  entriesList(): ZipEntry[] {
    return [...this.entries.values()]
  }

  get(name: string): ZipEntry | undefined {
    return this.entries.get(name)
  }

  read(nameOrEntry: string | ZipEntry): Uint8Array {
    const entry = typeof nameOrEntry === 'string' ? this.entries.get(nameOrEntry) : nameOrEntry
    if (!entry) throw new Error(`scripts.zip: entry not found: ${String(nameOrEntry)}`)

    const headerOffset = entry.localHeaderOffset
    if (headerOffset + 30 > this.buffer.length) throw new Error(`scripts.zip: truncated local header for ${entry.name}`)
    if (readUint32LE(this.buffer, headerOffset) !== LOCAL_SIGNATURE) {
      throw new Error(`scripts.zip: bad local header for ${entry.name}`)
    }

    const nameLength = readUint16LE(this.buffer, headerOffset + 26)
    const extraLength = readUint16LE(this.buffer, headerOffset + 28)
    const dataOffset = headerOffset + 30 + nameLength + extraLength
    const data = this.buffer.subarray(dataOffset, dataOffset + entry.compressedSize)

    if (data.length !== entry.compressedSize) {
      throw new Error(`scripts.zip: truncated data for ${entry.name}`)
    }

    if (entry.compression === 0) return data
    if (entry.compression === 8) return inflateRawSync(data)
    throw new Error(`scripts.zip: unsupported compression method ${entry.compression} for ${entry.name}`)
  }
}

function readUint16LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8)
}

function readUint32LE(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] |
      (buffer[offset + 1] << 8) |
      (buffer[offset + 2] << 16) |
      (buffer[offset + 3] << 24)) >>>
    0
  )
}
