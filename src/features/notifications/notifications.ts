import { ApiError } from '../../shared/api/client.ts'
import type { NotificationItem, NotificationList } from '../../shared/api/types.ts'

/**
 * 43 알림 (`GET /notifications?before=&size=`, newest first, `nextBefore` pages) and 44 읽음 (`POST
 * /notifications/read { ids? }` → `{ unreadCount }`). The header bell (NotificationBell) shows them; this file is the
 * plain logic: pages, links, times, the unread count.
 */

export type NotificationView = {
  id: number
  type: string
  title: string
  body: string | null
  /** An in-app path, or null (no link, or one that leaves the app). */
  link: string | null
  read: boolean
  createdAt: number
}

const invalid = () => new ApiError('알림 응답을 확인하지 못했어요.', 502)

/**
 * Only paths inside the app (`/…`, never `//host` or `scheme:`) open from a notification. The old invite path is the
 * current one.
 */
export function inAppLink(link: unknown): string | null {
  if (typeof link !== 'string') return null
  const value = link.trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  try {
    const url = new URL(value, 'https://capsule.invalid')
    if (url.origin !== 'https://capsule.invalid') return null
    const path = url.pathname === '/credits/charge' || url.pathname === '/invite' ? '/credits/invite' : url.pathname
    return `${path}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function notification(item: NotificationItem): NotificationView {
  const createdAt = typeof item?.createdAt === 'string' ? Date.parse(item.createdAt) : NaN
  if (!(typeof item?.id === 'number' && Number.isSafeInteger(item.id) && item.id > 0) || typeof item.title !== 'string' ||
    !item.title.trim() || typeof item.read !== 'boolean' || !Number.isFinite(createdAt)) throw invalid()
  return {
    id: item.id, type: typeof item.type === 'string' ? item.type : '', title: item.title.trim(),
    body: typeof item.body === 'string' && item.body.trim() ? item.body.trim() : null,
    link: inAppLink(item.link), read: item.read, createdAt,
  }
}

export function notificationPage(dto: NotificationList | null | undefined) {
  if (!dto || !Array.isArray(dto.items) || !(typeof dto.unreadCount === 'number' && Number.isInteger(dto.unreadCount) && dto.unreadCount >= 0)) throw invalid()
  const nextBefore = typeof dto.nextBefore === 'number' && Number.isSafeInteger(dto.nextBefore) ? dto.nextBefore : null
  return { items: dto.items.map(notification), unreadCount: dto.unreadCount, nextBefore }
}

/** An older page after what is loaded: newest first, each notification once (a later copy wins). */
export function appendNotifications(loaded: readonly NotificationView[], page: readonly NotificationView[]): NotificationView[] {
  const byId = new Map(loaded.map(item => [item.id, item]))
  for (const item of page) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
}

/** After 44: those ids (or every one, without ids) are read. */
export function markRead(items: readonly NotificationView[], ids?: readonly number[]): NotificationView[] {
  const set = ids ? new Set(ids) : null
  return items.map(item => (!item.read && (!set || set.has(item.id)) ? { ...item, read: true } : item))
}

/** Unread ids among the loaded ones (what opening the list marks read). */
export const unreadIds = (items: readonly NotificationView[]) => items.filter(item => !item.read).map(item => item.id)

/** "방금 전", "5분 전", "3시간 전", "어제", "4일 전", then the date. */
export function relativeTime(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return '방금 전'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  const date = new Date(at + 9 * 3600 * 1000)
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`
}

/** Unread count refresh: on entry, when the tab shows again, and at most this often while it stays visible. */
export const UNREAD_REFRESH_MS = 5 * 60 * 1000

export const NOTIFICATION_COPY = {
  bell: '알림',
  unread: (count: number) => `안 읽은 알림 ${count > 99 ? '99개 이상' : `${count}개`}`,
  title: '알림',
  readAll: '모두 읽음',
  empty: '새 알림이 없어요.',
  emptySub: '친밀도가 오르거나 크레딧을 받으면 여기에 알려 드려요.',
  failed: '알림을 불러오지 못했어요.',
  retry: '다시 시도',
  loadingMore: '알림을 더 불러오고 있어요.',
  unreadMark: '읽지 않음',
} as const
