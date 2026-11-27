import { Outlet } from 'react-router'
import { SiteFooter } from '@/app/components/SiteFooter'

/**
 * 메이트 상세 and 연결 기록: full-screen pages under their own header. The site footer follows them, so the AI disclosure
 * line is on these screens too (PM decision 2026-11-26: the footer carries it for every app screen; the call, sign-up
 * and practice-call screens keep none).
 */
export function DetailLayout() {
  return (
    <div className="detail-shell min-h-dvh">
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      <Outlet />
      <SiteFooter />
    </div>
  )
}
