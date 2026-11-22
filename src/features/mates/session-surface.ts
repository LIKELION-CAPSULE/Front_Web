import type { ActiveSession } from '../demo/types.ts'

/** Both surfaces are supported while the old study routes are being retired. */
export function isSessionSurface(pathname: string, session: Pick<ActiveSession, 'id' | 'mateId'>) {
  return pathname === `/study/${session.id}` || (!!session.mateId && pathname === `/connect/${session.mateId}`)
}
