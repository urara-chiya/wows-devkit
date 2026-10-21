import { describe, expect, test } from 'vitest'
import { REPLAY_MAGIC, parseReplayMeta, readReplayContainer } from '../src/container.js'
import { ReplayError } from '../src/errors.js'
import { buildReplay, createBattleResultsPacket, createMeta } from './helpers/replay.js'

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn()
    return undefined
  } catch (error) {
    return error instanceof ReplayError ? error.code : undefined
  }
}

describe('replay container', () => {
  test('reads metadata without touching the packet stream', () => {
    const meta = createMeta()
    const replay = buildReplay(meta, [createBattleResultsPacket({ commonList: [], playersPublicInfo: {} })])
    const container = readReplayContainer(replay)

    expect(container.meta.playerName).toBe('Alice')
    expect(container.meta.vehicles).toHaveLength(1)
    expect(container.meta.version).toMatchObject({ major: 15, minor: 9, patch: 0, build: 13357625 })
    expect(container.compressedSize).toBeGreaterThan(0)
    expect(container.packetStream.length).toBe(container.compressedSize)
  })

  test('parseReplayMeta returns only the metadata', () => {
    const meta = parseReplayMeta(buildReplay(createMeta(), []))
    expect(meta.mapDisplayName).toBe('22_tierra_del_fuego')
  })

  test('rejects an invalid magic value', () => {
    const replay = buildReplay(createMeta(), [])
    replay[0] = 0

    expect(errorCode(() => parseReplayMeta(replay))).toBe('INVALID_MAGIC')
  })

  test('rejects a truncated metadata block', () => {
    const replay = buildReplay(createMeta(), [])
    expect(errorCode(() => parseReplayMeta(replay.subarray(0, 20)))).toBe('TRUNCATED')
  })

  test('rejects metadata that is not JSON', () => {
    const meta = new TextEncoder().encode('not json')
    const replay = new Uint8Array(12 + meta.length + 8)
    const view = new DataView(replay.buffer)
    view.setUint32(0, REPLAY_MAGIC, true)
    view.setUint32(4, 1, true)
    view.setUint32(8, meta.length, true)
    replay.set(meta, 12)

    expect(errorCode(() => parseReplayMeta(replay))).toBe('INVALID_METADATA')
  })
})
