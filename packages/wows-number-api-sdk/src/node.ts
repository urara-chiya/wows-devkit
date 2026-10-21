import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CacheStorage } from './cache.js'

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

/**
 * File-backed cache using one JSON file per key.
 *
 * Writes go to a temporary file and are renamed into place, so a crash cannot
 * leave a truncated cache behind.
 */
export class FileStorage implements CacheStorage {
  readonly directory: string

  constructor(directory: string) {
    this.directory = directory
  }

  private pathFor(key: string): string {
    const safe = key.replace(/[^a-z0-9._-]+/gi, '_')
    return join(this.directory, `${safe}.json`)
  }

  async get(key: string): Promise<string | null> {
    try {
      return await readFile(this.pathFor(key), 'utf8')
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
  }

  async set(key: string, value: string): Promise<void> {
    const target = this.pathFor(key)
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`

    await mkdir(this.directory, { recursive: true })
    try {
      await writeFile(temporary, value, 'utf8')
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }
}
