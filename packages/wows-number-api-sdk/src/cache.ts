type MaybePromise<T> = T | Promise<T>

/** Minimal async/sync key-value store used for the expected-values cache. */
export interface CacheStorage {
  get(key: string): MaybePromise<string | null | undefined>
  set(key: string, value: string): MaybePromise<void>
  delete?(key: string): MaybePromise<void>
}

/** In-process cache, suitable as the default for short-lived clients. */
export class MemoryStorage implements CacheStorage {
  private readonly entries = new Map<string, string>()

  get(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  set(key: string, value: string): void {
    this.entries.set(key, value)
  }

  delete(key: string): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }
}

/** The subset of the Web Storage API the adapter needs. */
export interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Wraps `localStorage` or `sessionStorage`. */
export function createWebStorage(storage: WebStorageLike): CacheStorage {
  return {
    get: (key) => storage.getItem(key),
    set: (key, value) => storage.setItem(key, value),
    delete: (key) => storage.removeItem(key),
  }
}
