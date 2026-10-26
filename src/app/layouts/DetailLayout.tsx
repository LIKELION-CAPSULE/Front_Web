import { Outlet } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'

export function DetailLayout() {
  return (
    <div className="min-h-dvh bg-canvas">
      <PageNavigation />
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Outlet />
      </main>
    </div>
  )
}
