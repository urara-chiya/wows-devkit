import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileStorage } from '../src/node'

const directories: string[] = []

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'wows-number-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('FileStorage', () => {
  it('round-trips values by key', async () => {
    const storage = new FileStorage(await tempDirectory())

    await storage.set('a', 'one')
    await storage.set('b', 'two')

    await expect(storage.get('a')).resolves.toBe('one')
    await expect(storage.get('b')).resolves.toBe('two')
    await expect(storage.get('missing')).resolves.toBeNull()
  })

  it('deletes a value', async () => {
    const storage = new FileStorage(await tempDirectory())

    await storage.set('key', 'value')
    await storage.delete('key')

    await expect(storage.get('key')).resolves.toBeNull()
  })

  it('sanitizes keys instead of escaping the directory', async () => {
    const directory = await tempDirectory()
    const storage = new FileStorage(directory)

    await storage.set('../outside', 'value')

    await expect(storage.get('../outside')).resolves.toBe('value')
    await expect(storage.get('.._outside')).resolves.toBe('value')
  })
})
