export const CONNECTION_IDLE_MS = 10 * 60 * 1000

/** Camera-off inactivity and confirmed face absence use separate clocks. */
export class ConnectionIdleClock {
  private lastInput: number
  private absentSince: number | null = null
  private camera: boolean | null = null
  constructor(now: number) { this.lastInput = now }
  input(now: number) { this.lastInput = now }
  remaining(now: number, camera: boolean, presence: 'present' | 'absent' | 'unknown') {
    if (camera !== this.camera) {
      this.camera = camera
      this.lastInput = now
      this.absentSince = null
    }
    if (!camera) return Math.max(0, CONNECTION_IDLE_MS - Math.max(0, now - this.lastInput))
    // An unavailable detector is not evidence that the person has left.
    if (presence !== 'absent') { this.absentSince = null; return CONNECTION_IDLE_MS }
    this.absentSince ??= now
    return Math.max(0, CONNECTION_IDLE_MS - Math.max(0, now - this.absentSince))
  }
}
