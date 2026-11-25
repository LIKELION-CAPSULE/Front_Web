/**
 * Feature flags for "my mates" features that have no backend API yet. The single place that decides what shows.
 *
 * - Production builds: all off. The mate card shows the name and the first meeting only (a smaller card).
 * - Development and the local mock: on, with sample data (mate-sample-data.ts) when the backend sends none.
 *   `?features=off` turns them off in development to check the production look.
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
  /** Unlocked voice lines. Built, but kept hidden until the voice samples ship. */
  voices: boolean
}

export const MATE_FEATURES_OFF: MateFeatureFlags = { affinity: false, world: false, voices: false }

export function resolveMateFeatures(isDevelopment: boolean, override: string | null): MateFeatureFlags {
  if (!isDevelopment || override === 'off') return MATE_FEATURES_OFF
  return { affinity: true, world: true, voices: false }
}

/** Affinity stages in the beta PRD (처음 만남 → 단짝): the stage table's length. */
export const AFFINITY_STAGE_COUNT = 5
