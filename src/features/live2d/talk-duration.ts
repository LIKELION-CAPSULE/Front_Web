import { speechPace } from '../session/speech-pace.ts'

export const TALK_MIN_MS = 600
export const TALK_MAX_MS = 8_000

/**
 * How long the mouth moves for a line: the time the speech bubble takes to type it (same pace as `speechPace`),
 * so talking stops when the text stops. There is no voice yet; with TTS this becomes the audio length.
 */
export function talkDurationMs(text: string | undefined | null): number {
  const letters = Array.from(text?.trim() ?? '')
  if (!letters.length) return 0
  const typed = letters.reduce((total, letter) => total + speechPace(letter), 0)
  return Math.min(TALK_MAX_MS, Math.max(TALK_MIN_MS, Math.round(typed)))
}
