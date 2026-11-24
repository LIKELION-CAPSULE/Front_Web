import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'

/** The tour controller (and the cursor library with gsap) is its own chunk, loaded only while `?tour=` is in the address. */
const ServiceTour = lazy(() => import('./ServiceTour'))
const TourCallPage = lazy(() => import('./TourCallPage'))

/** Wraps the signed-in screens the tour visits and mounts the tour over them while it runs. */
export function TourLayout() {
  const { search } = useLocation()
  const running = new URLSearchParams(search).has('tour')
  return (
    <>
      <Outlet />
      {running && <Suspense fallback={null}><ServiceTour /></Suspense>}
    </>
  )
}

/** `/tour/call/:mateId`: the practice call (outside the tour it leads home). */
export function TourCallRoute() {
  return <TourCallPage />
}
