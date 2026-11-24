/**
 * Entry "pour" of the capsule pile: when the scene comes on screen, capsules rain down and build the mountain.
 * Pure timing so it can be tested; the scene animates the steps.
 *
 * - The whole pour ends within `durationMs` (1.5 s on entry, 0.6 s when switching mates): with more capsules the
 *   steps come closer together.
 * - At most `maxFalling` capsules fall; the rest are already in place. The ones that fall are the last in pile order
 *   (the top layers), so nothing lands under a capsule that is already lying there.
 * - Capsules new since the last visit fall last, after a short pause, and sparkle when they land.
 */

export type PourStep = {
  /** Index into the pile's placements. */
  index: number
  /** Seconds after the pour starts. */
  start: number
  /** Seconds from the top of the frame to the landing. */
  fall: number
  isNew: boolean
}

export type PourPlan = { steps: PourStep[]; /** Seconds until the last capsule has settled. */ total: number }

export const POUR = {
  enterMs: 1500,
  switchMs: 800,
  maxFalling: 60,
  maxNew: 12,
  /** Settling (small bounce and wobble) after a capsule lands. */
  settle: 0.2,
} as const

export function planPour(
  ids: readonly string[],
  newIds: readonly string[],
  { durationMs, maxFalling = POUR.maxFalling }: { durationMs: number; maxFalling?: number },
): PourPlan {
  const duration = Math.max(0.3, durationMs / 1000)
  const fresh = new Set(newIds)
  const newIndexes = ids.flatMap((id, index) => (fresh.has(id) ? [index] : [])).slice(-POUR.maxNew)
  const newSet = new Set(newIndexes)
  // `maxFalling: 0` drops only the new capsules (they arrived while the page was open).
  const regularBudget = maxFalling === 0 ? 0 : Math.max(0, maxFalling - newIndexes.length)
  const others = ids.flatMap((_, index) => (newSet.has(index) ? [] : [index]))
  const regularIndexes = regularBudget > 0 ? others.slice(-regularBudget) : []
  const count = regularIndexes.length + newIndexes.length
  if (count === 0) return { steps: [], total: 0 }

  const fall = Math.min(0.46, Math.max(0.26, duration * 0.3))
  const window = Math.max(0, duration - fall - POUR.settle)
  const steps: PourStep[] = []
  const spread = (indexes: readonly number[], from: number, to: number, isNew: boolean) => {
    const gap = indexes.length > 1 ? (to - from) / (indexes.length - 1) : 0
    indexes.forEach((index, order) => steps.push({ index, start: from + gap * order, fall, isNew }))
  }
  if (newIndexes.length === 0) spread(regularIndexes, 0, window, false)
  else if (regularIndexes.length === 0) spread(newIndexes, 0, window, true)
  else {
    // New capsules get the last third of the window, after a short pause.
    const newFrom = window * (newIndexes.length > 1 ? 0.68 : 0.82)
    spread(regularIndexes, 0, Math.max(0, newFrom - Math.min(0.14, window * 0.12)), false)
    spread(newIndexes, newFrom, window, true)
  }
  const total = steps.reduce((latest, step) => Math.max(latest, step.start + step.fall + POUR.settle), 0)
  return { steps, total }
}

/**
 * Carries per-capsule animation state (falling capsules, by index) over a layout change: the same capsule keeps its
 * state at its new index; capsules that are gone lose it. The opened capsule is followed the same way by id
 * (`isStillPresent`), and its opening is cancelled when it is gone.
 */
export function carryByIds<T>(
  byIndex: ReadonlyMap<number, T>,
  previousIds: readonly string[],
  nextIds: readonly string[],
): Map<number, T> {
  const nextIndex = new Map(nextIds.map((id, index) => [id, index]))
  const result = new Map<number, T>()
  for (const [index, value] of byIndex) {
    const id = previousIds[index]
    const target = id === undefined ? undefined : nextIndex.get(id)
    if (target !== undefined) result.set(target, value)
  }
  return result
}

export function isStillPresent(id: string | null, nextIds: readonly string[]) {
  return id !== null && nextIds.includes(id)
}
