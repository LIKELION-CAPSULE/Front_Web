import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GUIDE_COPY } from '../guide-steps'
import { GuideDesk3D } from './GuideDesk3D'
import { GuideSlides } from './GuideSlides'
import '../usage-guide.css'

type Mode = '3d' | '2d' | 'static'
const DESKTOP = '(min-width: 769px)'
const REDUCED = '(prefers-reduced-motion: reduce)'
/** Matches the fade-out in usage-guide.css. */
const CLOSE_MS = 220

function getMode(): Mode {
  if (window.matchMedia(REDUCED).matches) return 'static'
  return window.matchMedia(DESKTOP).matches ? '3d' : '2d'
}
function subscribe(callback: () => void) {
  const queries = [DESKTOP, REDUCED].map((query) => window.matchMedia(query))
  queries.forEach((query) => query.addEventListener('change', callback))
  return () => queries.forEach((query) => query.removeEventListener('change', callback))
}

export type GuideCloseReason = 'skip' | 'start'

/**
 * Full-screen usage guide. A native modal, so the page behind keeps its scroll position and cannot be reached;
 * "건너뛰기" and Esc close it from any step, and the last step's button closes it with `start`.
 * Loaded lazily by the home page, so nothing here (least of all three.js) is in the home bundle.
 */
export default function UsageGuideOverlay({ onClose }: { onClose: (reason: GuideCloseReason) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const mode = useSyncExternalStore(subscribe, getMode, () => 'static' as Mode)
  const [webglFailed, setWebglFailed] = useState(false)
  const [closing, setClosing] = useState<GuideCloseReason | null>(null)
  const done = useRef(onClose)

  useEffect(() => {
    done.current = onClose
  })

  useLayoutEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => {
      if (element?.open) element.close()
    }
  }, [])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => done.current(closing), mode === 'static' ? 0 : CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [closing, mode])

  const close = (reason: GuideCloseReason) => setClosing((current) => current ?? reason)

  return (
    <dialog
      ref={dialog}
      className="usage-guide"
      aria-label={GUIDE_COPY.dialogLabel}
      data-closing={closing ? '' : undefined}
      onCancel={(event) => {
        event.preventDefault()
        close('skip')
      }}
    >
      {mode === '3d' && !webglFailed ? (
        <GuideDesk3D onFail={() => setWebglFailed(true)} onStart={() => close('start')} />
      ) : (
        <GuideSlides animated={mode !== 'static'} onStart={() => close('start')} />
      )}
      <button type="button" className="usage-guide-skip" onClick={() => close('skip')}>
        {GUIDE_COPY.skip}
      </button>
    </dialog>
  )
}
