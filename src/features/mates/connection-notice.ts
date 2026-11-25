/**
 * One short notice for the call screen (`ConnectionNotice`), set from outside it: the connection that continued is
 * another mate's (409 hand-off), the under-19 daily limit. A module store so the text survives the navigation that
 * goes with it; never account data.
 */
export type ConnectionNoticeValue = { id: number; text: string; tone: 'info' | 'warning' }
let current: ConnectionNoticeValue | null = null
let next = 0
const listeners = new Set<() => void>()
const emit = () => { for (const listener of listeners) listener() }

export function showConnectionNotice(text: string, tone: ConnectionNoticeValue['tone'] = 'info') {
  current = { id: ++next, text, tone }
  emit()
}
export function dismissConnectionNotice(id?: number) {
  if (!current || (id !== undefined && current.id !== id)) return
  current = null
  emit()
}
export const connectionNoticeStore = {
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  getSnapshot: () => current,
}
