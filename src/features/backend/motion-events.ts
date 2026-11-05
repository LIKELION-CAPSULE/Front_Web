import { behaviorPriority, type BehaviorKind } from '../media/behavior-rules.ts'

/** Motion events of API 18. They never affect study or away time; phone and away are not sent. */
export type MotionEventType = 'DROWSY' | 'YAWN' | 'WAVE' | 'HEAD_TURN'
export const motionEventTypes: Partial<Record<BehaviorKind, MotionEventType>> = {
  drowsy: 'DROWSY', yawn: 'YAWN', wave: 'WAVE', headTurn: 'HEAD_TURN',
}
/** API 18: the same type at most once a minute (the server ignores repeats too). */
export const MOTION_EVENT_COOLDOWN_MS = 60_000

export type MotionGate = { camera: boolean; phase: 'study' | 'break'; running: boolean; hidden: boolean }
export type MotionCooldowns = Partial<Record<MotionEventType, number>>

/**
 * Picks the motion events to send for detections that just started.
 * Nothing is sent with the camera off, during a break or pause, or from a hidden tab; a skipped event starts no cooldown.
 */
export function pickMotionEvents(sentAt: MotionCooldowns, started: readonly BehaviorKind[], at: number, gate: MotionGate) {
  if (!gate.camera || gate.phase !== 'study' || !gate.running || gate.hidden) return { types: [] as MotionEventType[], sentAt }
  const next = { ...sentAt }
  const types: MotionEventType[] = []
  for (const kind of [...started].sort((a, b) => behaviorPriority.indexOf(a) - behaviorPriority.indexOf(b))) {
    const type = motionEventTypes[kind]
    if (!type || types.includes(type)) continue
    const last = next[type]
    if (last !== undefined && at - last < MOTION_EVENT_COOLDOWN_MS) continue
    next[type] = at
    types.push(type)
  }
  return { types, sentAt: types.length ? next : sentAt }
}
