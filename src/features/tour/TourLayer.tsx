import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './tour-layer.css'

/**
 * The one owner of the tour's lock (in the main bundle, so it holds from the first frame — also while the controller's
 * chunk is still loading):
 *
 * - On mount the app is made inert and the page stops scrolling; on unmount (the tour ended, or the address lost
 *   `?tour`) both come back, once, and focus returns to where it was if nothing else took it.
 * - The tour UI lives in a manual popover (top layer). When a native modal dialog is open (the account settings), the
 *   layer moves inside it, so it stays above the dialog and usable, and the dialog's own content is made inert instead
 *   of `#root` (which would make the dialog inert too).
 */
export function TourLayer({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement>(() => openDialog() ?? document.body)

  // The lock: set before the first paint, released once on unmount.
  useLayoutEffect(() => {
    const html = document.documentElement
    const overflow = html.style.overflow
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = overflow
      for (const node of document.querySelectorAll('[data-tour-inert]')) {
        node.removeAttribute('inert')
        node.removeAttribute('data-tour-inert')
      }
      // Whoever ends the tour may move focus itself (「사용법 보기」, the mate list); otherwise it goes back.
      requestAnimationFrame(() => {
        const active = document.activeElement
        if ((!active || active === document.body) && focused?.isConnected) focused.focus({ preventScroll: true })
      })
    }
  }, [])

  // Follows the account dialog opening and closing (the address opens it; its lazy chunk may land later).
  useEffect(() => {
    let frame = 0
    const follow = () => {
      const next = openDialog() ?? document.body
      setHost((old) => (old === next ? old : next))
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [])

  const layer = useMemo(() => {
    const div = document.createElement('div')
    div.className = 'service-tour-layer'
    div.setAttribute('popover', 'manual')
    return div
  }, [host]) // eslint-disable-line react-hooks/exhaustive-deps -- a new layer for each host

  useLayoutEffect(() => {
    host.append(layer)
    try { layer.showPopover() } catch { /* No popover support: the fixed layer still covers the page. */ }
    const blocked = host === document.body
      ? [document.getElementById('root')].filter((node): node is HTMLElement => Boolean(node))
      : [...host.children].filter((child) => child !== layer)
    for (const node of blocked) {
      if (node.hasAttribute('inert') && !node.hasAttribute('data-tour-inert')) continue // someone else's
      node.setAttribute('inert', '')
      node.setAttribute('data-tour-inert', '')
    }
    return () => {
      for (const node of blocked) {
        if (!node.hasAttribute('data-tour-inert')) continue
        node.removeAttribute('inert')
        node.removeAttribute('data-tour-inert')
      }
      try { layer.hidePopover() } catch { /* Already hidden. */ }
      layer.remove()
    }
  }, [host, layer])

  return createPortal(children, layer)
}

function openDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('dialog[open]')
}
