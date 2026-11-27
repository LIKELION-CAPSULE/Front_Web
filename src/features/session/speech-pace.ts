/** Pause after each typed character in the speech bubble: sentence ends and commas breathe like speech. */
export function speechPace(char: string) {
  if (char === '…') return 500
  if (char === '?' || char === '.' || char === '!') return 380
  if (char === ',') return 220
  if (char === ' ') return 20
  return 45
}

/** The chat's letter pace (TypingMessage, and the call's dialogue box): ms per letter, about 2.5 s for the whole line,
 *  15–32 ms a letter. */
export const letterPace = (text: string) => Math.max(15, Math.min(32, 2500 / Math.max(1, Array.from(text).length)))
