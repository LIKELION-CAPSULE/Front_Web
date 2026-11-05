import type { ExpressionRef } from '../../shared/api/types.ts'
import {
  EXPRESSION_MIN_HOLD_MS, NOTICE_HOLD_MS, SPEECH_HOLD_BASE_MS, SPEECH_HOLD_MAX_MS, SPEECH_HOLD_MIN_MS, SPEECH_HOLD_PER_LETTER_MS,
} from './live2d-constants.ts'

/** State changes outrank lines, and lines outrank momentary gestures. */
export type ExpressionPriority = 'motion' | 'speech' | 'state'
const rank: Record<ExpressionPriority, number> = { motion: 1, speech: 2, state: 3 }

/** `sticky` holds until the next state event; `release` ends a sticky face without showing a new one. */
export type ExpressionHold = { ms: number } | 'sticky' | 'release'
export type ExpressionRequest = { file: string | null; priority: ExpressionPriority; hold: ExpressionHold }

type Shown = { file: string; priority: ExpressionPriority; since: number; until: number | null }
export type ExpressionSchedule = { shown: Shown | null; pending: ExpressionRequest | null }
/** `file` is the expression to fade to; `null` fades back to the default face. */
export type ExpressionCommand = { file: string | null }

const STATE_EVENTS = new Set(['FOCUS', 'AWAY', 'RETURN', 'BREAK'])

/** Where a server expression came from: an event's immediate response (18), its line (19), or a chat reply (20). */
export type ExpressionCue = {
  characterId: number
  expression: ExpressionRef | null | undefined
  event: string
  stage: 'notice' | 'speech'
  text?: string
}

export function createExpressionSchedule(): ExpressionSchedule {
  return { shown: null, pending: null }
}

/** How long a face that comes with a line stays: long enough to read the bubble. */
export function speechHold(text = '') {
  const letters = Array.from(text.trim()).length
  return Math.min(SPEECH_HOLD_MAX_MS, Math.max(SPEECH_HOLD_MIN_MS, SPEECH_HOLD_BASE_MS + letters * SPEECH_HOLD_PER_LETTER_MS))
}

/**
 * Maps a server cue to a scheduling request. Only the server's `file` is drawn; the emotion name is never interpreted.
 * Chat replies count as lines; state events (and their lines) as state changes; motion events notice at the lowest rank.
 */
export function expressionRequest(cue: ExpressionCue): ExpressionRequest | null {
  const file = cue.expression?.file || null
  if (cue.event === 'MESSAGE') return file ? { file, priority: 'speech', hold: { ms: speechHold(cue.text) } } : null
  if (STATE_EVENTS.has(cue.event)) {
    if (cue.event === 'AWAY') return file ? { file, priority: 'state', hold: 'sticky' } : null
    // A state change without a face still ends the away face it replaces.
    if (cue.stage === 'notice') return { file, priority: 'state', hold: file ? { ms: NOTICE_HOLD_MS } : 'release' }
    return file ? { file, priority: 'state', hold: { ms: speechHold(cue.text) } } : null
  }
  if (!file) return null
  return cue.stage === 'notice'
    ? { file, priority: 'motion', hold: { ms: NOTICE_HOLD_MS } }
    : { file, priority: 'speech', hold: { ms: speechHold(cue.text) } }
}

function current(schedule: ExpressionSchedule, now: number) {
  const shown = schedule.shown
  return shown && (shown.until === null || now < shown.until) ? shown : null
}

function show(request: ExpressionRequest, now: number): { schedule: ExpressionSchedule; command: ExpressionCommand } {
  if (request.hold === 'release' || request.file === null) return { schedule: { shown: null, pending: null }, command: { file: null } }
  const until = request.hold === 'sticky' ? null : now + request.hold.ms
  return { schedule: { shown: { file: request.file, priority: request.priority, since: now, until }, pending: null }, command: { file: request.file } }
}

/**
 * Lower priority never replaces higher; equal or higher replaces, newest first.
 * A face younger than the minimum hold keeps showing and the newcomer waits (only the strongest, latest one waits).
 */
export function requestExpression(schedule: ExpressionSchedule, request: ExpressionRequest, now: number) {
  const active = current(schedule, now)
  // Releasing only ends a face that waits for a state change.
  if (request.hold === 'release' && (!active || active.until !== null)) return { schedule, command: null }
  if (active && rank[request.priority] < rank[active.priority]) return { schedule, command: null }
  if (schedule.pending && rank[request.priority] < rank[schedule.pending.priority]) return { schedule, command: null }
  if (active && now - active.since < EXPRESSION_MIN_HOLD_MS) return { schedule: { ...schedule, pending: request }, command: null }
  return show(request, now)
}

/** Shows a waiting face once the minimum hold passes, or returns to the default face when a timed face ends. */
export function advanceExpression(schedule: ExpressionSchedule, now: number) {
  const active = current(schedule, now)
  if (schedule.pending && (!active || now - active.since >= EXPRESSION_MIN_HOLD_MS)) {
    const pending = schedule.pending
    if (pending.hold === 'release' && (!active || active.until !== null)) return { schedule: { ...schedule, pending: null }, command: null }
    return show(pending, now)
  }
  if (schedule.shown && !active) return { schedule: { shown: null, pending: schedule.pending }, command: { file: null } }
  return { schedule, command: null }
}

/** When the scheduler next needs to run, or null when nothing is waiting or timed. */
export function nextExpressionDeadline(schedule: ExpressionSchedule) {
  const shown = schedule.shown
  if (!shown) return schedule.pending ? 0 : null
  const times = [shown.until, schedule.pending ? shown.since + EXPRESSION_MIN_HOLD_MS : null].filter((value): value is number => value !== null)
  return times.length ? Math.min(...times) : null
}

/** A break or the end of the session drops faces that were waiting; the face on screen keeps its own timing. */
export function cancelPendingExpression(schedule: ExpressionSchedule): ExpressionSchedule {
  return schedule.pending ? { ...schedule, pending: null } : schedule
}
