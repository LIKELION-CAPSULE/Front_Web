import { TOUR_ORIGIN_KEY } from './tour-steps'

/** The first step's address (home). */
export const TOUR_START_HREF = '/?tour=home-card'

/** Remembers where the tour was opened (「건너뛰기」 returns there) and gives the first step's address. */
export function beginTour(origin: string): string {
  try { sessionStorage.setItem(TOUR_ORIGIN_KEY, origin) } catch { /* Skip then returns home. */ }
  return TOUR_START_HREF
}

/** Where 「건너뛰기」 goes: the screen the tour was opened from (home when unknown), without tour or account state. */
export function takeTourOrigin(): string {
  let origin = '/'
  try {
    origin = sessionStorage.getItem(TOUR_ORIGIN_KEY) || '/'
    sessionStorage.removeItem(TOUR_ORIGIN_KEY)
  } catch { /* Home. */ }
  const url = new URL(origin, 'http://capsule.local')
  url.searchParams.delete('tour')
  url.searchParams.delete('account')
  return `${url.pathname}${url.search}${url.hash}`
}

/** After the tour closes on home, 「사용법 보기」 gets focus back (it is there once the screen has rendered). */
export function focusTourTrigger() {
  window.setTimeout(() => document.querySelector<HTMLElement>('.mate-tutorial-trigger')?.focus({ preventScroll: true }), 200)
}
