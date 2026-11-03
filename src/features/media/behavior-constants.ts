/**
 * Every tunable value for study-time behavior detection and the friend's reactions lives here.
 * Times are milliseconds; ratios are relative to the user's hand size (wrist → middle-finger base).
 */

/** Shows the detected rule names over the user's own tile. Turn off for demos. */
export const SHOW_BEHAVIOR_OVERLAY = true

// Inference cadence while a study session is running. The prepare screen keeps its 5 fps face check.
export const FACE_INTERVAL_MS = 100
export const GESTURE_INTERVAL_MS = 1000 / 15
export const PHONE_INTERVAL_MS = 1000
export const PREPARE_FACE_INTERVAL_MS = 200
/** Face results reach React at most this often; the detector still sees every face sample. */
export const OBSERVATION_PUBLISH_MS = 200

export const AWAY_MS = 3000
export const DROWSY_BLINK_SCORE = 0.5
export const DROWSY_MS = 2000
export const YAWN_JAW_SCORE = 0.6
export const YAWN_MS = 1000
export const HEAD_TURN_DEGREES = 25
export const HEAD_TURN_MS = 2000
export const PHONE_MIN_SCORE = 0.5
export const PHONE_MIN_STREAK = 3
/** The detector returns weaker boxes too, so the rule above stays adjustable here. */
export const PHONE_DETECTOR_SCORE = 0.3

export const WAVE_WINDOW_MS = 1000
export const WAVE_MIN_SAMPLES = 8
export const WAVE_MIN_REVERSALS = 2
/** Total left-right travel of the palm center within the window. */
export const WAVE_MIN_AMPLITUDE = 0.4
/** Movement back the other way must exceed this before it counts as a direction change. */
export const WAVE_REVERSAL_STEP = 0.2
export const WAVE_OPEN_PALM_RATIO = 0.5
export const WAVE_COOLDOWN_MS = 3000

/** How long a momentary detection (yawn, wave) stays on the overlay. */
export const MOMENT_DISPLAY_MS = 2000

// Friend reactions in the LLM chat.
export const BEHAVIOR_KIND_COOLDOWN_MS = 60_000
export const BEHAVIOR_GLOBAL_COOLDOWN_MS = 20_000
/** Detections from this far back are sent as context with ordinary chat messages. */
export const BEHAVIOR_RECENT_MS = 5 * 60_000
export const BEHAVIOR_RECENT_LIMIT = 6
/** Matches the text limit in server/openai-chat.ts; context is dropped rather than cutting the user's words. */
export const CHAT_TEXT_LIMIT = 500
