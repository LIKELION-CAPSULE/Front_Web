import { useEffect, useState } from 'react'
import { useWindupString } from 'windups'
import { reactionBubbleDurationMs } from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { speechPace } from '@/features/session/speech-pace'
import { PixelRoofStrip } from '@/shared/ui/pixel/PixelFrame'
import '@/features/mates/call-dialogue.css'
import './mate-dialogue.css'
import './login-stage-dialogue.css'

/** Length of the shared `login-dialogue-out` animation in mate-dialogue.css. */
const LEAVE_MS = 180

/**
 * Visual-novel style dialogue box for the mate's line on the login stage.
 * The line types out (same pace as the study screen's speech bubble); the display time starts once typing ends.
 * Mount with a new `key` per line so a new line restarts from the beginning.
 *
 * Everything here is `aria-hidden`: the layout keeps a separate live region with the full line, so screen readers
 * hear it once instead of every typed character.
 */
export function MateDialogue({
  id,
  name,
  text,
  reducedMotion,
  onDone,
  appearance = 'rounded',
}: {
  id: number
  name: string
  text: string
  reducedMotion: boolean
  /** Stable callback; receives this line's `id` once it has left. */
  onDone: (id: number) => void
  /** Only the login stage shares C1's frame; home keeps the rounded glass. */
  appearance?: 'rounded' | 'stage'
}) {
  const [typed, { isFinished }] = useWindupString(text, { pace: speechPace, skipped: reducedMotion })
  const [leaving, setLeaving] = useState(false)

  // Hold the full line for its reading time after it has finished typing, then leave.
  useEffect(() => {
    if (!isFinished) return
    const hold = window.setTimeout(() => setLeaving(true), reactionBubbleDurationMs(text))
    return () => window.clearTimeout(hold)
  }, [isFinished, text])

  // Without motion there is no exit animation to wait for.
  useEffect(() => {
    if (!leaving) return
    const done = window.setTimeout(() => onDone(id), reducedMotion ? 0 : LEAVE_MS)
    return () => window.clearTimeout(done)
  }, [leaving, reducedMotion, onDone, id])

  const stage = appearance === 'stage'
  const prefix = stage ? 'call-dialogue' : 'login-dialogue'
  return (
    <div className={stage ? 'call-dialogue login-stage-dialogue' : 'login-dialogue'} aria-hidden="true" data-calm={stage || undefined} data-leaving={leaving || undefined} data-typing={!isFinished || undefined}>
      {stage && <span className="call-dialogue-frame"><PixelRoofStrip /></span>}
      <span className={`${prefix}-name`}>{name}</span>
      <p className={`${prefix}-text`}>
        {/* The full line reserves the final size so the box does not grow while typing. */}
        <span className={`${prefix}-measure`}>{text}</span>
        <span className={`${prefix}-typed`}>{typed}</span>
      </p>
      {isFinished && (stage ? <span className="call-dialogue-next"><span className="call-dialogue-arrow" /></span> : <span className="login-dialogue-next" />)}
    </div>
  )
}
