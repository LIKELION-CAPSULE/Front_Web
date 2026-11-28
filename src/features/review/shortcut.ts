/** The workbench address the dev entry points open. */
export const REVIEW_WORKBENCH_PATH = '/__review'

/**
 * Ctrl/⌘+Shift+D opens the UI review workbench in a new tab. Development only: the one listener both dev entry points
 * use (ReviewLauncher in api mode, the local demo controls in mock mode). Returns the cleanup for `useEffect`.
 */
export function listenReviewShortcut(target: Window = window) {
  const open = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault()
      target.open(REVIEW_WORKBENCH_PATH, '_blank', 'noopener,noreferrer')
    }
  }
  target.addEventListener('keydown', open)
  return () => target.removeEventListener('keydown', open)
}
