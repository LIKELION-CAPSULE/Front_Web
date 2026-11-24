import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/shared/ui/Icon'
import { formatCapsuleDate, formatCapsuleTimeRange, formatTogether, withParticle } from './capsule-jar-data.ts'
import { capsuleJarTheme } from './capsule-jar-theme.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'
import './capsule-record-card.css'

export type CapsuleRecordPager = { index: number; count: number; onPrevious: () => void; onNext: () => void }

/**
 * Record card of one capsule (one connection): date, time of day, time together, the mate's line and a link to the
 * full connection record.
 *
 * A native modal `<dialog>` (like the shared Dialog): the page behind it is inert, Tab stays inside, focus starts on
 * 「닫기」, Esc / a click outside the card / 닫기 close it — also while it is folding away — and the opener restores
 * focus. The dialog covers its frame (the scene, `frame="parent"`) or the whole window (`frame="viewport"`), so the
 * card can still unfold beside the pile.
 *
 * Reused by the records calendar (a day's connections, with `pager`) through `capsuleFromStudyRecord`.
 */
export function CapsuleRecordCard({
  capsule,
  mateName,
  mateId,
  placement,
  phase,
  animated,
  origin = null,
  getOriginFrame,
  onClose,
  frame = 'parent',
  pager,
}: {
  capsule: CapsuleRecord
  mateName: string
  /** Mate colours for the card's capsule mark when it is shown outside the capsule scene. */
  mateId?: string
  placement: 'beside' | 'sheet' | 'center'
  phase: 'open' | 'closing'
  animated: boolean
  /** Screen point (relative to the origin frame) the card unfolds from. */
  origin?: { x: number; y: number } | null
  getOriginFrame?: () => HTMLElement | null
  onClose: () => void
  frame?: 'parent' | 'viewport'
  /** Several connections on one day (records calendar): previous / next. */
  pager?: CapsuleRecordPager
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Show as a modal over the frame's rect; follow the frame when it moves or resizes.
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const frameElement = frame === 'parent' ? dialog.parentElement : null
    const place = () => {
      if (!frameElement) {
        Object.assign(dialog.style, { left: '0px', top: '0px', width: '100vw', height: '100dvh' })
        return
      }
      const rect = frameElement.getBoundingClientRect()
      Object.assign(dialog.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
    }
    place()
    if (!dialog.open) dialog.showModal()
    closeButtonRef.current?.focus({ preventScroll: true })
    const observer = frameElement && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    if (frameElement) observer?.observe(frameElement)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      if (dialog.open) dialog.close()
    }
  }, [frame])

  // The card comes out of the light: measure where it rests and start from the opened capsule.
  useLayoutEffect(() => {
    const element = cardRef.current
    if (!element || phase !== 'open') return
    const originFrame = getOriginFrame?.()
    if (!origin || !originFrame) {
      element.style.removeProperty('--from-x')
      element.style.removeProperty('--from-y')
      return
    }
    const cardRect = element.getBoundingClientRect()
    const frameRect = originFrame.getBoundingClientRect()
    element.style.setProperty('--from-x', `${frameRect.left + origin.x - (cardRect.left + cardRect.width / 2)}px`)
    element.style.setProperty('--from-y', `${frameRect.top + origin.y - (cardRect.top + cardRect.height / 2)}px`)
  }, [origin, phase, getOriginFrame])

  // Another connection of the same day: keep focus inside on 닫기.
  useEffect(() => {
    if (phase === 'open' && !cardRef.current?.contains(document.activeElement)) closeButtonRef.current?.focus({ preventScroll: true })
  }, [capsule.id, phase])

  const theme = mateId ? capsuleJarTheme(mateId) : null
  const themeStyle = theme
    ? ({
        '--jar-glow': theme.glow,
        '--jar-light': theme.lightHalf,
        '--jar-light-shade': theme.lightHalfShade,
        '--jar-tint': theme.tintHalf,
        '--jar-tint-shade': theme.tintHalfShade,
      } as CSSProperties)
    : undefined

  return (
    <dialog
      ref={dialogRef}
      className="capsule-jar-card-layer"
      data-phase={phase}
      data-placement={placement}
      data-animated={animated ? 'true' : 'false'}
      aria-labelledby={titleId}
      style={themeStyle}
      onCancel={(event) => {
        // Esc: close through the parent (also while folding, when it is a no-op), never the browser's own close.
        event.preventDefault()
        onClose()
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={cardRef} className="capsule-jar-card">
        <div className="capsule-jar-card-light" aria-hidden="true" />
        <div className="capsule-jar-card-head">
          <span className="capsule-jar-pill capsule-jar-pill--glow" aria-hidden="true" />
          <p className="capsule-jar-card-eyebrow">{`${mateName}${withParticle(mateName)}의 캡슐`}</p>
        </div>
        <h3 id={titleId} className="capsule-jar-card-date">{formatCapsuleDate(capsule.startedAt)}</h3>
        {pager && pager.count > 1 && (
          <div className="capsule-jar-card-pager">
            <button type="button" onClick={pager.onPrevious} disabled={pager.index === 0} aria-label="이날의 이전 연결">
              <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <span aria-live="polite">{`이날의 연결 ${pager.index + 1} / ${pager.count}`}</span>
            <button type="button" onClick={pager.onNext} disabled={pager.index >= pager.count - 1} aria-label="이날의 다음 연결">
              <Icon name="chevron" size={14} />
            </button>
          </div>
        )}
        <dl className="capsule-jar-card-stats">
          <div>
            <dt>시간대</dt>
            <dd>{formatCapsuleTimeRange(capsule)}</dd>
          </div>
          <div>
            <dt>함께한 시간</dt>
            <dd>{formatTogether(capsule.durationSeconds)}</dd>
          </div>
        </dl>
        {capsule.line && (
          <blockquote className="capsule-jar-card-line">
            <p>{capsule.line}</p>
            <footer>{mateName}의 한마디</footer>
          </blockquote>
        )}
        <div className="capsule-jar-card-actions">
          {capsule.connectionId && (
            <Link to={`/connections/${capsule.connectionId}`} className="capsule-jar-card-link">
              연결 기록 보기
            </Link>
          )}
          <button ref={closeButtonRef} type="button" className="capsule-jar-card-close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </dialog>
  )
}
