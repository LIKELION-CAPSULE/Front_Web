/** API 18 state events the camera produces (`IDLE_TALK` is the talk timer's, idle-talk.ts). */
export type StateEvent = { type: 'PRESENT' | 'AWAY' | 'RETURN'; occurredAt: string }
export type Presence = 'present' | 'absent' | 'unknown' | 'off'
export type PresenceTotals = {
  connectedSeconds: number
  presentSeconds: number
  cameraOnSeconds: number
  pipSeconds: number
  /** Confirmed absence while the camera was on (front-end only; the server counts its own from events). */
  awaySeconds: number
  returns: number
}
export type PresenceBaseline = { presentSeconds: number; cameraOnSeconds: number; pipSeconds: number }

/** A face unseen this long is an absence (API 18 `AWAY`). */
export const AWAY_AFTER_MS = 10_000

/**
 * API 18 · 21 · 22 (2026-11-25). `presentSeconds` is「카메라가 켜져 있고 얼굴이 보인 시간」, so it is counted on its own,
 * never derived from camera time:
 *
 * - Every interval between two samples counts by the state at its start (the previous sample).
 * - `cameraOnSeconds`: the camera was on (any presence but `off`).
 * - `presentSeconds`: a face was seen (`present`).
 * - `unknown` (detector stalled, tab hidden without PiP) is camera time, but never face time.
 * - 10-second grace: while a face is missing (`absent`) for less than `AWAY_AFTER_MS`, that time is held aside. If the
 *   face comes back within the grace, the held time counts as present (a glance away is not an absence).
 * - Confirmed absence is retroactive: once the face has been missing for `AWAY_AFTER_MS`, `AWAY` is sent dated when it
 *   was last seen, and the held grace time is dropped, so the whole absence counts as away and none of it as present.
 * - `unknown`, camera off or a pause in the middle of the grace drops the held time too (the face was not confirmed).
 * - `PRESENT` when a face starts being seen (first time, after the camera comes back on, after a pause); `RETURN` when
 *   it comes back after a confirmed absence. Camera off never sends `AWAY`; an open absence just closes.
 *
 * Totals are whole seconds and always satisfy the server check `0 ≤ present ≤ cameraOn ≤ connected`, `pip ≤ connected`.
 */
export class PresenceClock {
  private readonly base: PresenceBaseline
  private last: number | null = null
  private cameraOn = 0
  private present = 0
  private pip = 0
  /** Unconfirmed absence time, counted as present only if the face returns within the grace. */
  private grace = 0
  private away = 0
  private missing: { at: number; connected: number } | null = null
  private confirmed = false
  private seen = false
  private returns = 0
  private previous: { running: boolean; presence: Presence; pip: boolean } = { running: false, presence: 'off', pip: false }
  constructor(base: Partial<PresenceBaseline> = {}) {
    const value = (input: number | undefined) => Math.max(0, Number.isFinite(input) ? input! : 0)
    const cameraOnSeconds = value(base.cameraOnSeconds)
    this.base = { cameraOnSeconds, presentSeconds: Math.min(cameraOnSeconds, value(base.presentSeconds)), pipSeconds: value(base.pipSeconds) }
  }
  /**
   * `connected`: connection seconds now. `running`: the connection is counting (not paused). `pip`: the PiP window is open.
   * Returns the state events to send, in order.
   */
  sample(connected: number, now: number, presence: Presence, running = true, pip = false): StateEvent[] {
    const events: StateEvent[] = []
    const emit = (type: StateEvent['type'], at = now) => events.push({ type, occurredAt: new Date(at).toISOString() })
    const step = this.last === null ? 0 : Math.max(0, connected - this.last)
    this.last = connected
    const before = this.previous
    if (before.running) {
      if (before.presence !== 'off') this.cameraOn += step
      if (before.presence === 'present') this.present += step
      else if (before.presence === 'absent' && !this.confirmed) this.grace += step
      if (before.pip) this.pip += step
    }
    this.previous = { running, presence, pip }
    const close = () => {
      if (this.confirmed && this.missing) this.away += Math.max(0, connected - this.missing.connected)
      this.missing = null; this.confirmed = false; this.grace = 0
    }
    // A pause closes the current interval; the next face is a new PRESENT.
    if (!running) { close(); this.seen = false; return events }
    if (presence === 'off') { close(); this.seen = false; return events }
    if (presence === 'unknown') {
      if (!this.confirmed) { this.missing = null; this.grace = 0 }
      return events
    }
    if (presence === 'absent') {
      this.missing ??= { at: now, connected }
      if (!this.confirmed && now - this.missing.at >= AWAY_AFTER_MS) {
        // Retroactive: the absence began when the face was last seen; the grace held so far is not presence.
        this.confirmed = true
        this.grace = 0
        emit('AWAY', this.missing.at)
      }
      return events
    }
    if (this.confirmed) { emit('RETURN'); this.returns++ }
    else {
      // Back within the grace: the glance away counts as present.
      this.present += this.grace
      if (!this.seen) emit('PRESENT')
    }
    this.seen = true
    close()
    return events
  }
  /** Whole seconds for 21 · 22. */
  totals(connected: number): PresenceTotals {
    const connectedSeconds = Math.max(0, Math.floor(connected))
    const openAway = this.confirmed && this.missing ? Math.max(0, connected - this.missing.connected) : 0
    const cameraOnSeconds = Math.min(connectedSeconds, Math.floor(this.base.cameraOnSeconds + this.cameraOn))
    return {
      connectedSeconds,
      cameraOnSeconds,
      presentSeconds: Math.max(0, Math.min(cameraOnSeconds, Math.floor(this.base.presentSeconds + this.present))),
      pipSeconds: Math.min(connectedSeconds, Math.floor(this.base.pipSeconds + this.pip)),
      awaySeconds: this.away + openAway,
      returns: this.returns,
    }
  }
}
