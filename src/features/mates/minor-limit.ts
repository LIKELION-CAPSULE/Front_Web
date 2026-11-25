import { useEffect, useRef } from 'react'
import { showConnectionNotice } from './connection-notice.ts'

/**
 * Under-19 daily connection limit (API 16 · 17 · 21 `minorRemainingSeconds`, 3 hours a day from 05:00 KST). The call
 * screen ends the connection itself when the time runs out (22 `endType: MINOR_LIMIT`); the server does not.
 */
/**
 * API 16 · 17 · 21 `minorRemainingSeconds` (under 19 only; null otherwise) as a local deadline (epoch ms): measured from
 * the response's `serverTime` mapped onto this clock (`serverOffsetMs`), or from `receivedAt` without one. Null when the
 * user has no limit or the value is unusable.
 */
export function minorDeadlineOf(remaining: unknown, serverTime: string | undefined, serverOffsetMs: number | undefined, receivedAt: number | null) {
  if (typeof remaining !== 'number' || !Number.isFinite(remaining)) return null
  const server = serverTime ? Date.parse(serverTime) : NaN
  const base = Number.isFinite(server) ? server - (serverOffsetMs ?? 0) : receivedAt
  return base === null ? null : base + Math.max(0, remaining) * 1000
}

export const MINOR_LIMIT_WARNING_SECONDS = 10 * 60
/** A failed end is tried again after this long (never two at once; `finish` also refuses while one is running). */
export const MINOR_LIMIT_RETRY_MS = 5000
export const MINOR_LIMIT_COPY = {
  warning: '오늘 연결할 수 있는 시간이 10분 남았어요.',
  reached: '오늘 연결할 수 있는 시간(하루 3시간)을 다 썼어요. 연결을 마치고 기록으로 갈게요.',
} as const

export type MinorLimitState = { connectionId: string | null; warned: boolean; lastAttemptAt: number | null; attempts: number }
export type MinorLimitStep = { state: MinorLimitState; warn: boolean; end: boolean }

/**
 * One step of the limit for the running connection: `warn` once when 10 minutes or less are left, `end` when none are
 * left — once, then again only after `MINOR_LIMIT_RETRY_MS` if the connection is still running (the first end failed).
 * `busy`: an end is already on its way (the hang-up), so nothing new starts.
 */
export function minorLimitStep(previous: MinorLimitState, input: { connectionId: string | null; deadline: number | null; now: number; busy: boolean }): MinorLimitStep {
  let state = previous.connectionId === input.connectionId ? previous : { connectionId: input.connectionId, warned: false, lastAttemptAt: null, attempts: 0 }
  if (!input.connectionId || input.deadline === null) return { state, warn: false, end: false }
  const left = (input.deadline - input.now) / 1000
  let warn = false
  if (!state.warned && left > 0 && left <= MINOR_LIMIT_WARNING_SECONDS) { state = { ...state, warned: true }; warn = true }
  if (left > 0 || input.busy) return { state, warn, end: false }
  if (state.lastAttemptAt !== null && input.now - state.lastAttemptAt < MINOR_LIMIT_RETRY_MS) return { state, warn, end: false }
  return { state: { ...state, warned: true, lastAttemptAt: input.now, attempts: state.attempts + 1 }, warn: false, end: true }
}

/** The call screen's limit: notices through `ConnectionNotice`, and `endConnection` (→ 22 `MINOR_LIMIT`) at zero. */
export function useMinorLimit({ connectionId, deadline, now, busy, endConnection }: {
  connectionId: string | null
  deadline: number | null
  now: number
  busy: boolean
  endConnection: () => void
}) {
  const state = useRef<MinorLimitState>({ connectionId: null, warned: false, lastAttemptAt: null, attempts: 0 })
  const end = useRef(endConnection)
  useEffect(() => { end.current = endConnection })
  useEffect(() => {
    const step = minorLimitStep(state.current, { connectionId, deadline, now, busy })
    if (!step.end) {
      state.current = step.state
      if (step.warn) showConnectionNotice(MINOR_LIMIT_COPY.warning, 'warning')
      return
    }
    // The end starts after this commit, cancelled with the effect: an effect run that is undone right away (StrictMode,
    // a re-render on entering the call) must not start a hang-up that its cleanup then cancels halfway.
    const timer = setTimeout(() => {
      state.current = step.state
      // Only the first attempt says so; a retry after a failure stays quiet (the error shows in the leave dialog).
      if (step.state.attempts === 1) showConnectionNotice(MINOR_LIMIT_COPY.reached, 'warning')
      end.current()
    }, 0)
    return () => clearTimeout(timer)
  }, [connectionId, deadline, now, busy])
}
