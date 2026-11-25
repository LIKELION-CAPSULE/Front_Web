import type { TalkFrequency } from './motion-events'

/**
 * 「먼저 말 걸기」 (settings T-1 「말 걸기 빈도」, the stage's segment): when the user has sent nothing for a while, the
 * mate speaks up first — API 18 `IDLE_TALK`, then its line from API 19 on the usual reaction path (use-session-sync.ts).
 * 자주: after 1 minute of quiet, 가끔: 3 minutes, 조용히: never.
 */
export const IDLE_TALK_EVENT = 'IDLE_TALK'
export const IDLE_TALK_AFTER_MS: Readonly<Record<TalkFrequency, number | null>> = { quiet: null, sometimes: 180_000, often: 60_000 }

export type IdleTalkInput = {
  talk: TalkFrequency
  /** The connection is running (not ending or over). */
  live: boolean
  /**
   * Someone is talking or about to: the user's message on its way (API 28) or their voice being heard, the mate's reply
   * coming in or still typing, another event's reaction on its way or typing, or this timer's own line.
   */
  busy: boolean
  /** The camera is on: absence is judged only then. */
  camera: boolean
  /** The user is away (AWAY sent, no RETURN yet). */
  away: boolean
  /** The call is on screen (the page, or its PIP window while the page is hidden). */
  visible: boolean
}

/**
 * Counts the quiet since the last talk ended. Anything that blocks it (above) also resets it, so the count starts over
 * once the mate's reply, a reaction (the welcome back included) or its own line has finished. With the camera off there
 * is no away judgement, so it keeps counting. A changed frequency applies on the next step.
 */
export class IdleTalkTimer {
  private since: number | null = null

  /** Moves the clock to `now`; true when the mate should speak up now (the count then starts over after her line). */
  step(now: number, input: IdleTalkInput): boolean {
    const wait = IDLE_TALK_AFTER_MS[input.talk]
    if (wait === null || !input.live || input.busy || (input.camera && input.away) || !input.visible) {
      this.since = null
      return false
    }
    if (this.since === null) { this.since = now; return false }
    if (now - this.since < wait) return false
    this.since = null
    return true
  }

  /** When the current quiet started (null: not counting). */
  get countingSince() { return this.since }

  clear() { this.since = null }
}
