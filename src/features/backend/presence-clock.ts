export type StateEvent = { type: 'FOCUS' | 'AWAY' | 'RETURN' | 'BREAK'; occurredAt: string }
export type Presence = 'present' | 'absent' | 'unknown' | 'off'

/** API policy: 10 continuous seconds absent; camera off counts as present. */
export class PresenceClock {
  private awaySeconds: number
  private missing: { at: number; study: number } | null = null
  private confirmed = false
  private focusOnResume = false
  private phase: 'study' | 'break' = 'study'
  private returns = 0
  constructor(awaySeconds = 0) { this.awaySeconds = Math.max(0, awaySeconds) }
  sample(studySeconds: number, now: number, presence: Presence, phase: 'study' | 'break', running = true): StateEvent[] {
    const events: StateEvent[] = []
    const emit = (type: StateEvent['type'], at = now) => events.push({ type, occurredAt: new Date(at).toISOString() })
    const close = () => {
      if (this.confirmed && this.missing) this.awaySeconds += Math.max(0, studySeconds - this.missing.study)
      this.missing = null; this.confirmed = false
    }
    if (phase !== this.phase) {
      close(); this.phase = phase; this.focusOnResume = false; emit(phase === 'break' ? 'BREAK' : 'FOCUS')
    }
    // A confirmation pause closes the current interval without inventing a break or return.
    if (!running) { this.focusOnResume ||= this.confirmed; close(); return events }
    // Clear the server's previous AWAY state when study resumes; this is not a physical return.
    if (this.focusOnResume) { this.focusOnResume = false; emit('FOCUS') }
    if (phase === 'break') return events
    if (presence === 'unknown') { if (!this.confirmed) this.missing = null; return events }
    if (presence === 'absent') {
      this.missing ??= { at: now, study: studySeconds }
      if (!this.confirmed && now - this.missing.at >= 10_000) { this.confirmed = true; emit('AWAY', this.missing.at) }
    } else {
      if (this.confirmed) {
        if (presence === 'present') { emit('RETURN'); this.returns++ }
        else emit('FOCUS')
      }
      close()
    }
    return events
  }
  totals(studySeconds: number) {
    const away = Math.min(studySeconds, this.awaySeconds + (this.confirmed && this.missing ? Math.max(0, studySeconds - this.missing.study) : 0))
    return { studySeconds: Math.floor(studySeconds), presentSeconds: Math.max(0, Math.floor(studySeconds - away)), awaySeconds: away, returns: this.returns }
  }
}
