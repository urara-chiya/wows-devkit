import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { parseReplayFile, parseReplayFileSync } from '../src/node.js'
import { buildReplay, createBattleResultsPacket, createMeta } from './helpers/replay.js'

const results = {
  commonList: [1, 4624, 1792331479, 1, 12, 0, 'regular', 35, 720, 9, 'armsrace', 0, 15, '', null, 0, 0, 0],
  playersPublicInfo: { 42: [42, 'Alice', 2000008578, 'TAG', 0, -1, 1, 3539908592] },
}

let directory: string | null = null

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = null
})

describe('node entry', () => {
  test('parses a replay from disk asynchronously and synchronously', async () => {
    directory = await mkdtemp(join(tmpdir(), 'wows-replay-'))
    const path = join(directory, 'sample.wowsreplay')
    await writeFile(path, buildReplay(createMeta(), [createBattleResultsPacket(results)]))

    const asyncResult = await parseReplayFile(path)
    const syncResult = parseReplayFileSync(path)

    expect(asyncResult.meta.playerName).toBe('Alice')
    expect(asyncResult.battleResults?.players[0].name).toBe('Alice')
    expect(syncResult.battleResults?.common.durationSec).toBe(720)
  })
})
