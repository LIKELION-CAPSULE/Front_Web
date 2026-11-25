import { lazy, Suspense, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { TourLayer } from './TourLayer'
import { focusTourTrigger, takeTourOrigin } from './tour-start'

/** The tour controller (and the cursor library with gsap) is its own chunk, loaded only while `?tour=` is in the address. */
const ServiceTour = lazy(() => import('./ServiceTour'))
const TourCallPage = lazy(() => import('./TourCallPage'))

/** How many TourLayout routes are mounted now (one at most; a plain store so TourOverlay can hear it from outside). */
let screens = 0
const listeners = new Set<() => void>()
const onScreens = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const onTourScreen = () => screens > 0

/**
 * Wraps the signed-in screens the tour visits (the route guard has let the user in). The tour itself runs in
 * TourOverlay, outside the routes: App's route Suspense is keyed by the path, so everything inside it remounts on a new
 * address (and is replaced by the page loading screen while the next page loads) — the tour must not.
 */
export function TourLayout() {
  useLayoutEffect(() => {
    screens++
    for (const listener of listeners) listener()
    return () => {
      screens--
      for (const listener of listeners) listener()
    }
  }, [])
  return <Outlet />
}

/**
 * Runs the tour over the screens while `?tour=` is in the address (App renders it beside the route Suspense, not inside
 * it). It starts only on a TourLayout screen — a guest or a still-loading app never sees it — and then stays mounted
 * while `?tour=` stays, also between screens: the dim, the lit area and 채린's cursor keep their places while the next
 * page loads (user decision 2026-11-26; it used to vanish for ~300 ms on every new address). The lock (TourLayer) is
 * synchronous: the real screen is inert from the first frame, also while the controller's chunk loads, when a small
 * panel says so and can already skip.
 */
export function TourOverlay() {
  const { search } = useLocation()
  const running = new URLSearchParams(search).has('tour')
  const onScreen = useSyncExternalStore(onScreens, onTourScreen, () => false)
  const [armed, setArmed] = useState(false)
  // Armed on a tour screen; disarmed only when `?tour` leaves the address (the tour ended, or the user left).
  if (armed && !running) setArmed(false)
  if (!armed && running && onScreen) setArmed(true)
  if (!(running && (armed || onScreen))) return null
  return (
    <TourLayer>
      <Suspense fallback={<TourLoading />}>
        <ServiceTour />
      </Suspense>
    </TourLayer>
  )
}

/** While the controller loads: the page is dimmed and locked; 「그만보기」 (or Esc) ends the tour already. */
function TourLoading() {
  const navigate = useNavigate()
  useEffect(() => {
    const skip = () => {
      navigate(takeTourOrigin(), { replace: true })
      focusTourTrigger()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      skip()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [navigate])
  return (
    <div className="service-tour service-tour-loading">
      <div className="service-tour-dim" aria-hidden="true" />
      <div className="service-tour-panel" role="dialog" aria-modal="true" aria-label="캡슐 사용법" aria-busy="true">
        <p className="service-tour-loading-text" role="status">사용법 불러오는 중</p>
        <div className="service-tour-actions">
          <Button variant="ghost" size="sm" autoFocus onClick={() => { navigate(takeTourOrigin(), { replace: true }); focusTourTrigger() }}>그만보기</Button>
        </div>
      </div>
    </div>
  )
}

/** `/tour/call/:mateId`: the practice call (outside the tour it leads home). */
export function TourCallRoute() {
  return <TourCallPage />
}
