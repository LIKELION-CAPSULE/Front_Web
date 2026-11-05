import { useEffect } from 'react'
import './launcher.css'

export function ReviewLauncher() {
  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault()
        window.open('/__review', '_blank', 'noopener,noreferrer')
      }
    }
    window.addEventListener('keydown', open)
    return () => window.removeEventListener('keydown', open)
  }, [])
  return <a className="review-launcher" href="/__review" target="_blank" rel="noopener noreferrer" title="UI/UX 검토 · Ctrl/⌘+Shift+D">
    <span aria-hidden="true">◫</span> UI 검토 <small>DEV</small>
  </a>
}
