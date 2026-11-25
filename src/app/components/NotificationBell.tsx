import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { getNotifications, readNotifications } from '@/features/backend/server-api'
import {
  appendNotifications, markRead, NOTIFICATION_COPY, notificationPage, relativeTime, UNREAD_REFRESH_MS, unreadIds,
  type NotificationView,
} from '@/features/notifications/notifications'
import { api } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import '@/features/notifications/notification-bell.css'

const PAGE_SIZE = 20

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
    </svg>
  )
}

/**
 * The header bell (43 · 44): a dot while something is unread, a drop-down list on click. Opening the list marks what it
 * shows as read (44 with their ids; 「모두 읽음」 without ids); the dots of the newly read stay for this opening. The list
 * pages with `nextBefore` as it scrolls. The unread count is read on entry, when the tab shows again and at most every
 * five minutes while it stays visible — never while hidden.
 */
export function NotificationBell() {
  const { status } = useBackend()
  const { state } = useDemo()
  const navigate = useNavigate()
  const userId = state.profile.loggedIn ? state.profile.userId : undefined
  const [unread, setUnread] = useState<{ userId: number | undefined; count: number }>({ userId: undefined, count: 0 })
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<{ items: NotificationView[]; nextBefore: number | null; status: 'loading' | 'ready' | 'error'; fresh: ReadonlySet<number> }>({
    items: [], nextBefore: null, status: 'loading', fresh: new Set(),
  })
  const [loadingMore, setLoadingMore] = useState(false)
  /** "Now" for the relative times, taken when the list opens. */
  const [now, setNow] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const count = unread.userId === userId ? unread.count : 0

  // ── Unread count ──
  useEffect(() => {
    if (status !== 'ready' || userId === undefined) return
    let alive = true
    const refresh = () => {
      getNotifications(api, { size: 1 })
        .then(dto => { if (alive) setUnread({ userId, count: notificationPage(dto).unreadCount }) })
        .catch(() => { /* Keep the last count; the next refresh tries again. */ })
    }
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, UNREAD_REFRESH_MS)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer) }
  }, [status, userId])

  // ── The list ──
  const markShownRead = useCallback(async (items: readonly NotificationView[]) => {
    const ids = unreadIds(items)
    if (!ids.length) return
    try {
      const result = await readNotifications(api, ids)
      if (typeof result?.unreadCount === 'number') setUnread({ userId, count: result.unreadCount })
      setList(current => ({ ...current, items: markRead(current.items, ids) }))
    } catch { /* They stay unread on the server; the dots stay too. */ }
  }, [userId])

  const loadFirst = useCallback(async () => {
    setList({ items: [], nextBefore: null, status: 'loading', fresh: new Set() })
    try {
      const page = notificationPage(await getNotifications(api, { size: PAGE_SIZE }))
      setUnread({ userId, count: page.unreadCount })
      setList({ items: page.items, nextBefore: page.nextBefore, status: 'ready', fresh: new Set(unreadIds(page.items)) })
      void markShownRead(page.items)
    } catch {
      setList(current => ({ ...current, status: 'error' }))
    }
  }, [userId, markShownRead])

  const loadMore = useCallback(async () => {
    if (loadingMore || list.status !== 'ready' || list.nextBefore === null) return
    setLoadingMore(true)
    try {
      const page = notificationPage(await getNotifications(api, { before: list.nextBefore, size: PAGE_SIZE }))
      setList(current => ({
        ...current,
        items: appendNotifications(current.items, page.items),
        nextBefore: page.nextBefore,
        fresh: new Set([...current.fresh, ...unreadIds(page.items)]),
      }))
      void markShownRead(page.items)
    } catch { /* The next scroll tries again. */ }
    finally { setLoadingMore(false) }
  }, [loadingMore, list.status, list.nextBefore, markShownRead])

  async function readAll() {
    try {
      const result = await readNotifications(api)
      setUnread({ userId, count: typeof result?.unreadCount === 'number' ? result.unreadCount : 0 })
      setList(current => ({ ...current, items: markRead(current.items) }))
    } catch { /* Nothing changes. */ }
  }

  function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    setNow(Date.now())
    void loadFirst()
  }

  // Outside click and Esc close the list; Esc returns the focus to the bell.
  useEffect(() => {
    if (!open) return
    const pointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', pointer)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key) }
  }, [open])

  if (userId === undefined) return null
  return (
    <div ref={root} className="notification-bell">
      <button
        ref={trigger}
        type="button"
        className="notification-bell-button"
        aria-label={count > 0 ? `${NOTIFICATION_COPY.bell} · ${NOTIFICATION_COPY.unread(count)}` : NOTIFICATION_COPY.bell}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        data-tour="notifications"
        onClick={toggle}
      >
        <BellIcon />
        {count > 0 && <span className="notification-bell-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label={NOTIFICATION_COPY.title} className="notification-panel" data-notification-panel>
          <div className="notification-panel-head">
            <h2 className="notification-panel-title">{NOTIFICATION_COPY.title}</h2>
            {list.items.some(item => !item.read) || count > 0 ? (
              <button type="button" className="notification-read-all" onClick={() => void readAll()}>{NOTIFICATION_COPY.readAll}</button>
            ) : null}
          </div>
          <div
            className="notification-list"
            onScroll={event => {
              const node = event.currentTarget
              if (node.scrollHeight - node.scrollTop - node.clientHeight < 80) void loadMore()
            }}
          >
            {list.status === 'loading' && (
              <div className="notification-skeleton" aria-busy="true">
                <span className="sr-only" role="status">알림을 불러오고 있어요.</span>
                <span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" />
              </div>
            )}
            {list.status === 'error' && (
              <div className="notification-empty" role="alert">
                <p>{NOTIFICATION_COPY.failed}</p>
                <Button size="sm" variant="secondary" onClick={() => void loadFirst()}>{NOTIFICATION_COPY.retry}</Button>
              </div>
            )}
            {list.status === 'ready' && list.items.length === 0 && (
              <div className="notification-empty">
                <p className="notification-empty-title">{NOTIFICATION_COPY.empty}</p>
                <p className="notification-empty-sub">{NOTIFICATION_COPY.emptySub}</p>
              </div>
            )}
            {list.status === 'ready' && list.items.length > 0 && (
              <ul className="notification-items">
                {list.items.map(item => {
                  const isNew = list.fresh.has(item.id) || !item.read
                  const content = (
                    <>
                      <span className="notification-item-title">
                        {isNew && <span className="notification-item-dot" aria-label={NOTIFICATION_COPY.unreadMark} role="img" />}
                        {item.title}
                      </span>
                      {item.body && <span className="notification-item-body">{item.body}</span>}
                      <time className="notification-item-time" dateTime={new Date(item.createdAt).toISOString()}>{relativeTime(item.createdAt, now)}</time>
                    </>
                  )
                  return (
                    <li key={item.id} data-unread={isNew || undefined}>
                      {item.link ? (
                        <button type="button" className="notification-item" onClick={() => { setOpen(false); navigate(item.link!) }}>{content}</button>
                      ) : (
                        <div className="notification-item">{content}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {loadingMore && <p className="notification-more" role="status">{NOTIFICATION_COPY.loadingMore}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
