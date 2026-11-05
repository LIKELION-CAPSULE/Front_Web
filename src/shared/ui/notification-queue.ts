import type { FeedbackTone } from './FeedbackMessage'

export type NotificationContent = { tone: FeedbackTone; title: string; text: string }
export type NotificationItem = NotificationContent & { id: string }

/** Keep the newest notices first and coalesce repeated results, including effect replays. */
export function enqueueNotification(current: NotificationItem[], item: NotificationItem): NotificationItem[] {
  if (current.some(notice => notice.tone === item.tone && notice.title === item.title && notice.text === item.text)) return current
  return [item, ...current].slice(0, 3)
}
