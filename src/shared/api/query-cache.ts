type Entry = { task: Promise<unknown>; pending: boolean; expiresAt: number }

/** Per-provider memory cache. Invalidated requests may finish but cannot refill the cache. */
export class QueryCache {
  private readonly entries = new Map<string, Entry>()
  private readonly now: () => number

  constructor(now = Date.now) { this.now = now }

  load<T>(key: string, fetcher: () => Promise<T>, maxAgeMs: number): Promise<T> {
    const cached = this.entries.get(key)
    if (cached && (cached.pending || cached.expiresAt > this.now())) return cached.task as Promise<T>
    const entry: Entry = { task: Promise.resolve(), pending: true, expiresAt: 0 }
    entry.task = Promise.resolve().then(fetcher).then(value => {
      if (this.entries.get(key) === entry) {
        entry.pending = false
        entry.expiresAt = this.now() + maxAgeMs
        if (maxAgeMs <= 0) this.entries.delete(key)
      }
      return value
    }, reason => {
      if (this.entries.get(key) === entry) this.entries.delete(key)
      throw reason
    })
    this.entries.set(key, entry)
    return entry.task as Promise<T>
  }

  invalidate(key: string) { this.entries.delete(key) }
  clear() { this.entries.clear() }
}
