import { inflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { ReplayError } from '../src/errors.js'
import { parseReplay } from '../src/replay.js'
import {
  buildReplay,
  createBattleResultsPacket,
  createMeta,
  createPacket,
  createVersionPacket,
} from './helpers/replay.js'

const inflate = (data: Uint8Array) => inflateSync(data)

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn()
    return undefined
  } catch (error) {
    return error instanceof ReplayError ? error.code : undefined
  }
}

const results = {
  accountDBID: 42,
  arenaUniqueID: 99,
  commonList: [99, 4624, 1792331479, 1, 12, 0, 'regular', 35, 720, 9, 'armsrace', 0, 15, '', null, 0, 0, 0],
  playersPublicInfo: {
    42: [42, 'Alice', 2000008578, 'TAG', 0, -1, 1, 3539908592],
  },
}

describe('parseReplay', () => {
  test('parses metadata and battle results end to end', () => {
    const replay = buildReplay(createMeta(), [
      createVersionPacket(),
      createPacket(0x10, Uint8Array.of(0)),
      createBattleResultsPacket(results),
    ])

    const parsed = parseReplay(replay, { inflate })

    expect(parsed.meta.playerName).toBe('Alice')
    expect(parsed.battleResults).not.toBeNull()
    expect(parsed.battleResults?.players[0]).toMatchObject({ accountId: 42, name: 'Alice' })
    expect(parsed.battleResults?.common.winnerTeamId).toBe(1)
  })

  test('returns null when a finished replay has no results packet', () => {
    const replay = buildReplay(createMeta(), [createVersionPacket()])
    expect(parseReplay(replay, { inflate }).battleResults).toBeNull()
  })

  test('rejects replays older than 12.6.0', () => {
    const replay = buildReplay(createMeta({ clientVersionFromExe: '12,5,0,1' }), [createVersionPacket('12,5,0,1')])
    expect(errorCode(() => parseReplay(replay, { inflate }))).toBe('UNSUPPORTED_VERSION')
  })

  test('rejects a decompressed stream that disagrees with the header', () => {
    const replay = buildReplay(createMeta(), [createVersionPacket()])
    const view = new DataView(replay.buffer, replay.byteOffset, replay.byteLength)
    const metaLength = view.getUint32(8, true)
    view.setUint32(12 + metaLength, 1, true)

    expect(errorCode(() => parseReplay(replay, { inflate }))).toBe('INVALID_PACKET_STREAM')
  })
})
