import { useEffect } from 'react'
import { useWindupString } from 'windups'
import { speechPace } from '@/features/session/speech-pace'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import type { MateComment } from './mate-comment'
import './mate-comment.css'
import { AiCharacterBadge } from '@/shared/ui/AiCharacterBadge'

/**
 * The mate's one-line comment on the records page: avatar + glass speech bubble.
 * Types out like the study screen's speech bubble; with reduced motion the full line shows at once.
 * Mount with `key={comment.text}` so a new comment restarts typing.
 */
export function MateCommentBubble({
  comment,
  mateName,
  avatarSrc,
  onProgress,
}: {
  comment: MateComment
  mateName: string
  avatarSrc?: string
  /** Typing progress (0…1) and whether the line is complete — the board lights the days the line speaks about. */
  onProgress?: (progress: number, finished: boolean) => void
}) {
  const reducedMotion = useReducedMotion()
  const [typed, { isFinished, skip }] = useWindupString(comment.text, { pace: speechPace, skipped: reducedMotion })
  const typedLength = typed.length
  useEffect(() => {
    onProgress?.(isFinished ? 1 : typedLength / Math.max(1, comment.text.length), isFinished)
  }, [comment.text.length, isFinished, onProgress, typedLength])

  return (
    <section className="records-mate-comment" aria-label={`${mateName}의 한마디`} data-records-mate-comment={comment.kind}>
      {avatarSrc ? (
        <img className="records-mate-comment-avatar" src={avatarSrc} alt="" width={56} height={56} decoding="async" />
      ) : (
        <span className="records-mate-comment-avatar records-mate-comment-avatar--initial" aria-hidden="true">
          {mateName.slice(0, 1)}
        </span>
      )}
      <div className="records-mate-comment-bubble" data-typing={!isFinished || undefined} onClick={isFinished ? undefined : skip}>
        <span className="records-mate-comment-head">
          <span className="records-mate-comment-name" aria-hidden="true">
            {mateName}
          </span>
          <AiCharacterBadge />
        </span>
        <p className="records-mate-comment-text">
          <span className="sr-only">{comment.text}</span>
          {/* The full line reserves the final size so the bubble does not grow while typing. */}
          <span className="records-mate-comment-measure" aria-hidden="true">
            {comment.text}
          </span>
          <span className="records-mate-comment-typed" aria-hidden="true">
            {typed}
          </span>
        </p>
      </div>
    </section>
  )
}
