import { seededRandom, sortCapsules } from './capsule-jar-data.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'

/**
 * Dummy capsules for development only (the capsule scene preview, `?mates=demo` preview mates, tests).
 * Imported dynamically behind `import.meta.env.DEV`, so none of this reaches production builds.
 */

/** The only approved closing line in the repository (local demo / review fixtures). No new dialogue is invented. */
const SAMPLE_LINE = '오늘도 같이 있어서 좋았어. 다음에도 여기서 만나자.'
const HOUR = 3_600_000

/** Typical connection length: mostly 30 min–2 h, now and then a short 15-minute one or a long 3-hour one. */
function typicalMinutes(random: () => number) {
  const roll = random()
  if (roll < 0.12) return 15 + random() * 15
  if (roll > 0.92) return 120 + random() * 60
  // Triangular between 30 and 120, peaking around an hour.
  return 30 + 90 * Math.min(random(), random() * 0.6 + random() * 0.4)
}

/**
 * Dummy capsules for the preview, going back day by day from `now`: 0–2 connections a day (two-week opening
 * assumption). `minutes` replaces the length distribution, e.g. [15, 40] for the 200-capsule stress test.
 */
export function generateDummyCapsules(
  count: number,
  {
    seed = 7,
    now = Date.now(),
    idPrefix = 'dummy',
    minutes,
  }: { seed?: number; now?: number; idPrefix?: string; minutes?: readonly [min: number, max: number] } = {},
): CapsuleRecord[] {
  const random = seededRandom(seed)
  const result: CapsuleRecord[] = []
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  for (let dayOffset = 0; result.length < count; dayOffset++) {
    const roll = random()
    const sessions = roll < 0.25 ? 0 : roll < 0.75 ? 1 : 2
    // Second connection of a day comes earlier (afternoon), the main one in the evening.
    for (let session = 0; session < sessions && result.length < count; session++) {
      const durationMinutes = Math.round(minutes ? minutes[0] + random() * (minutes[1] - minutes[0]) : typicalMinutes(random))
      const startHour = session === 0 ? 19 + random() * 3.5 : 13 + random() * 4
      const startedAt = today.getTime() - dayOffset * 24 * HOUR + startHour * HOUR
      // Every dummy connection has ended at least an hour before `now`, so none of them looks "new" on a reload.
      if (startedAt + durationMinutes * 60_000 > now - HOUR) continue
      const capsuleNumber = count - result.length
      result.push({
        id: `${idPrefix}-${capsuleNumber}`,
        startedAt,
        endedAt: startedAt + durationMinutes * 60_000,
        durationSeconds: durationMinutes * 60,
        // The newest capsules always carry the line so the preview card shows it.
        ...(result.length < 3 || random() < 0.7 ? { line: SAMPLE_LINE } : {}),
        connectionId: `${idPrefix}-${capsuleNumber}`,
      })
    }
  }
  return sortCapsules(result)
}

/** Capsules created "just now" for the preview's drop button. */
export function generateFreshCapsules(count: number, { now = Date.now(), seed = now }: { now?: number; seed?: number } = {}) {
  const random = seededRandom(seed)
  return Array.from({ length: count }, (_, index): CapsuleRecord => {
    const durationSeconds = Math.round(typicalMinutes(random)) * 60
    const endedAt = now - (count - index) * 1000
    return {
      id: `fresh-${seed}-${index}`,
      startedAt: endedAt - durationSeconds * 1000,
      endedAt,
      durationSeconds,
      line: SAMPLE_LINE,
      connectionId: `fresh-${seed}-${index}`,
    }
  })
}
