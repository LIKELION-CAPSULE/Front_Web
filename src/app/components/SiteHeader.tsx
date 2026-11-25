import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Brand } from '@/shared/ui/Brand'

let stickyHeader: HTMLElement | null = null

/**
 * The app header (home and every app screen). `logo-only`: the same bar (height, background, bottom divider, logo place
 * and size) with only the logo, not a link — for onboarding, where leaving for home halfway is not offered.
 */
export function SiteHeader({
  navigation = null,
  account = null,
  sticky = false,
  variant = 'full',
}: {
  navigation?: ReactNode
  account?: ReactNode
  sticky?: boolean
  variant?: 'full' | 'logo-only'
}) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const header = ref.current
    if (!sticky || !header) return
    const root = document.documentElement
    const measure = () => {
      const height = header.getBoundingClientRect().height
      if (!height) return
      stickyHeader = header
      // Viewport notifications are portalled to body, so share the measured height at the document root.
      root.style.setProperty('--site-header-height', `${Math.ceil(height)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => {
      observer.disconnect()
      if (stickyHeader === header) {
        stickyHeader = null
        root.style.removeProperty('--site-header-height')
      }
    }
  }, [sticky])
  return (
    <header ref={ref} className="site-header" data-sticky={sticky || undefined} data-variant={variant === 'logo-only' ? variant : undefined}>
      <div className="page-container site-header-inner">
        {variant === 'logo-only' ? (
          <span className="site-header-brand">
            <Brand />
          </span>
        ) : (
          <>
            <Link to="/" aria-label="CAPSULE 홈" className="site-header-brand">
              <Brand />
            </Link>
            {navigation}
            <div className="site-header-account">{account}</div>
          </>
        )}
      </div>
    </header>
  )
}
