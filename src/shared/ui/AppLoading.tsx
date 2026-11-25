import { useLocation } from 'react-router'
import { isLoginLayoutPath } from '@/features/auth/kakao-signup'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { QuarterRingSpinner } from './QuarterRingSpinner'
import './app-loading.css'

/**
 * Route/auth loading screen. `/login` gets a neutral dark backdrop in the same tone as the login screen
 * (never the old desktop wallpaper), so a refresh does not flash a different scene before the login UI mounts.
 */
export function AppLoading({ label = '화면을 불러오고 있어요.' }: { label?: string }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  if (!isLoginLayoutPath(pathname)) {
    return <main id="main-content" className="app-loading-stage" data-loading-screen="auth" role="status" aria-busy="true">
      <div className="app-panel app-loading-body"><QuarterRingSpinner /><p className="app-loading-label">{label}</p></div>
    </main>
  }

  return (
    <div className="app-loading app-loading--login" data-loading-screen="auth">
      <main
        id="main-content"
        tabIndex={-1}
        role="status"
        aria-busy="true"
        className="app-loading-stage focus:outline-none"
      >
        <div className="app-loading-login-body">
          {reduced ? (
            <span className="app-loading-static-dots" aria-hidden="true">
              <span className="app-loading-static-dot" />
              <span className="app-loading-static-dot" />
              <span className="app-loading-static-dot" />
            </span>
          ) : (
            <QuarterRingSpinner className="app-loading-spinner" />
          )}
          <p className="app-loading-label">{label}</p>
        </div>
      </main>
    </div>
  )
}
