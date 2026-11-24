/**
 * Pure state machine for the "채린이 조립" (/login) DMG-style wake-up sequence.
 * Kept dependency-free so Node's `--experimental-strip-types` test runner can execute it directly.
 */

export type AssemblePhase =
  | 'idle'
  | 'dragging'
  | 'dropped'
  | 'streaming'
  | 'filling'
  | 'settling'
  | 'live'
  | 'static'

export type AssembleMethod = 'drag' | 'keyboard'
export type Live2DReadiness = 'loading' | 'ready' | 'error'

export interface AssembleMachineState {
  phase: AssemblePhase
  /** True when the animation reached the handoff point before Live2D finished loading. */
  waitingForLive2D: boolean
  /** How the current or most recent wake-up sequence was triggered. */
  method: AssembleMethod | null
  /** True when running the reduced-motion 300ms crossfade shortcut. */
  reducedMotion: boolean
}

export type AssembleEvent =
  | { type: 'DRAG_START' }
  | { type: 'DRAG_CANCEL' }
  | { type: 'TRIGGER'; method: AssembleMethod; reducedMotion: boolean }
  | { type: 'STEP_COMPLETE'; live2dStatus: Live2DReadiness }
  | { type: 'LIVE2D_STATUS_CHANGE'; live2dStatus: Live2DReadiness }
  | { type: 'REPLAY' }

export const ASSEMBLE_SEEN_STORAGE_KEY = 'capsule-login-assemble-seen:v1'

/**
 * Step durations (~2.24s from drop to the Live2D handoff, then a 260ms crossfade). Phase meanings:
 * - dropped:    card is absorbed, the CAPSULE icon charges (converging ring + soft core)
 * - streaming:  a fine light stream flies from the icon to the model's torso; the silhouette blooms where it lands
 * - filling:    ONE shared fill boundary sweeps the whole model (bottom -> top) turning the silhouette into the picture
 * - settling:   one diagonal gloss pass + halo settle; holds here until Live2D is ready
 */
export const ASSEMBLE_TIMINGS_MS = {
  dropped: 320,
  streaming: 520,
  filling: 900,
  settling: 500,
  liveFade: 260,
  reducedCrossfade: 300,
  demoIdleDelay: 6000,
} as const

/** Greeting bubble waits this long after the 260ms Live2D crossfade on the animated path. */
export const ASSEMBLE_GREET_DELAY_MS = 380

/**
 * When Chaerin's greeting should appear for a terminal phase, or `null` for no greeting.
 * - Both terminal phases greet: `live` (Live2D) and `static` (picture — reduced motion never loads Live2D, and a failed
 *   engine falls back here). Reduced motion only drops movement, not the line.
 * - Once per wake-up: `alreadyGreeted` stays true across live <-> static switches and re-renders; it is cleared only
 *   when the sequence returns to `idle` (replay).
 * - `immediate` (revisit, half screen, reduced motion): right away; otherwise after the crossfade + a short beat.
 */
