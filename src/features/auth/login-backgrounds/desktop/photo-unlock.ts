export type PhotoTapState = { count: number; lastAt: number }
export type PhotoTapStage = 'none' | 'peek' | 'open'

export const INITIAL_PHOTO_TAP_STATE: PhotoTapState = { count: 0, lastAt: Number.NEGATIVE_INFINITY }

/**
 * Counts consecutive taps on the photos folder. A gap longer than `tapGapMs` restarts the count.
 * Returns the stage reached by this tap (only on the exact tap that crosses a threshold).
 */
export function registerPhotoTap(
  state: PhotoTapState,
  now: number,
  config: { tapGapMs: number; peekAt: number; openAt: number },
): { state: PhotoTapState; stage: PhotoTapStage } {
  const count = now - state.lastAt <= config.tapGapMs ? state.count + 1 : 1
  const stage: PhotoTapStage = count === config.openAt ? 'open' : count === config.peekAt ? 'peek' : 'none'
  return { state: { count: stage === 'open' ? 0 : count, lastAt: stage === 'open' ? Number.NEGATIVE_INFINITY : now }, stage }
}
