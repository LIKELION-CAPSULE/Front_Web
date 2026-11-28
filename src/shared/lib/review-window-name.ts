/** `window.name` prefix the UI review workbench gives each preview iframe (src/features/review). Dev only. */
export const REVIEW_WINDOW_NAME_PREFIX = 'capsule-ui-review:'

export interface ReviewWindowLike {
  name: string
  self: unknown
  top: unknown
}

/**
 * The review scenario a preview iframe was opened for, read from `window.name` (it survives full-page navigations
 * inside the frame, where `?__review` is lost). Only a framed window counts: `window.name` also survives navigations
 * in a top-level tab, so a tab that once opened `/?__review=mobile-notice` would otherwise stay on that scenario on
 * every later address (`localhost:3000/` showing only the mobile notice). A stale name in a top-level tab is cleared.
 */
export function reviewIdFromWindowName(win: ReviewWindowLike | undefined = typeof window === 'undefined' ? undefined : window): string | null {
  if (!win || !win.name.startsWith(REVIEW_WINDOW_NAME_PREFIX)) return null
  let framed: boolean
  try {
    framed = win.self !== win.top
  } catch {
    framed = true
  }
  if (!framed) {
    win.name = ''
    return null
  }
  return win.name.slice(REVIEW_WINDOW_NAME_PREFIX.length) || null
}

/** Remembers a preview's scenario across navigations, only inside the workbench's iframe. */
export function rememberReviewIdInWindowName(id: string, win: ReviewWindowLike = window): void {
  if (win.self !== win.top) win.name = `${REVIEW_WINDOW_NAME_PREFIX}${id}`
}
