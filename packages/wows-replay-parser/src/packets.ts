import { ReplayError } from './errors.js'
import type { ReplayPacket } from './types.js'

export const PACKET_HEADER_SIZE = 12
export const BATTLE_RESULTS_PACKET_TYPE = 0x22

export function* iteratePackets(data: Uint8Array): Generator<ReplayPacket> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 0

  while (offset < data.length) {
    if (offset + PACKET_HEADER_SIZE > data.length) {
      throw new ReplayError(
        'INVALID_PACKET_STREAM',
        `packet header at offset ${offset} needs 12 bytes, have ${data.length - offset}`,
        { offset },
      )
    }

    const size = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const clock = view.getFloat32(offset + 8, true)
    const payloadOffset = offset + PACKET_HEADER_SIZE

    if (payloadOffset + size > data.length) {
      throw new ReplayError(
        'INVALID_PACKET_STREAM',
        `packet at offset ${offset} declares ${size} payload bytes, have ${data.length - payloadOffset}`,
        { offset },
      )
    }

    yield {
      size,
      type,
      clock,
      payload: data.subarray(payloadOffset, payloadOffset + size),
    }

    offset = payloadOffset + size
  }
}

export function findPacket(data: Uint8Array, type: number): ReplayPacket | null {
  for (const packet of iteratePackets(data)) {
    if (packet.type === type) return packet
  }
  return null
}

export function findBattleResultsPacket(data: Uint8Array): ReplayPacket | null {
  return findPacket(data, BATTLE_RESULTS_PACKET_TYPE)
}
