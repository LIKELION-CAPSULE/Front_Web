/**
 * Whether an account has already finished or skipped the usage guide. This is the only place that knows where that
 * is stored: the server has no flag for it yet, so it lives in this browser per account. When the server adds one,
 * replace these two functions and nothing else needs to change.
 */
type GuideStorage = Pick<Storage, 'getItem' | 'setItem'>

export const GUIDE_SEEN_KEY_PREFIX = 'capsule-usage-guide-seen:'
const key = (userId: number) => `${GUIDE_SEEN_KEY_PREFIX}${userId}`
const validUser = (userId: number | undefined): userId is number =>
  typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0

/** True when the guide should not open by itself. Unknown accounts and unreadable storage count as seen. */
export function readGuideSeen(userId: number | undefined, storage?: Pick<GuideStorage, 'getItem'>): boolean {
  if (!validUser(userId)) return true
  try {
    return (storage ?? localStorage).getItem(key(userId)) !== null
  } catch {
    return true
  }
}

export function markGuideSeen(userId: number | undefined, storage?: Pick<GuideStorage, 'setItem'>): boolean {
  if (!validUser(userId)) return false
  try {
    (storage ?? localStorage).setItem(key(userId), new Date().toISOString())
    return true
  } catch {
    return false
  }
}
