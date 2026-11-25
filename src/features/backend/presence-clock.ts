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

const AWAY_AFTER_MS = 10_000

/**
 * API 18 · 21 · 22 policy (2026-11-25):
 * - `PRESENT` when a face starts being seen (first time, or after the camera comes back on);
 * - `AWAY` after 10 continuous seconds unseen, dated when the face was last seen; `RETURN` when it is seen again;
 * - camera off never sends `AWAY` (an open absence just closes).
 * Totals, all counted from connection time so `0 ≤ present ≤ cameraOn ≤ connected` and `pip ≤ connected` always hold:
 * `cameraOnSeconds` while the camera runs, `presentSeconds` = camera time minus confirmed absences, `pipSeconds` while
 * the Picture-in-Picture window is open.
 */
export class PresenceClock {
  private readonly base: PresenceBaseline
  private last: number | null = null
  private cameraOn = 0
  private pip = 0
  private away = 0
  private missing: { at: number; connected: number } | null = null
  private confirmed = false
  private seen = false
  private returns = 0
  private previous = { running: false, camera: false, pip: false }
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
    // Each interval counts by the state at its start (the previous sample).
    const step = this.last === null ? 0 : Math.max(0, connected - this.last)
    this.last = connected
    if (this.previous.running && this.previous.camera) this.cameraOn += step
    if (this.previous.running && this.previous.pip) this.pip += step
    this.previous = { running, camera: presence !== 'off', pip }
    const close = () => {
      if (this.confirmed && this.missing) this.away += Math.max(0, connected - this.missing.connected)
      this.missing = null; this.confirmed = false
    }
    // A pause closes the current interval; the next face is a new PRESENT.
    if (!running) { close(); this.seen = false; return events }
    if (presence === 'off') { close(); this.seen = false; return events }
    if (presence === 'unknown') { if (!this.confirmed) this.missing = null; return events }
    if (presence === 'absent') {
      this.missing ??= { at: now, connected }
      if (!this.confirmed && now - this.missing.at >= AWAY_AFTER_MS) { this.confirmed = true; emit('AWAY', this.missing.at) }
      return events
    }
    if (this.confirmed) { emit('RETURN'); this.returns++ }
    else if (!this.seen) emit('PRESENT')
    this.seen = true
    close()
    return events
  }
  /** Whole seconds for 21 · 22. */
  totals(connected: number): PresenceTotals {
    const connectedSeconds = Math.max(0, Math.floor(connected))
    const openAway = this.confirmed && this.missing ? Math.max(0, connected - this.missing.connected) : 0
    const cameraOn = this.base.cameraOnSeconds + this.cameraOn
    const cameraOnSeconds = Math.min(connectedSeconds, Math.floor(cameraOn))
    const present = this.base.presentSeconds + Math.max(0, this.cameraOn - this.away - openAway)
    return {
      connectedSeconds,
      cameraOnSeconds,
      presentSeconds: Math.max(0, Math.min(cameraOnSeconds, Math.floor(present))),
      pipSeconds: Math.min(connectedSeconds, Math.floor(this.base.pipSeconds + this.pip)),
      awaySeconds: this.away + openAway,
      returns: this.returns,
    }
  }
}
