import { Outlet } from 'react-router'

export function DetailLayout() {
  return (
    <div className="detail-shell min-h-dvh">
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      <Outlet />
    </div>
  )
}
