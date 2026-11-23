/**
 * Pure state machine for the "채린이 조립" (/login) DMG-style wake-up sequence.
 * Kept dependency-free so Node's `--experimental-strip-types` test runner can execute it directly.
 */

export type AssemblePhase =
  | 'idle'
  | 'dragging'
  | 'dropped'
  | 'exploding'
  | 'meshing'
  | 'assembling'
  | 'live'
  | 'static'

export type AssembleMethod = 'drag' | 'click' | 'keyboard'
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

export const ASSEMBLE_TIMINGS_MS = {
  dropped: 250,
  exploding: 600,
  meshing: 450,
  assembling: 1050,
  rigSparkle: 120,
  liveFade: 260,
  cameraMove: 1200,
  reducedCrossfade: 300,
  explodeStagger: 30,
  demoIdleDelay: 6000,
} as const

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

export type AssembleForcePhase = 'idle' | 'live' | 'exploding' | 'meshing' | 'assembling' | 'static' | null

export function createInitialAssembleState(options: {
  seen: boolean
  live2dStatus: Live2DReadiness
  forcePhase?: AssembleForcePhase
}): AssembleMachineState {
  const { seen, live2dStatus, forcePhase } = options
  if (forcePhase === 'idle') {
    return { phase: 'idle', waitingForLive2D: false, method: null, reducedMotion: false }
  }
  if (forcePhase === 'exploding' || forcePhase === 'meshing' || forcePhase === 'assembling') {
    return { phase: forcePhase, waitingForLive2D: false, method: 'click', reducedMotion: false }
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
    return { phase: 'assembling', waitingForLive2D: true, method: null, reducedMotion: false }
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
        return { ...state, phase: 'exploding', waitingForLive2D: false }
      }
      if (state.phase === 'exploding') {
        return { ...state, phase: 'meshing', waitingForLive2D: false }
      }
      if (state.phase === 'meshing') {
        return { ...state, phase: 'assembling', waitingForLive2D: false }
      }
      if (state.phase === 'assembling') {
        return settleToTerminal(state, event.live2dStatus)
      }
      return state

    case 'LIVE2D_STATUS_CHANGE':
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
    case 'exploding':
      return ASSEMBLE_TIMINGS_MS.exploding
    case 'meshing':
      return ASSEMBLE_TIMINGS_MS.meshing
    case 'assembling':
      return ASSEMBLE_TIMINGS_MS.assembling
    default:
      return null
  }
}
