import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DESKTOP_LOGIN_ASSETS } from '@/features/auth/login-backgrounds/desktop/desktop-config'
import { Brand } from '@/shared/ui/Brand'

let stickyHeader: HTMLElement | null = null

export function SiteHeader({ navigation, account, sticky = false }: { navigation: ReactNode; account: ReactNode; sticky?: boolean }) {
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
    <header ref={ref} className="site-header" data-sticky={sticky || undefined}>
      <div className="page-container site-header-inner">
        <Link to="/" aria-label="CAPSULE 홈" className="site-header-brand">
          <img
            src={DESKTOP_LOGIN_ASSETS.logo.symbol}
            alt=""
            aria-hidden="true"
            className="site-header-symbol"
            draggable={false}
          />
          <span className="site-header-mobile-brand">
            <Brand />
          </span>
        </Link>
        {navigation}
        <div className="site-header-account">{account}</div>
      </div>
    </header>
  )
}
