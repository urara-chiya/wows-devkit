import { decryptReplayStream } from './blowfish.js'
import { readReplayContainer } from './container.js'
import { ReplayError } from './errors.js'
import { findBattleResultsPacket } from './packets.js'
import { parseBattleResultsPayload, resolveBattleResults } from './results.js'
import type { ParsedReplay, ParseReplayOptions } from './types.js'
import { isSupportedVersion, MIN_SUPPORTED_VERSION } from './version.js'

export const DEFAULT_MAX_DECOMPRESSED_BYTES = 256 * 1024 * 1024

export function parseReplay(buffer: Uint8Array, options: ParseReplayOptions): ParsedReplay {
  const container = readReplayContainer(buffer, { maxMetadataBytes: options.maxMetadataBytes })
  const { meta } = container

  if (!isSupportedVersion(meta.version)) {
    throw new ReplayError(
      'UNSUPPORTED_VERSION',
      `replay version ${meta.clientVersionFromExe} is not supported; battle results require ` +
        `${MIN_SUPPORTED_VERSION.major}.${MIN_SUPPORTED_VERSION.minor}.${MIN_SUPPORTED_VERSION.patch} or newer`,
    )
  }

  const maxDecompressedBytes = options.maxDecompressedBytes ?? DEFAULT_MAX_DECOMPRESSED_BYTES
  const decrypted = decryptReplayStream(container.packetStream)
  let packetData: Uint8Array
  try {
    packetData = options.inflate(decrypted, { maxOutputLength: maxDecompressedBytes })
  } catch (cause) {
    throw new ReplayError('INVALID_PACKET_STREAM', 'failed to inflate replay packet stream', { cause })
  }

  if (packetData.length > maxDecompressedBytes) {
    throw new ReplayError(
      'INVALID_PACKET_STREAM',
      `decompressed packet stream is ${packetData.length} bytes, limit is ${maxDecompressedBytes}`,
    )
  }
  if (packetData.length !== container.decompressedSize) {
    throw new ReplayError(
      'INVALID_PACKET_STREAM',
      `decompressed packet stream is ${packetData.length} bytes, expected ${container.decompressedSize}`,
    )
  }

  const packet = findBattleResultsPacket(packetData)
  const battleResults = packet
    ? resolveBattleResults(parseBattleResultsPayload(packet.payload), options.mapping)
    : null

  return { meta, battleResults }
}