export function assembleGreetDelayMs(options: {
  phase: AssemblePhase
  alreadyGreeted: boolean
  immediate: boolean
}): number | null {
  const { phase, alreadyGreeted, immediate } = options
  if (alreadyGreeted || (phase !== 'live' && phase !== 'static')) return null
  return immediate ? 0 : ASSEMBLE_TIMINGS_MS.liveFade + ASSEMBLE_GREET_DELAY_MS
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readAssembleSeen(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(ASSEMBLE_SEEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeAssembleSeen(storage: StorageLike | null, seen = true): void {
  try {
    if (seen) storage?.setItem(ASSEMBLE_SEEN_STORAGE_KEY, '1')
    else storage?.removeItem(ASSEMBLE_SEEN_STORAGE_KEY)
  } catch {
    // Ignore blocked storage (private browsing, sandboxed iframe, etc.)
  }
}

export type AssembleForcePhase = 'idle' | 'live' | 'streaming' | 'filling' | 'settling' | 'static' | null

const FORCE_PHASE_ALIASES: Record<string, Exclude<AssembleForcePhase, null>> = {
  idle: 'idle',
  live: 'live',
  static: 'static',
  streaming: 'streaming',
  filling: 'filling',
  settling: 'settling',
  // Earlier preview links used the phase names of the removed decompose/mesh/assemble sequence.
  exploding: 'streaming',
  meshing: 'filling',
  assembling: 'settling',
}

/** Parses the `?assemble=` preview value (unknown / missing -> null = normal flow). */
export function parseAssembleForcePhase(raw: string | null | undefined): AssembleForcePhase {
  const key = raw?.trim().toLowerCase()
  return key && Object.hasOwn(FORCE_PHASE_ALIASES, key) ? FORCE_PHASE_ALIASES[key]! : null
}

/**
 * How a native `click` on the card / CAPSULE icon should be treated.
 * `detail === 0` is a non-pointer activation (Enter / Space on the focused button, a screen reader or switch device
 * activating it) -> start via the keyboard path. `detail > 0` is a real pointer click, which only hints that the card
 * must be dragged (waking by pointer is drag-and-drop only).
 */
export function resolveClickActivation(detail: number): 'keyboard' | 'hint' {
  return detail === 0 ? 'keyboard' : 'hint'
}

export function createInitialAssembleState(options: {
  seen: boolean
  live2dStatus: Live2DReadiness
  forcePhase?: AssembleForcePhase
}): AssembleMachineState {
  const { seen, live2dStatus, forcePhase } = options
  if (forcePhase === 'idle') {
    return { phase: 'idle', waitingForLive2D: false, method: null, reducedMotion: false }
  }
  if (forcePhase === 'streaming' || forcePhase === 'filling' || forcePhase === 'settling') {
    return { phase: forcePhase, waitingForLive2D: false, method: 'drag', reducedMotion: false }
  }
  if (forcePhase === 'static') {
    return { phase: 'static', waitingForLive2D: false, method: null, reducedMotion: false }
  }
  if (forcePhase === 'live' || seen) {
    if (live2dStatus === 'ready') {
      return { phase: 'live', waitingForLive2D: false, method: null, reducedMotion: false }
    }
    if (live2dStatus === 'error') {
      return { phase: 'static', waitingForLive2D: false, method: null, reducedMotion: false }
    }
    return { phase: 'settling', waitingForLive2D: true, method: null, reducedMotion: false }
  }
  return { phase: 'idle', waitingForLive2D: false, method: null, reducedMotion: false }
}

function settleToTerminal(
  state: AssembleMachineState,
  live2dStatus: Live2DReadiness,
): AssembleMachineState {
  if (live2dStatus === 'ready') {
    return { ...state, phase: 'live', waitingForLive2D: false }
  }
  if (live2dStatus === 'error') {
    return { ...state, phase: 'static', waitingForLive2D: false }
  }
  return { ...state, waitingForLive2D: true }
}

export function transitionAssembleState(
  state: AssembleMachineState,
  event: AssembleEvent,
): AssembleMachineState {
  switch (event.type) {
    case 'DRAG_START':
      if (state.phase !== 'idle') return state
      return { ...state, phase: 'dragging' }

    case 'DRAG_CANCEL':
      if (state.phase !== 'dragging') return state
      return { ...state, phase: 'idle' }

    case 'TRIGGER':
      if (state.phase !== 'idle' && state.phase !== 'dragging') return state
      return {
        phase: 'dropped',
        waitingForLive2D: false,
        method: event.method,
        reducedMotion: event.reducedMotion,
      }

    case 'STEP_COMPLETE':
      if (state.phase === 'dropped') {
        if (state.reducedMotion) {
          return settleToTerminal(state, event.live2dStatus)
        }
        return { ...state, phase: 'streaming', waitingForLive2D: false }
      }
      if (state.phase === 'streaming') {
        return { ...state, phase: 'filling', waitingForLive2D: false }
      }
      if (state.phase === 'filling') {
        return { ...state, phase: 'settling', waitingForLive2D: false }
      }
      if (state.phase === 'settling') {
        return settleToTerminal(state, event.live2dStatus)
      }
      return state

    case 'LIVE2D_STATUS_CHANGE':
      // The engine can be lost after the handoff (reduced-motion switched on, renderer error): fall back to the still image.
      if (state.phase === 'live' && event.live2dStatus === 'error') {
        return { ...state, phase: 'static', waitingForLive2D: false }
      }
      // ...and come back when it is available again (reduced-motion switched off, retry succeeded).
      if (state.phase === 'static' && event.live2dStatus === 'ready') {
        return { ...state, phase: 'live', waitingForLive2D: false }
      }
      if (!state.waitingForLive2D) return state
      if (event.live2dStatus === 'ready') {
        return { ...state, phase: 'live', waitingForLive2D: false }
      }
      if (event.live2dStatus === 'error') {
        return { ...state, phase: 'static', waitingForLive2D: false }
      }
      return state

    case 'REPLAY':
      if (state.phase !== 'live' && state.phase !== 'static') return state
      return {
        phase: 'idle',
        waitingForLive2D: false,
        method: null,
        reducedMotion: false,
      }

    default:
      return state
  }
}

export function getAssembleStepDurationMs(state: AssembleMachineState): number | null {
  if (state.waitingForLive2D) return null
  switch (state.phase) {
    case 'dropped':
      return state.reducedMotion ? ASSEMBLE_TIMINGS_MS.reducedCrossfade : ASSEMBLE_TIMINGS_MS.dropped
    case 'streaming':
      return ASSEMBLE_TIMINGS_MS.streaming
    case 'filling':
      return ASSEMBLE_TIMINGS_MS.filling
    case 'settling':
      return ASSEMBLE_TIMINGS_MS.settling
    default:
      return null
  }
}
