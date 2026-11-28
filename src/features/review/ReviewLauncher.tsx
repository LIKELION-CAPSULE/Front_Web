import { useEffect } from 'react'
import { listenReviewShortcut, REVIEW_WORKBENCH_PATH } from './shortcut'
import './launcher.css'

/** Development (api mode) entry to the workbench: a corner link and Ctrl/⌘+Shift+D. Mock mode has LocalControls instead. */
export function ReviewLauncher() {
  useEffect(() => listenReviewShortcut(), [])
  return <a className="review-launcher" href={REVIEW_WORKBENCH_PATH} target="_blank" rel="noopener noreferrer" aria-label="UI/UX 검토 열기 (Ctrl/⌘+Shift+D)" title="UI/UX 검토 · Ctrl/⌘+Shift+D">
    <span aria-hidden="true">◫</span><span className="review-launcher-label" aria-hidden="true">UI 검토 <small>DEV</small></span>
  </a>
}
