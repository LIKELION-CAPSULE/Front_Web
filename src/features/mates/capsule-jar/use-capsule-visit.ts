import { useCallback, useEffect, useMemo, useState } from 'react'
import { clearLastVisit, readLastVisit, splitNewCapsules, writeLastVisit } from './capsule-jar-visit.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'

function localStore(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/**
 * Remembers when this account last looked at this mate's jar and returns the capsules that are new since then.
 * The previous visit is read once per key before this visit is written, so React's development double-mount does
 * not swallow the drop.
 */
export function useCapsuleVisit(storageKey: string, capsules: readonly CapsuleRecord[]) {
  const [visit, setVisit] = useState(() => ({ key: storageKey, at: readLastVisit(localStore(), storageKey) }))
  let current = visit
  if (visit.key !== storageKey) {
    current = { key: storageKey, at: readLastVisit(localStore(), storageKey) }
    setVisit(current)
  }

  useEffect(() => {
    writeLastVisit(localStore(), storageKey, Date.now())
  }, [storageKey])

  const lastVisitAt = current.at
  const dropIds = useMemo(() => splitNewCapsules(capsules, lastVisitAt).newIds, [capsules, lastVisitAt])

  /** Forget the previous visit: this visit behaves like a first visit, and it is recorded as now. */
  const reset = useCallback(() => {
    clearLastVisit(localStore(), storageKey)
    setVisit({ key: storageKey, at: null })
    writeLastVisit(localStore(), storageKey, Date.now())
  }, [storageKey])

  return { dropIds, lastVisitAt, reset }
}
