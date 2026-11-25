import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { TourLayer } from './TourLayer'
import { focusTourTrigger, takeTourOrigin } from './tour-start'

/** The tour controller (and the cursor library with gsap) is its own chunk, loaded only while `?tour=` is in the address. */
const ServiceTour = lazy(() => import('./ServiceTour'))
const TourCallPage = lazy(() => import('./TourCallPage'))

/**
 * Wraps the signed-in screens the tour visits and runs the tour over them while `?tour=` is in the address. The lock
 * (TourLayer) is synchronous: the real screen is inert from the first frame, also while the controller's chunk loads,
 * when a small panel says so and can already skip.
 */
export function TourLayout() {
  const { search } = useLocation()
  const running = new URLSearchParams(search).has('tour')
  return (
    <>
      <Outlet />
      {running && (
        <TourLayer>
          <Suspense fallback={<TourLoading />}>
            <ServiceTour />
          </Suspense>
        </TourLayer>
      )}
    </>
  )
}

/** While the controller loads: the page is dimmed and locked; 「건너뛰기」 (or Esc) ends the tour already. */
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
          <Button variant="ghost" size="sm" autoFocus onClick={() => { navigate(takeTourOrigin(), { replace: true }); focusTourTrigger() }}>건너뛰기</Button>
        </div>
      </div>
    </div>
  )
}

/** `/tour/call/:mateId`: the practice call (outside the tour it leads home). */
export function TourCallRoute() {
  return <TourCallPage />
}
