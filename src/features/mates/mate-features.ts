/**
 * Feature flags for the "my mates" features. The single place that decides what shows.
 *
 * - Production builds (decided 2026-11-26): affinity and 세계관 on, voice lines off. The stage comes from the server
 *   (37 `relation`, 21 `stageUp`, 22 · 23 `relation`); nothing is made up — a mate the server sends no relation for
 *   shows no stage, and its five worlds are locked. World content stays 「준비 중」 until the server names its type
 *   (mate-worlds.ts). The sample data (mate-sample-data.ts, mate-world-samples.ts) is never bundled in production.
 * - Development and the local mock: the same flags, with sample data when the backend sends none.
 *   `?features=off` turns them all off in development (the card with the name and the first meeting only).
 *
 * Dependency-free (no `import.meta`) so unit tests can call it; the page passes `import.meta.env.DEV`.
 */
export type MateFeatureFlags = {
  /** Affinity stage in the panel caption ("3단계 · 친구") and the column's affinity block. */
  affinity: boolean
  /**
   * 세계관 (mate-worlds.ts) under the affinity in the same card and on the mate page: one place per stage. Needs `affinity`
   * (the stage decides what is open); with affinity off the whole card is left out.
   */
  world: boolean
  /** Unlocked voice lines. Built, but kept hidden (production too) until the voice samples ship. */
  voices: boolean
}

export const MATE_FEATURES_OFF: MateFeatureFlags = { affinity: false, world: false, voices: false }

export const MATE_FEATURES_ON: MateFeatureFlags = { affinity: true, world: true, voices: false }

/** `override` is the `?features=` query; only development honours it (production ignores it). */
export function resolveMateFeatures(isDevelopment: boolean, override: string | null): MateFeatureFlags {
  if (isDevelopment && override === 'off') return MATE_FEATURES_OFF
  return MATE_FEATURES_ON
}

/** Affinity stages in the beta PRD (처음 만남 → 단짝): the stage table's length. */
export const AFFINITY_STAGE_COUNT = 5
