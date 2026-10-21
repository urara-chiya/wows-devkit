import { ReplayError } from './errors.js'
import type { ParseReplayMetaOptions, ReplayContainer, ReplayMeta } from './types.js'
import { parseReplayVersion } from './version.js'

export const REPLAY_MAGIC = 0x11343212
export const DEFAULT_MAX_METADATA_BYTES = 1024 * 1024

const MAX_BLOCK_COUNT = 64
const textDecoder = new TextDecoder('utf-8', { fatal: true })

export function readReplayContainer(
  buffer: Uint8Array,
  options: ParseReplayMetaOptions = {},
): ReplayContainer {
  const maxMetadataBytes = options.maxMetadataBytes ?? DEFAULT_MAX_METADATA_BYTES

  if (buffer.length < 12) {
    throw new ReplayError('TRUNCATED', `replay is ${buffer.length} bytes, expected at least 12`)
  }

  const magic = readUint32LE(buffer, 0)
  if (magic !== REPLAY_MAGIC) {
    throw new ReplayError(
      'INVALID_MAGIC',
      `unexpected replay magic 0x${magic.toString(16)}, expected 0x${REPLAY_MAGIC.toString(16)}`,
      { offset: 0 },
    )
  }

  const blockCount = readUint32LE(buffer, 4)
  if (blockCount < 1 || blockCount > MAX_BLOCK_COUNT) {
    throw new ReplayError('INVALID_METADATA', `invalid block count ${blockCount}`, { offset: 4 })
  }

  let offset = 8
  ensureAvailable(buffer, offset, 4, 'metadata length')
  const metadataLength = readUint32LE(buffer, offset)
  offset += 4

  if (metadataLength > maxMetadataBytes) {
    throw new ReplayError(
      'INVALID_METADATA',
      `metadata block is ${metadataLength} bytes, limit is ${maxMetadataBytes}`,
      { offset },
    )
  }
  ensureAvailable(buffer, offset, metadataLength, 'metadata block')

  const metadataBytes = buffer.subarray(offset, offset + metadataLength)
  offset += metadataLength

  let metaJson: string
  try {
    metaJson = textDecoder.decode(metadataBytes)
  } catch (cause) {
    throw new ReplayError('INVALID_METADATA', 'metadata block is not valid UTF-8', { offset, cause })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(metaJson)
  } catch (cause) {
    throw new ReplayError('INVALID_METADATA', 'metadata block is not valid JSON', { offset, cause })
  }

  if (!isRecord(parsed)) {
    throw new ReplayError('INVALID_METADATA', 'metadata block is not a JSON object', { offset })
  }

  const extraBlocks: Uint8Array[] = []
  for (let index = 1; index < blockCount; index += 1) {
    ensureAvailable(buffer, offset, 4, `block ${index} length`)
    const blockLength = readUint32LE(buffer, offset)
    offset += 4
    ensureAvailable(buffer, offset, blockLength, `block ${index}`)
    extraBlocks.push(buffer.subarray(offset, offset + blockLength))
    offset += blockLength
  }

  ensureAvailable(buffer, offset, 8, 'packet stream header')
  const decompressedSize = readUint32LE(buffer, offset)
  const compressedSize = readUint32LE(buffer, offset + 4)
  offset += 8

  if (compressedSize === 0) {
    throw new ReplayError('TRUNCATED', 'replay contains no packet stream', { offset: offset - 4 })
  }
  ensureAvailable(buffer, offset, compressedSize, 'packet stream')

  const meta = buildMeta(parsed, 12)
  const packetStream = buffer.subarray(offset, offset + compressedSize)

  return {
    meta,
    metaJson,
    extraBlocks,
    decompressedSize,
    compressedSize,
    packetStream,
  }
}

export function parseReplayMeta(buffer: Uint8Array, options: ParseReplayMetaOptions = {}): ReplayMeta {
  return readReplayContainer(buffer, options).meta
}

function buildMeta(parsed: Record<string, unknown>, offset: number): ReplayMeta {
  for (const key of ['clientVersionFromExe', 'mapDisplayName', 'mapName', 'playerName', 'playerVehicle'] as const) {
    if (typeof parsed[key] !== 'string') {
      throw new ReplayError('INVALID_METADATA', `metadata field ${key} is missing or not a string`, { offset })
    }
  }
  if (!Array.isArray(parsed.vehicles)) {
    throw new ReplayError('INVALID_METADATA', 'metadata field vehicles is missing or not an array', { offset })
  }

  return {
    ...parsed,
    version: parseReplayVersion(parsed.clientVersionFromExe as string),
  } as ReplayMeta
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ensureAvailable(buffer: Uint8Array, offset: number, length: number, what: string): void {
  if (offset + length > buffer.length) {
    throw new ReplayError(
      'TRUNCATED',
      `replay ended while reading ${what}: need ${length} bytes at offset ${offset}, have ${buffer.length - offset}`,
      { offset },
    )
  }
}

export function readUint32LE(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] |
      (buffer[offset + 1] << 8) |
      (buffer[offset + 2] << 16) |
      (buffer[offset + 3] << 24)) >>>
    0
  )
}
