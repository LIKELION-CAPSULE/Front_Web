/**
 * Every tunable value for the study-room Live2D friend lives here.
 * Times are milliseconds unless the name says otherwise.
 */

/** Cubism Core 5 (Live2D Proprietary Software License, redistributable code), served from public/. */
export const CUBISM_CORE_PATH = 'live2d/live2dcubismcore.min.js'

// Expression scheduling.
/** A shown expression stays at least this long so faces never flicker between replies. */
export const EXPRESSION_MIN_HOLD_MS = 1500
/** The "noticed you" face from POST /events (18) returns to the default face after this. */
export const NOTICE_HOLD_MS = 4000
/** A face that comes with a line lasts while the line is read: base + per letter, clamped. */
export const SPEECH_HOLD_BASE_MS = 2500
export const SPEECH_HOLD_PER_LETTER_MS = 80
export const SPEECH_HOLD_MIN_MS = 4000
export const SPEECH_HOLD_MAX_MS = 10_000

// Natural movement.
/** Scales the library's breathing sway (head and body angles). 1 is the Cubism sample amplitude. */
export const BREATH_DEPTH = 0.5
/** Used when model3.json has no EyeBlink group. */
export const FALLBACK_EYE_BLINK_IDS = ['ParamEyeLOpen', 'ParamEyeROpen']
export const BLINK_INTERVAL_MIN_MS = 2500
export const BLINK_INTERVAL_MAX_MS = 6000
export const BLINK_CLOSING_MS = 90
export const BLINK_CLOSED_MS = 50
export const BLINK_OPENING_MS = 160

// Cursor tracking during breaks.
/** 1 lets the head turn the model's full range (about 30 degrees); lower keeps the look subtle. */
export const FOCUS_STRENGTH = 0.8
/** The look point sits this far down the canvas, around the face. */
export const FOCUS_ORIGIN_Y = 0.3

/** Server `offsetX` / `offsetY` are read as percentages of the tile (the spec leaves the unit open). */
export const OFFSET_PERCENT = 100
