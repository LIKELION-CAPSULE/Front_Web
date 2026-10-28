/** Attach a Korean particle according to the final syllable of a display name. */
export function withParticle(value: string, consonant: string, vowel: string) {
  if (!value) return value
  const last = value.charCodeAt(value.length - 1)
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0
  return `${value}${hasFinal ? consonant : vowel}`
}
