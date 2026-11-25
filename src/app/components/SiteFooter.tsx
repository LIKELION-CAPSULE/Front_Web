import { useContext } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { BackendContext } from '@/features/backend/backend-context'
import { availableMates } from '@/features/mates/catalog'
import { beginTour } from '@/features/tour/tour-start'

const LINKS = [
  { label: '서비스 소개', href: '#' },
  { label: '이용약관', href: '#' },
  { label: '개인정보 처리방침', href: '#' },
  { label: '고객 문의', href: '#' },
] as const

/** Simple single-colour marks; the links are placeholders until the channels exist. */
const SOCIAL = [
  {
    label: 'Discord',
    path: 'M19.6 5.6A16 16 0 0 0 15.7 4.4l-.5 1a14.6 14.6 0 0 0-6.4 0l-.5-1a16 16 0 0 0-3.9 1.2C1.9 9.4 1.2 13 1.5 16.6a16 16 0 0 0 4.8 2.4l1-1.6a10.4 10.4 0 0 1-1.6-.8l.4-.3a11.4 11.4 0 0 0 11.8 0l.4.3c-.5.3-1 .6-1.6.8l1 1.6a16 16 0 0 0 4.8-2.4c.4-4.2-.6-7.8-3-11zM8.7 14.4c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.8.9 1.7 2c0 1.1-.8 2-1.7 2zm6.6 0c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.8.9 1.7 2c0 1.1-.8 2-1.7 2z',
  },
  {
    label: 'YouTube',
    path: 'M22.5 7.2a2.8 2.8 0 0 0-2-2C18.7 4.7 12 4.7 12 4.7s-6.7 0-8.5.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 4.8 2.8 2.8 0 0 0 2 2c1.8.5 8.5.5 8.5.5s6.7 0 8.5-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-4.8zM9.8 15.1V8.9l5.6 3.1z',
  },
  {
    label: 'X',
    path: 'M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z',
  },
] as const

export function SiteFooter() {
  const location = useLocation()
  const navigate = useNavigate()
  // The loading skeleton draws this footer before the backend is ready: no tour then. The tour walks through a mate's
  // screens, so without a mate there is nothing to show yet.
  const backend = useContext(BackendContext)
  const tourReady = backend ? availableMates(backend.home).length > 0 : false
  return (
    <footer className="app-footer page-container">
      <div className="app-footer-start">
        <span className="app-footer-brand">CAPSULE</span>
        <nav aria-label="서비스 정보" className="app-footer-links">
          <a href={LINKS[0].href}>{LINKS[0].label}</a>
          {/* 「사용법 보기」 starts the service tour (src/features/tour) from any screen; 「건너뛰기」 comes back here. */}
          <button type="button" className="mate-tutorial-trigger" data-tutorial-trigger disabled={!tourReady}
            onClick={() => navigate(beginTour(location.pathname + location.search))}>사용법 보기</button>
          {LINKS.slice(1).map((link) => <a key={link.label} href={link.href}>{link.label}</a>)}
        </nav>
      </div>
      <div className="app-footer-end">
        <span>오늘도, CAPSULE과 함께하세요 ♡</span>
        <div className="app-footer-social">
          {SOCIAL.map((item) => (
            <a key={item.label} href="#" aria-label={item.label}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={item.path} fill="currentColor" /></svg>
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
