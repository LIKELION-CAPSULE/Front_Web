import { capsuleEndedAt, sortCapsules } from './capsule-jar-data.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'

type VisitStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Per account and per mate, so two accounts on one browser never share a "last visit". */
export function capsuleVisitKey(userId: number | string | undefined, mateId: string) {
  return `capsule-jar-visit:v1:${userId ?? 'guest'}:${mateId}`
}

export function readLastVisit(storage: VisitStorage | undefined, key: string): number | null {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function writeLastVisit(storage: VisitStorage | undefined, key: string, at: number) {
  try {
    storage?.setItem(key, String(Math.floor(at)))
  } catch {
    // Private mode or a full quota: the jar then simply shows everything as settled next time.
  }
}

export function clearLastVisit(storage: VisitStorage | undefined, key: string) {
  try {
    storage?.removeItem(key)
  } catch {
    // Same as above.
  }
}

export const MAX_DROPPED_CAPSULES = 12
export const FIRST_VISIT_DROPPED_CAPSULES = 6

/**
 * Decides which capsules fall into the jar on this visit.
 *
 * - With a previous visit: capsules that ended after it. Nothing new → nothing falls.
 * - First visit (no stored time): the latest few capsules fall in once as a welcome; the rest are already stacked.
 * - At most `maxDrop` capsules fall; older new ones are shown already settled so the entrance stays short.
 */
export function splitNewCapsules(
  capsules: readonly CapsuleRecord[],
  lastVisitAt: number | null,
  { maxDrop = MAX_DROPPED_CAPSULES, firstVisitDrop = FIRST_VISIT_DROPPED_CAPSULES } = {},
): { newIds: string[] } {
  const sorted = sortCapsules(capsules)
  const fresh = lastVisitAt === null ? sorted : sorted.filter((capsule) => capsuleEndedAt(capsule) > lastVisitAt)
  const limit = Math.max(0, lastVisitAt === null ? Math.min(firstVisitDrop, maxDrop) : maxDrop)
  return { newIds: fresh.slice(Math.max(0, fresh.length - limit)).map((capsule) => capsule.id) }
}
