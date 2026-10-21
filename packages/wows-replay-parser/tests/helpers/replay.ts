import { deflateSync } from 'node:zlib'
import { encryptReplayStream } from '../../src/blowfish.js'
import { REPLAY_MAGIC } from '../../src/container.js'
import type { ReplayMeta, ReplayVehicle } from '../../src/types.js'

export function createMeta(overrides: Partial<ReplayMeta> = {}): ReplayMeta {
  return {
    matchGroup: 'pvp',
    gameMode: 15,
    gameType: 'RandomBattle',
    clientVersionFromExe: '15,9,0,13357625',
    clientVersionFromXml: '15,9,0,13357625',
    mapDisplayName: '22_tierra_del_fuego',
    mapId: 14,
    mapName: 'spaces/22_tierra_del_fuego',
    duration: 1200,
    name: '12x12',
    scenario: 'domination_3point',
    playerID: 0,
    playerName: 'Alice',
    playerVehicle: 'PASC720-Hawaii',
    vehicles: [createVehicle()],
    playersPerTeam: 12,
    teamsCount: 2,
    dateTime: '21.10.2026 00:45:13',
    scenarioConfigId: 217,
    version: null,
    ...overrides,
  }
}

export function createVehicle(overrides: Partial<ReplayVehicle> = {}): ReplayVehicle {
  return { shipId: 3539908592, relation: 0, id: 537004447, name: 'Alice', ...overrides }
}

export function createPacket(type: number, payload: Uint8Array, clock = 0): Uint8Array {
  const packet = new Uint8Array(12 + payload.length)
  writeUint32LE(packet, 0, payload.length)
  writeUint32LE(packet, 4, type)
  new DataView(packet.buffer).setFloat32(8, clock, true)
  packet.set(payload, 12)
  return packet
}

export function createVersionPacket(version = '15,9,0,13357625'): Uint8Array {
  const bytes = new TextEncoder().encode(version)
  const payload = new Uint8Array(4 + bytes.length)
  writeUint32LE(payload, 0, bytes.length)
  payload.set(bytes, 4)
  return createPacket(0x16, payload)
}

export function createBattleResultsPacket(results: unknown): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify(results))
  const payload = new Uint8Array(4 + bytes.length)
  writeUint32LE(payload, 0, bytes.length)
  payload.set(bytes, 4)
  return createPacket(0x22, payload, 600)
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

export function buildReplay(meta: ReplayMeta, packets: Uint8Array[]): Uint8Array {
  const metaJson = new TextEncoder().encode(JSON.stringify(meta))
  const plain = concat(packets)
  const compressed = deflateSync(plain)
  const padded = new Uint8Array(Math.ceil(compressed.length / 8) * 8)
  padded.set(compressed)
  const encrypted = encryptReplayStream(padded)

  const container = new Uint8Array(12 + metaJson.length + 8 + encrypted.length)
  writeUint32LE(container, 0, REPLAY_MAGIC)
  writeUint32LE(container, 4, 1)
  writeUint32LE(container, 8, metaJson.length)
  container.set(metaJson, 12)
  const trailer = 12 + metaJson.length
  writeUint32LE(container, trailer, plain.length)
  writeUint32LE(container, trailer + 4, encrypted.length)
  container.set(encrypted, trailer + 8)
  return container
}

function writeUint32LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff
  buffer[offset + 1] = (value >>> 8) & 0xff
  buffer[offset + 2] = (value >>> 16) & 0xff
  buffer[offset + 3] = (value >>> 24) & 0xff
}
