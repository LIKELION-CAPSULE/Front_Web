import { useEffect, useState } from 'react'
import { useWindupString } from 'windups'
import { reactionBubbleDurationMs } from '@/features/auth/login-backgrounds/desktop/mate-reactions'
import { speechPace } from '@/features/session/speech-pace'

/** Length of the `login-dialogue-out` animation in login-variants.css. */
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
}: {
  id: number
  name: string
  text: string
  reducedMotion: boolean
  /** Stable callback; receives this line's `id` once it has left. */
  onDone: (id: number) => void
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

  return (
    <div className="login-dialogue" aria-hidden="true" data-leaving={leaving || undefined} data-typing={!isFinished || undefined}>
      <span className="login-dialogue-name">{name}</span>
      <p className="login-dialogue-text">
        {/* The full line reserves the final size so the box does not grow while typing. */}
        <span className="login-dialogue-measure">{text}</span>
        <span className="login-dialogue-typed">{typed}</span>
      </p>
      {isFinished && <span className="login-dialogue-next" />}
    </div>
  )
}
