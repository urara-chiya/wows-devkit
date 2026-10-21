import { describe, expect, test } from 'vitest'
import { ReplayError } from '../src/errors.js'
import {
  BATTLE_RESULTS_PACKET_TYPE,
  findBattleResultsPacket,
  findPacket,
  iteratePackets,
} from '../src/packets.js'
import { concat, createBattleResultsPacket, createPacket, createVersionPacket } from './helpers/replay.js'

describe('packet stream', () => {
  test('iterates headers and payloads', () => {
    const stream = concat([
      createVersionPacket('15,9,0,13357625'),
      createPacket(0x10, Uint8Array.of(0)),
      createBattleResultsPacket({ commonList: [], playersPublicInfo: {} }),
    ])

    const packets = [...iteratePackets(stream)]

    expect(packets.map((packet) => packet.type)).toEqual([0x16, 0x10, BATTLE_RESULTS_PACKET_TYPE])
    expect(packets[1].payload).toEqual(Uint8Array.of(0))
    expect(packets[2].clock).toBe(600)
  })

  test('finds the battle results packet without reading other payloads', () => {
    const stream = concat([
      createVersionPacket(),
      createBattleResultsPacket({ commonList: [], playersPublicInfo: {} }),
    ])

    const packet = findBattleResultsPacket(stream)

    expect(packet?.type).toBe(BATTLE_RESULTS_PACKET_TYPE)
    expect(findPacket(stream, 0x99)).toBeNull()
  })

  test('rejects a packet whose payload runs past the stream', () => {
    const packet = createPacket(0x10, Uint8Array.of(0))
    const stream = packet.subarray(0, packet.length - 1)

    expect(() => [...iteratePackets(stream)]).toThrow(ReplayError)
  })
})
