/** Pause after each typed character in the speech bubble: sentence ends and commas breathe like speech. */
export function speechPace(char: string) {
  if (char === '…') return 500
  if (char === '?' || char === '.' || char === '!') return 380
  if (char === ',') return 220
  if (char === ' ') return 20
  return 45
}
