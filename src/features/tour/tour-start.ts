import { TOUR_ORIGIN_KEY } from './tour-steps'

/** The first step's address (home). */
export const TOUR_START_HREF = '/?tour=home-card'

/** Remembers where the tour was opened (「건너뛰기」 returns there) and gives the first step's address. */
export function beginTour(origin: string): string {
  try { sessionStorage.setItem(TOUR_ORIGIN_KEY, origin) } catch { /* Skip then returns home. */ }
  return TOUR_START_HREF
}
