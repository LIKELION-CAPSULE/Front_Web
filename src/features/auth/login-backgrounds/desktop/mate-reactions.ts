import type { ExpressionPriority, ExpressionRequest } from '@/features/live2d/expression-scheduler'
import type { Live2DLookOptions } from '@/features/live2d/live2d-stage'
import { DEFAULT_REACTION_LINES, type ExpressionMapping, type MateReactionState } from './desktop-config'

/**
 * Priority order:
 * success/error > passwordFocus > dragged > secretFound > iconOpen > emailFocus > greet > idleLong > idle
 */
export const REACTION_PRIORITY: Record<MateReactionState, number> = {
  idle: 0,
  idleLong: 1,
  greet: 2,
  onboardingGreet: 3,
  emailFocus: 3,
  iconOpen: 4,
  legalReading: 4,
  avatarPicked: 4,
  nicknameSet: 4,
  secretFound: 5,
  shinyFound: 5,
  referralValid: 5,
  dragged: 6,
  passwordFocus: 7,
  error: 8,
  success: 8,
  onboardingDone: 8,
}

export type GazeMode =
  | { kind: 'cursor' }
  | { kind: 'fixed'; x: number; y: number; options?: Live2DLookOptions }

export interface GazeCalibration {
  eyeScale: number
  headScale: number
  secretTarget?: { x: number; y: number } | null
}

export function resolveGazeForState(
  state: MateReactionState,
  relativeLoginDir: number,
  calibration: GazeCalibration,
): GazeMode {
  const towardLogin = relativeLoginDir >= 0 ? 0.92 : -0.92

  switch (state) {
    case 'idle':
    case 'dragged':
      return { kind: 'cursor' }
    case 'emailFocus':
    case 'avatarPicked':
      // Eyes move noticeably further than head toward the app window (email input or avatar dial)
      return {
        kind: 'fixed',
        x: towardLogin,
        y: state === 'avatarPicked' ? 0.14 : -0.06,
        options: {
          eyeScale: calibration.eyeScale,
          headScale: calibration.headScale,
          tiltDeg: state === 'avatarPicked' ? 3 : 0,
        },
      }
    case 'passwordFocus':
      // Confirmed: playful eyes-closed smile with subtle head tilt only (no turning away)
      return {
        kind: 'fixed',
        x: 0,
        y: 0.04,
        options: {
          eyeScale: 0,
          headScale: 0.15,
          tiltDeg: 9,
        },
      }
    case 'secretFound':
    case 'shinyFound':
    case 'legalReading': {
      const target =
        calibration.secretTarget ?? (state === 'legalReading' ? { x: 0.72, y: 0.08 } : { x: -0.55, y: 0.2 })
      return {
        kind: 'fixed',
        x: target.x,
        y: target.y,
        options: {
          eyeScale: calibration.eyeScale,
          headScale: Math.min(0.85, calibration.headScale + 0.2),
          tiltDeg: state === 'shinyFound' ? 5 : state === 'legalReading' ? 3 : 4,
        },
      }
    }
    case 'iconOpen':
      return {
        kind: 'fixed',
        x: -0.85,
        y: 0.52,
        options: {
          eyeScale: calibration.eyeScale,
          headScale: Math.min(0.75, calibration.headScale + 0.15),
          tiltDeg: -5,
        },
      }
    case 'idleLong':
      return {
        kind: 'fixed',
        x: 0,
        y: -0.45,
        options: { eyeScale: 1, headScale: 0.7, tiltDeg: 0 },
      }
    case 'greet':
    case 'error':
    case 'success':
    case 'onboardingGreet':
    case 'nicknameSet':
    case 'referralValid':
    case 'onboardingDone':
      return { kind: 'fixed', x: 0, y: 0, options: { eyeScale: 1, headScale: 1, tiltDeg: 0 } }
  }
}

/** Speech bubble display duration (4–8s based on character count). */
export function reactionBubbleDurationMs(text: string): number {
  const len = Array.from(text.trim()).length
  return Math.min(8000, Math.max(4000, 3400 + len * 120))
}

/** Minimum cooldown before the same state can emit another speech bubble automatically. */
export const REACTION_COOLDOWN_MS: Record<MateReactionState, number> = {
  idle: 0,
  greet: Number.POSITIVE_INFINITY,
  emailFocus: Number.POSITIVE_INFINITY, // once per visit
  passwordFocus: 12_000,
  idleLong: 25_000,
  error: 4_000,
  success: 0,
  dragged: 9_000,
  iconOpen: 1_500,
  legalReading: Number.POSITIVE_INFINITY, // once per visit
  secretFound: 6_000,
  shinyFound: 6_000,
  onboardingGreet: Number.POSITIVE_INFINITY, // once on open
  avatarPicked: 5_000,
  nicknameSet: 2_000,
  referralValid: 4_000,
  onboardingDone: 0,
}

export function buildExpressionRequestForState(
  state: MateReactionState,
  mapping: ExpressionMapping,
  line: string | null,
): ExpressionRequest {
  const file = mapping[state] || null
  const priority: ExpressionPriority =
    state === 'success' ||
    state === 'onboardingDone' ||
    state === 'error' ||
    state === 'passwordFocus' ||
    state === 'dragged'
      ? 'state'
      : state === 'secretFound' ||
          state === 'shinyFound' ||
          state === 'iconOpen' ||
          state === 'legalReading' ||
          state === 'greet' ||
          state === 'onboardingGreet' ||
          state === 'avatarPicked' ||
          state === 'nicknameSet' ||
          state === 'referralValid' ||
          state === 'emailFocus'
        ? 'speech'
        : 'motion'

  if (!file) {
    return { file: null, priority: 'state', hold: 'release' }
  }

  if (
    state === 'passwordFocus' ||
    state === 'dragged' ||
    state === 'emailFocus' ||
    state === 'idleLong' ||
    state === 'success' ||
    state === 'onboardingDone'
  ) {
    return { file, priority, hold: 'sticky' }
  }

  return {
    file,
    priority,
    hold: { ms: line ? reactionBubbleDurationMs(line) : 4200 },
  }
}

export function getDefaultLineForState(state: MateReactionState): string | null {
  return DEFAULT_REACTION_LINES[state]
}
