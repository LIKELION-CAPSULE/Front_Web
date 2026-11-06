/**
 * Ordering rules for state events (FOCUS/AWAY/RETURN/BREAK) shared by the session sync hook.
 * Motion events never pass through here, so they cannot reset an away escalation or cancel a pending reaction.
 */
export type AwayEscalation = { eventId: number; at: number; intensity: number }
export type EventFlow = { revision: number; away: AwayEscalation | null }

const STATE_EVENTS = new Set(['FOCUS', 'AWAY', 'RETURN', 'BREAK'])

/**
 * Every outgoing event passes here. A state change supersedes earlier reactions and anything but AWAY ends
 * the current absence; motion events (DROWSY, YAWN, WAVE, HEAD_TURN) leave the flow untouched.
 */
export function eventQueued(flow: EventFlow, type: string): EventFlow {
  if (!STATE_EVENTS.has(type)) return flow
  return { revision: flow.revision + 1, away: type === 'AWAY' ? flow.away : null }
}

/** API 19: 1 when noticed, 2 after a minute away, 3 after five minutes. */
export function awayIntensity(elapsedMs: number) {
  return elapsedMs >= 300_000 ? 3 : elapsedMs >= 60_000 ? 2 : 1
}

/** Returns the intensity to request when the absence has grown, or null when nothing changed. */
export function escalateAway(flow: EventFlow, now: number): { flow: EventFlow; intensity: number | null } {
  const away = flow.away
  if (!away) return { flow, intensity: null }
  const intensity = awayIntensity(now - away.at)
  if (intensity <= away.intensity) return { flow, intensity: null }
  return { flow: { ...flow, away: { ...away, intensity } }, intensity }
}

/** A reaction line that arrived while a chat reply was still coming in or typing. */
export type HeldReaction<T> = { value: T; heldAt: number }

/** A held line older than this no longer fits the moment it answered and is dropped. */
export const REACTION_HOLD_MS = 30_000

/**
 * Takes the oldest held reaction that is still current, dropping stale and expired ones before it.
 * Lines leave one at a time so each finishes typing before the next starts.
 */
export function takeHeldReaction<T>(held: readonly HeldReaction<T>[], now: number, current: (value: T) => boolean): { next: T | null; rest: HeldReaction<T>[] } {
  for (let index = 0; index < held.length; index++) {
    const item = held[index]!
    if (now - item.heldAt <= REACTION_HOLD_MS && current(item.value)) return { next: item.value, rest: held.slice(index + 1) }
  }
  return { next: null, rest: [] }
}
