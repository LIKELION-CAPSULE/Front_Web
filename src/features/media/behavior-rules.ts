import {
  AWAY_MS, DROWSY_BLINK_SCORE, DROWSY_MS, HEAD_TURN_DEGREES, HEAD_TURN_MS, MOMENT_DISPLAY_MS,
  PHONE_MIN_SCORE, PHONE_MIN_STREAK, WAVE_COOLDOWN_MS, WAVE_MIN_AMPLITUDE, WAVE_MIN_REVERSALS,
  WAVE_MIN_SAMPLES, WAVE_OPEN_PALM_RATIO, WAVE_REVERSAL_STEP, WAVE_WINDOW_MS, YAWN_JAW_SCORE, YAWN_MS,
} from './behavior-constants.ts'

export type BehaviorKind = 'away' | 'drowsy' | 'yawn' | 'headTurn' | 'phone' | 'wave'

/** Highest first; used for the overlay order and for choosing which detection the friend reacts to. */
export const behaviorPriority: readonly BehaviorKind[] = ['away', 'drowsy', 'phone', 'headTurn', 'yawn', 'wave']
export const behaviorLabels: Record<BehaviorKind, string> = {
  away: '자리 비움', drowsy: '졸음', yawn: '하품', headTurn: '고개 돌림', phone: '핸드폰', wave: '손 흔들기',
}

export type Point = { x: number; y: number }
/** Face Landmarker output for one frame; yaw is in degrees. */
export type FaceSignal =
  | { present: false }
  | { present: true; eyeBlinkLeft: number; eyeBlinkRight: number; jawOpen: number; yaw: number }
/** Gesture Recognizer output for one frame in pixels; null when no hand was found. */
export type HandSignal = { gesture: string; wrist: Point; palm: Point } | null
/** Each field is present only when that model ran on the frame. */
export type BehaviorInput = { face?: FaceSignal; hand?: HandSignal; phoneScore?: number }

type HandSample = { at: number; x: number; size: number; openPalm: boolean } | { at: number; x: null }

export type BehaviorState = {
  faceMissingSince: number | null
  eyesClosedSince: number | null
  jawOpenSince: number | null
  /** A yawn fires once per continuous open-mouth stretch. */
  yawnArmed: boolean
  turnedSince: number | null
  phoneStreak: number
  hands: HandSample[]
  yawnAt: number | null
  waveAt: number | null
}

export function createBehaviorState(): BehaviorState {
  return {
    faceMissingSince: null, eyesClosedSince: null, jawOpenSince: null, yawnArmed: true,
    turnedSince: null, phoneStreak: 0, hands: [], yawnAt: null, waveAt: null,
  }
}

/**
 * Yaw in degrees from MediaPipe's 4×4 facial transformation matrix (column-major MatrixData).
 * It is the heading of the face's forward axis, so pitch does not leak into it.
 */
export function yawFromMatrix(data: ArrayLike<number>) {
  if (data.length < 16) return 0
  return Math.atan2(data[8]!, data[10]!) * 180 / Math.PI
}

/** Counts left-right direction changes with a dead band so jitter is not a change. */
function reversals(xs: readonly number[], step: number) {
  let anchor = xs[0]!, direction = 0, count = 0
  for (const x of xs) {
    const delta = x - anchor
    if (direction === 0) {
      if (Math.abs(delta) >= step) { direction = Math.sign(delta); anchor = x }
    } else if (Math.sign(delta) === direction) anchor = x
    else if (Math.abs(delta) >= step) { count++; direction = -direction; anchor = x }
  }
  return count
}

export function detectWave(samples: readonly HandSample[], now: number) {
  const recent = samples.filter((sample) => now - sample.at <= WAVE_WINDOW_MS)
  if (recent.length < WAVE_MIN_SAMPLES) return false
  const hands = recent.filter((sample) => sample.x !== null)
  // Open_Palm only has to hold for half the window; fast waving blurs some frames.
  if (hands.filter((sample) => sample.openPalm).length < recent.length * WAVE_OPEN_PALM_RATIO) return false
  const size = hands.reduce((sum, sample) => sum + sample.size, 0) / hands.length
  if (!(size > 0)) return false
  const xs = hands.map((sample) => sample.x)
  if ((Math.max(...xs) - Math.min(...xs)) / size < WAVE_MIN_AMPLITUDE) return false
  return reversals(xs, WAVE_REVERSAL_STEP * size) >= WAVE_MIN_REVERSALS
}

/** Advances the rules with one frame's model outputs. `now` is the frame's capture time. */
export function stepBehavior(previous: BehaviorState, input: BehaviorInput, now: number): BehaviorState {
  const state = { ...previous }
  const { face, hand, phoneScore } = input
  if (face?.present) {
    state.faceMissingSince = null
    const closed = face.eyeBlinkLeft >= DROWSY_BLINK_SCORE && face.eyeBlinkRight >= DROWSY_BLINK_SCORE
    state.eyesClosedSince = closed ? state.eyesClosedSince ?? now : null
    if (face.jawOpen >= YAWN_JAW_SCORE) {
      state.jawOpenSince ??= now
      if (state.yawnArmed && now - state.jawOpenSince >= YAWN_MS) { state.yawnAt = now; state.yawnArmed = false }
    } else {
      state.jawOpenSince = null
      state.yawnArmed = true
    }
    state.turnedSince = Math.abs(face.yaw) >= HEAD_TURN_DEGREES ? state.turnedSince ?? now : null
  } else if (face) {
    state.faceMissingSince ??= now
    state.eyesClosedSince = null
    state.jawOpenSince = null
    state.yawnArmed = true
    // turnedSince is kept: a face turned far enough to be lost is still a head turn until it counts as away.
  }
  if (hand !== undefined) {
    const sample: HandSample = hand
      ? { at: now, x: hand.palm.x, size: Math.hypot(hand.palm.x - hand.wrist.x, hand.palm.y - hand.wrist.y), openPalm: hand.gesture === 'Open_Palm' }
      : { at: now, x: null }
    state.hands = [...previous.hands.filter((item) => now - item.at < WAVE_WINDOW_MS), sample]
    if ((state.waveAt === null || now - state.waveAt >= WAVE_COOLDOWN_MS) && detectWave(state.hands, now)) {
      state.waveAt = now
      state.hands = []
    }
  }
  if (phoneScore !== undefined) state.phoneStreak = phoneScore >= PHONE_MIN_SCORE ? previous.phoneStreak + 1 : 0
  return state
}

/** Every rule that holds at `now`, highest priority first. */
export function activeBehaviors(state: BehaviorState, now: number): BehaviorKind[] {
  const held = (since: number | null, duration: number) => since !== null && now - since >= duration
  const shown = (at: number | null) => at !== null && now - at < MOMENT_DISPLAY_MS
  const away = held(state.faceMissingSince, AWAY_MS)
  const active: Record<BehaviorKind, boolean> = {
    away,
    drowsy: held(state.eyesClosedSince, DROWSY_MS),
    phone: state.phoneStreak >= PHONE_MIN_STREAK,
    headTurn: !away && held(state.turnedSince, HEAD_TURN_MS),
    yawn: shown(state.yawnAt),
    wave: shown(state.waveAt),
  }
  return behaviorPriority.filter((kind) => active[kind])
}
