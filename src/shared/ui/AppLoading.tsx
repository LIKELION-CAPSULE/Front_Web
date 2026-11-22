import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { MenuBar } from '@/features/auth/login-backgrounds/desktop/MenuBar'
import {
  STATIC_FIRST_PAINT_WALLPAPERS,
  TIME_OF_DAY_PALETTES,
  resolveTimeBand,
  type TimeOfDayBand,
  type TimeOfDayMode,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import { QuarterRingSpinner } from './QuarterRingSpinner'
import './app-loading.css'

const VALID_TIME_MODES = new Set<TimeOfDayMode>(['auto', 'dawn', 'morning', 'day', 'sunset', 'night'])

function getInitialTimeBand(): TimeOfDayBand {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    try {
      const raw = new URLSearchParams(window.location.search).get('dTime') as TimeOfDayMode | null
      if (raw && VALID_TIME_MODES.has(raw)) return resolveTimeBand(raw)
    } catch {
      // ignore URL errors
    }
  }
  return resolveTimeBand('auto')
}

export function AppLoading({ label = '화면을 불러오고 있어요.' }: { label?: string }) {
  const reduced = useReducedMotion()
  const band = getInitialTimeBand()
  const palette = TIME_OF_DAY_PALETTES[band]
  const wallpaperUrl = STATIC_FIRST_PAINT_WALLPAPERS[band]
  const fallbackGradient = {
    background: `radial-gradient(ellipse 75% 58% at 50% 62%, ${palette.glow}38 0%, transparent 72%), linear-gradient(180deg, ${palette.top} 0%, ${palette.mid} 52%, ${palette.bottom} 100%)`,
  }

  return (
    <div className="app-loading desktop-login-root" data-loading-screen="auth">
      <div className="desktop-wallpaper-layer" style={fallbackGradient} aria-hidden="true">
        <img
          src={wallpaperUrl}
          alt=""
          aria-hidden="true"
          className="desktop-wallpaper-static-img"
          draggable={false}
        />
      </div>

      <MenuBar />

      <main
        id="main-content"
        tabIndex={-1}
        role="status"
        aria-busy="true"
        className="app-loading-stage focus:outline-none"
      >
        <section className="desktop-window desktop-window--active app-loading-window" aria-label="불러오는 중">
          <div className="desktop-window-titlebar app-loading-titlebar">
            <div className="desktop-window-title-left">CAPSULE</div>
            <div className="desktop-window-title-right">
              <div className="desktop-window-controls" aria-hidden="true">
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
                <span className="desktop-window-dot" />
              </div>
            </div>
          </div>
          <div className="desktop-window-body app-loading-body">
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
        </section>
      </main>
    </div>
  )
}
