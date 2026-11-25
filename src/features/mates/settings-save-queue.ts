import type { UserSettings, UserSettingsPatch } from '../../shared/api/types.ts'

export type SettingsSaveStatus = 'idle' | 'saving' | 'error'
type Key = keyof UserSettings
type Timers = { set: (callback: () => void, ms: number) => unknown; clear: (timer: unknown) => void }

/**
 * One account's server copy of the settings (API 29 · 30), kept consistent with what the user changes:
 *
 * - Every change marks its keys dirty with a new revision; a key leaves the dirty set only when a PATCH carrying that
 *   revision (or a newer one) succeeded.
 * - PATCHes go one at a time, in order (never two in flight, so they cannot arrive reversed). Changes made while one
 *   is on its way are sent right after it.
 * - A failed PATCH keeps its keys dirty: they go out again, merged with the newest values, on the next change, after
 *   `retryDelayMs` (once), or on `retry()` (the settings tab's 「다시 저장」). The status says `error` until then.
 * - The GET (`load`) never overwrites a key the user changed after it was sent, nor one still unsaved.
 * - `flushNow()` sends what is waiting at once (before signing out). `dispose()` drops everything (another account).
 */
export class SettingsSaveQueue {
  private readonly dirty = new Map<Key, { value: UserSettingsPatch[Key]; revision: number }>()
  private touchedSinceLoad: Set<Key> | null = null
  private revision = 0
  private inFlight: Promise<boolean> | null = null
  private again = false
  private timer: unknown = null
  private retryTimer: unknown = null
  /** The one automatic retry of a failure streak was used (reset by a success or a new change). */
  private autoRetried = false
  private disposed = false
  status: SettingsSaveStatus = 'idle'
  private readonly save: (body: UserSettingsPatch) => Promise<unknown>
  private readonly fetch: () => Promise<UserSettings>
  private readonly applyServer: (value: UserSettings) => void
  private readonly onStatus: (status: SettingsSaveStatus) => void
  private readonly delayMs: number
  private readonly retryDelayMs: number
  private readonly timers: Timers

  constructor(options: {
    save: (body: UserSettingsPatch) => Promise<unknown>
    load: () => Promise<UserSettings>
    /** Server values to show; keys the user changed meanwhile are already left out. */
    applyServer: (value: UserSettings) => void
    onStatus?: (status: SettingsSaveStatus) => void
    delayMs?: number
    retryDelayMs?: number
    timers?: Timers
  }) {
    this.save = options.save
    this.fetch = options.load
    this.applyServer = options.applyServer
    this.onStatus = options.onStatus ?? (() => {})
    this.delayMs = options.delayMs ?? 600
    this.retryDelayMs = options.retryDelayMs ?? 10_000
    this.timers = options.timers ?? { set: (callback, ms) => setTimeout(callback, ms), clear: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) }
  }

  /** Reads the server copy (29) and shows the keys nobody changed meanwhile. */
  async load() {
    const touched = new Set<Key>()
    this.touchedSinceLoad = touched
    try {
      const value = await this.fetch()
      if (this.disposed || !value) return
      const fresh = Object.fromEntries(Object.entries(value).filter(([key]) => !touched.has(key as Key) && !this.dirty.has(key as Key))) as UserSettings
      this.applyServer(fresh)
    } catch { /* The browser copy stays. */ }
    finally { if (this.touchedSinceLoad === touched) this.touchedSinceLoad = null }
  }

  /** The user changed these server keys. */
  change(body: UserSettingsPatch) {
    if (this.disposed) return
    const keys = Object.keys(body) as Key[]
    if (!keys.length) return
    this.autoRetried = false
    for (const key of keys) {
      this.dirty.set(key, { value: body[key], revision: ++this.revision })
      this.touchedSinceLoad?.add(key)
    }
    this.schedule(this.delayMs)
  }

  /** 「다시 저장」: sends the unsaved keys now. */
  retry() { return this.flushNow() }

  /** Sends what is waiting at once (before signing out); resolves when nothing is left or a save failed. */
  async flushNow() {
    this.clearTimers()
    await this.flush()
  }

  /** Another account or sign-out completed: nothing more is sent or shown. */
  dispose() {
    this.disposed = true
    this.clearTimers()
    this.dirty.clear()
  }

  get pending() { return this.dirty.size > 0 || this.inFlight !== null }

  private schedule(ms: number) {
    if (this.timer !== null) this.timers.clear(this.timer)
    this.timer = this.timers.set(() => { this.timer = null; void this.flush() }, ms)
  }

  private clearTimers() {
    if (this.timer !== null) this.timers.clear(this.timer)
    if (this.retryTimer !== null) this.timers.clear(this.retryTimer)
    this.timer = null
    this.retryTimer = null
  }

  private setStatus(status: SettingsSaveStatus) {
    if (this.status === status || this.disposed) return
    this.status = status
    this.onStatus(status)
  }

  private async flush(): Promise<void> {
    if (this.disposed) return
    if (this.inFlight) {
      this.again = true
      await this.inFlight
      return
    }
    if (!this.dirty.size) { this.setStatus('idle'); return }
    const sent = new Map(this.dirty)
    const body = Object.fromEntries([...sent].map(([key, entry]) => [key, entry.value])) as UserSettingsPatch
    this.setStatus('saving')
    const task = this.save(body).then(() => true, () => false)
    this.inFlight = task
    const ok = await task
    this.inFlight = null
    if (this.disposed) return
    if (ok) {
      this.autoRetried = false
      for (const [key, entry] of sent) if ((this.dirty.get(key)?.revision ?? Infinity) <= entry.revision) this.dirty.delete(key)
    }
    const queued = this.again
    this.again = false
    if (!ok) {
      this.setStatus('error')
      // One automatic retry later; after that, the next change or 「다시 저장」.
      if (this.retryTimer === null && !queued && !this.autoRetried) {
        this.autoRetried = true
        this.retryTimer = this.timers.set(() => { this.retryTimer = null; void this.flush() }, this.retryDelayMs)
      }
      if (!queued) return
    }
    if (this.dirty.size && (ok || queued)) return this.flush()
    this.setStatus('idle')
  }
}
