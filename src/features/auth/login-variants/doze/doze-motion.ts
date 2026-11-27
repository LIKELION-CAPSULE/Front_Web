/**
 * Motion for the "졸던 채린 깨우기" login draft (DEV only): pure timelines, no DOM, so Node tests can check them.
 *
 * The v2 player's `track(params)` takes Live2D standard parameter ids in Live2D units (README of the model bundle) and
 * only holds them for a short moment, so the stage sends a pose every frame while it drives the face and simply stops
 * sending to hand the face back to the player (blinking, gaze, expressions).
 */

export type TrackParams = Partial<
  Record<
    'ParamEyeLOpen' | 'ParamEyeROpen' | 'ParamAngleX' | 'ParamAngleY' | 'ParamAngleZ' | 'ParamMouthOpenY',
    number
  >
>

/** Pose of `src/assets/characters/chaerin-v2/chaerin-v2-doze.webp` (eyes shut, head bowed and tilted, lips apart). */
export const DOZE_STILL_POSE = {
  ParamEyeLOpen: 0,
  ParamEyeROpen: 0,
  ParamAngleX: -4,
  ParamAngleY: -30,
  ParamAngleZ: 7,
  ParamMouthOpenY: 0.05,
} as const satisfies TrackParams

export const DOZE_TIMINGS_MS = {
  /** One nod: head jerks up, then slowly sinks again. */
  nodPeriod: 4600,
  /** Live2D wake-up: stir → blinks → yawn → look → smile + greeting. */
  wakeYawnAt: 850,
  wakeYawnEnd: 1650,
  wakeGreetAt: 1800,
  /** Still-image wake-up (no Live2D): doze → yawn → happy crossfades. */
  staticYawnAt: 200,
  staticHappyAt: 1050,
  staticGreetAt: 1450,
  /** Reduced motion: one crossfade straight to the smile. */
  reducedGreetAt: 150,
  /** Falling back asleep (eyes droop, head sinks) before the nod cycle resumes. */
  fallAsleep: 2400,
  /** Wakes up on her own after this long, so nobody misses the greeting. */
  autoWake: 10_000,
  /** The pointer has to stay near her face this long (a cursor passing by does not wake her). */
  nearDwell: 300,
  /** No pointer / keyboard input for this long while awake: she dozes off again. */
  redozeIdle: 60_000,
  /** Tap while awake: shy face this long. */
  shyHold: 1600,
  /** Live2D canvas crossfade over the still once the model is ready. */
  liveFade: 420,
} as const

/**
 * The "tap her" hint over the dozing mate: a UI hint, so in the service's 해요체 like the rest of the screen (UX review
 * 1-5; her own lines stay in the dialogue box). The particle 을/를 follows the name's last syllable.
 */
export function dozeCallLine(name: string): string {
  const last = name.charCodeAt(name.length - 1)
  const hasBatchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0
  return `${name}${hasBatchim ? '을' : '를'} 눌러 깨워 보세요`
}

/** The same hint for a keyboard user. */
export const DOZE_KEY_LINE = 'Enter 키로 깨워 보세요'

/** Just woken: the 앗 owns up to having dozed off (the plain greeting is desktop-config's '왔어? 기다리고 있었어.'). */
export const DOZE_GREETING = '앗, 왔어? 기다리고 있었어.'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t)
const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3
const easeInQuad = (t: number) => clamp01(t) ** 2
const easeInOut = (t: number) => {
  const x = clamp01(t)
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2
}

/** Head angle at the top of a nod (after the jerk) and at the bottom (= the still). */
const NOD_UP_Y = -6
const NOD_DOWN_Y = DOZE_STILL_POSE.ParamAngleY

/**
 * Dozing pose at `t` ms into the nod cycle. `t = 0` is the deepest point, identical to the doze still, so the live
 * model can fade in over the still without a jump. `lean` (0…1, 1 = deepest) drives the small CSS body lean.
 */
