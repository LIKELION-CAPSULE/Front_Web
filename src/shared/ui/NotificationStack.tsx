import { useRef, type FocusEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { Icon, type IconName } from './Icon'
import type { FeedbackTone } from './FeedbackMessage'
import type { NotificationItem } from './notification-queue'
import './notification-stack.css'

const icons: Record<FeedbackTone, IconName> = { success: 'check', warning: 'warning', error: 'warning', info: 'info' }

function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss: (id: string) => void }) {
  const reduced = useReducedMotion()
  const present = useIsPresent()
  const card = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  function rememberFocus(event: FocusEvent<HTMLButtonElement>) {
    if (event.relatedTarget instanceof HTMLElement && !card.current?.contains(event.relatedTarget)) previousFocus.current = event.relatedTarget
  }
  function dismiss() {
    if (card.current?.contains(document.activeElement)) {
      const previous = previousFocus.current
      const target = previous?.isConnected && previous.getClientRects().length && !previous.closest('[inert], [aria-hidden="true"], [hidden]')
        ? previous : document.querySelector<HTMLElement>('#main-content h1') ?? document.getElementById('main-content')
      target?.focus({ preventScroll: true })
    }
    onDismiss(item.id)
  }

  return <motion.div
    ref={card}
    role={item.tone === 'error' || item.tone === 'warning' ? 'alert' : 'status'}
    aria-atomic="true"
    aria-labelledby={`${item.id}-title`}
    aria-describedby={`${item.id}-description`}
    aria-hidden={!present || undefined}
    inert={!present}
    data-feedback={item.tone}
    className="notification-card"
    layout={reduced ? false : 'position'}
    initial={reduced ? false : { x: 72, opacity: 0, scale: 0.96 }}
    animate={{ x: 0, opacity: 1, scale: 1 }}
    exit={{ x: reduced ? 0 : 72, opacity: 0, transition: { duration: reduced ? 0 : 0.18 } }}
    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
  >
    <span className="notification-icon"><Icon name={icons[item.tone]} size={21} /></span>
    <div className="notification-content">
      <p id={`${item.id}-title`} className="notification-title">{item.title}</p>
      <p id={`${item.id}-description`} className="notification-description">{item.text}</p>
    </div>
    <button type="button" className="notification-close" aria-label={`${item.title} 알림 닫기`} onFocus={rememberFocus} onClick={dismiss}><Icon name="close" size={16} /></button>
  </motion.div>
}

export function NotificationStack({ items, onDismiss }: { items: readonly NotificationItem[]; onDismiss: (id: string) => void }) {
  return createPortal(<aside className="notification-stack" aria-label="알림" aria-hidden={!items.length || undefined}>
    <AnimatePresence initial={false}>
      {items.map(item => <NotificationCard key={item.id} item={item} onDismiss={onDismiss} />)}
    </AnimatePresence>
  </aside>, document.body)
}