export function dozePose(t: number): { params: TrackParams; lean: number } {
  const period = DOZE_TIMINGS_MS.nodPeriod
  const p = (((t % period) + period) % period) / period
  let y: number
  if (p < 0.08) y = lerp(NOD_DOWN_Y, NOD_UP_Y, easeOutCubic(p / 0.08)) // 꾸벅: jerk up
  else if (p < 0.2) y = lerp(NOD_UP_Y, NOD_UP_Y - 2, easeOutCubic((p - 0.08) / 0.12)) // settle
  else y = lerp(NOD_UP_Y - 2, NOD_DOWN_Y, easeInQuad((p - 0.2) / 0.8)) // slowly sinking
  const lean = clamp01((NOD_UP_Y - y) / (NOD_UP_Y - NOD_DOWN_Y))
  // A tiny peek right after the jerk, then the eyes fall shut again.
  const peek = p > 0.03 && p < 0.14 ? Math.sin(((p - 0.03) / 0.11) * Math.PI) * 0.16 : 0
  const drift = Math.sin((t / 9000) * Math.PI * 2) * 2
  return {
    params: {
      ParamEyeLOpen: peek,
      ParamEyeROpen: peek,
      ParamAngleX: DOZE_STILL_POSE.ParamAngleX + drift,
      ParamAngleY: y,
      ParamAngleZ: lerp(3, DOZE_STILL_POSE.ParamAngleZ, lean),
      ParamMouthOpenY: DOZE_STILL_POSE.ParamMouthOpenY * lean,
    },
    lean,
  }
}

/** Piecewise-linear eye openness while waking: two flutters, then open. */
const WAKE_EYES: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [300, 0.18],
  [420, 0],
  [620, 0.62],
  [720, 0.22],
  [850, 0.88],
]

function eyesAt(t: number): number {
  let previous: readonly [number, number] = [0, 0]
  for (const point of WAKE_EYES) {
    if (t <= point[0]) return point[0] === previous[0] ? point[1] : lerp(previous[1], point[1], (t - previous[0]) / (point[0] - previous[0]))
    previous = point
  }
  return previous[1]
}

/**
 * Face the stage sends while waking (Live2D). `null` once the player has the face back (after the greeting cue).
 * During the yawn the eyes are left to the `yawn` expression (it closes them), only the head is tracked.
 */
export function wakePose(t: number, from: TrackParams = DOZE_STILL_POSE): TrackParams | null {
  const { wakeYawnAt, wakeYawnEnd, wakeGreetAt } = DOZE_TIMINGS_MS
  if (t >= wakeGreetAt) return null
  const fromY = from.ParamAngleY ?? NOD_DOWN_Y
  const fromZ = from.ParamAngleZ ?? DOZE_STILL_POSE.ParamAngleZ
  const fromX = from.ParamAngleX ?? DOZE_STILL_POSE.ParamAngleX
  const fromMouth = from.ParamMouthOpenY ?? 0
  if (t < wakeYawnAt) {
    // Stir: the head comes up, the eyes flutter open.
    const lift = easeOutCubic(t / 320)
    const eyes = eyesAt(t)
    return {
      ParamEyeLOpen: eyes,
      ParamEyeROpen: eyes,
      ParamAngleX: lerp(fromX, 0, lift),
      ParamAngleY: lerp(fromY, -5, lift),
      ParamAngleZ: lerp(fromZ, 2, lift),
      ParamMouthOpenY: lerp(fromMouth, 0, lift),
    }
  }
  if (t < wakeYawnEnd) {
    // Yawn: head tips back and to the side, then returns.
    const u = (t - wakeYawnAt) / (wakeYawnEnd - wakeYawnAt)
    const arc = Math.sin(u * Math.PI)
    return { ParamAngleX: 0, ParamAngleY: lerp(-5, 0, u) + arc * 9, ParamAngleZ: lerp(2, 0, u) - arc * 5 }
  }
  // Eyes fully open and head level, handed back to the player right after.
  const u = (t - wakeYawnEnd) / (wakeGreetAt - wakeYawnEnd)
  const eyes = lerp(0.85, 1, u)
  return { ParamEyeLOpen: eyes, ParamEyeROpen: eyes, ParamAngleX: 0, ParamAngleY: 0, ParamAngleZ: 0 }
}

/** Falling back asleep (Live2D): eyes droop (one last fight), head sinks; ends on `dozePose(0)`. */
export function fallAsleepPose(t: number): TrackParams {
  const d = DOZE_TIMINGS_MS.fallAsleep
  const eyes = t < 700 ? lerp(1, 0.45, t / 700) : t < 950 ? lerp(0.45, 0.7, (t - 700) / 250) : lerp(0.7, 0, (t - 950) / 850)
  const sink = easeInOut(t / d)
  return {
    ParamEyeLOpen: eyes,
    ParamEyeROpen: eyes,
    ParamAngleX: lerp(0, DOZE_STILL_POSE.ParamAngleX, sink),
    ParamAngleY: lerp(0, DOZE_STILL_POSE.ParamAngleY, sink),
    ParamAngleZ: lerp(0, DOZE_STILL_POSE.ParamAngleZ, sink),
    ParamMouthOpenY: lerp(0, DOZE_STILL_POSE.ParamMouthOpenY, sink),
  }
}

/** Expression cues of the Live2D wake-up (v2 expression names; `null` = neutral). */
export const WAKE_EXPRESSION_CUES: ReadonlyArray<{ at: number; expression: string | null }> = [
  { at: DOZE_TIMINGS_MS.wakeYawnAt, expression: 'yawn' },
  { at: DOZE_TIMINGS_MS.wakeYawnEnd, expression: null },
  { at: DOZE_TIMINGS_MS.wakeGreetAt, expression: 'happy' },
]

/** Still pictures of the wake-up without Live2D: doze → yawn → happy. */
export type DozeStill = 'doze' | 'yawn' | 'happy'

/** Stage phases: dozing (nodding), waking (the wake-up sequence), awake, falling (back to sleep). */
export type DozePhase = 'dozing' | 'waking' | 'awake' | 'falling'

/**
 * The live model stopped being ready after it was shown (a frame threw, the GPU went away): the stills take over in
 * the state she is in. Dozing or falling asleep → the doze still, nodding; waking → skip to the end (smile and
 * greeting), since the live wake cues are dropped; awake → the smile.
 */
export function recoverFromLiveLoss(phase: DozePhase): { phase: 'dozing' | 'awake'; still: 'doze' | 'happy'; finishWake: boolean } {
  switch (phase) {
    case 'dozing':
    case 'falling':
      return { phase: 'dozing', still: 'doze', finishWake: false }
    case 'waking':
      return { phase: 'awake', still: 'happy', finishWake: true }
    case 'awake':
      return { phase: 'awake', still: 'happy', finishWake: false }
  }
}

export function wakeGreetDelay(mode: 'live' | 'static', reducedMotion: boolean): number {
  if (reducedMotion) return DOZE_TIMINGS_MS.reducedGreetAt
  return mode === 'live' ? DOZE_TIMINGS_MS.wakeGreetAt : DOZE_TIMINGS_MS.staticGreetAt
}

/**
 * Development-only query on /login (the stage reads it only under `import.meta.env.DEV`): `static=1` forces the
 * still-image path (what production shows until the login mate API exists), `doze=awake` starts already awake (UI
 * review captures).
 */
export function parseDozeDevQuery(search: string): { forceStatic: boolean; forceAwake: boolean } {
  const params = new URLSearchParams(search)
  const raw = params.get('static')?.trim().toLowerCase()
  return {
    forceStatic: raw === '1' || raw === 'true',
    forceAwake: params.get('doze')?.trim().toLowerCase() === 'awake',
  }
}
