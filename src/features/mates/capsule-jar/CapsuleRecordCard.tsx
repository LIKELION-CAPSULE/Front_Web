import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/shared/ui/Icon'
import { capsuleLogo } from '@/shared/design/brand-logo'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { capsuleFoil, capsulePaletteFoil, capsulePaletteFoilGradient } from '@/features/reports/capsule-card-material'
import { useCapsuleCardTilt } from '@/features/reports/capsule-card-tilt'
import '@/features/reports/capsule-card-effects.css'
import { formatCapsuleDate, formatCapsuleTimeRange, formatTogether, withParticle } from './capsule-jar-data.ts'
import { capsulesForConnection } from './capsule-floor-layout.ts'
import { capsuleJarTheme } from './capsule-jar-theme.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'
import './capsule-record-card.css'

export type CapsuleRecordPager = { index: number; count: number; onPrevious: () => void; onNext: () => void }

/**
 * Record card of one capsule (one connection), as a collectible card: the capsule emblem with a faint CAPSULE mark,
 * 「{메이트}와의 캡슐」, the date, time of day and range, time together, the bundle's capsule count, the mate's line
 * and a link to the full connection record.
 *
 * The card material is the capsule card's (reports: capsule-card-effects.css, the tilt hook), with the foil kept to
 * the palette's violet and white: it tilts and catches the light with the pointer, and the same way with keyboard
 * focus; reduced motion keeps it flat. It appears out of the opened capsule's light: a flash at that point, the card
 * turning in as it grows into the middle of the window, then one sweep of light across it.
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
  const reduced = useReducedMotion()
  const { ref: stageRef, handlers: tiltHandlers } = useCapsuleCardTilt<HTMLDivElement>(reduced)
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
        <div
          ref={stageRef}
          className="capsule-card-stage record-holo-stage"
          style={
            {
              '--capsule-foil-gradient': capsulePaletteFoilGradient,
              '--capsule-foil-hover-opacity': capsulePaletteFoil.darkOpacity,
              '--capsule-glitter-hover-opacity': capsulePaletteFoil.glitterOpacity,
              '--capsule-glare-hover-opacity': capsulePaletteFoil.glareOpacity,
              '--record-holo-foil-scale': `${capsuleFoil.scale * 100}%`,
            } as CSSProperties
          }
          {...tiltHandlers}
        >
          <div className="record-holo-flip">
            <article className="capsule-share-card record-holo-card">
              <div className="share-portrait record-holo-emblem" aria-hidden="true">
                <span className="record-holo-watermark" style={{ maskImage: `url("${capsuleLogo.glyph.color}")` }} />
                <img className="record-holo-logo" src={capsuleLogo.horizontal.white} alt="" draggable={false} />
                <span className="record-holo-capsule">
                  <span className="record-holo-capsule-core" />
                </span>
              </div>
              <div className="capsule-card-header record-holo-head">
                <p className="record-holo-title">{`${mateName}${withParticle(mateName)}의 캡슐`}</p>
                <h3 id={titleId} className="record-holo-date">
                  {formatCapsuleDate(capsule.startedAt)}
                </h3>
              </div>
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
              <dl className="record-holo-stats">
                <div>
                  <dt>시간대</dt>
                  <dd>{formatCapsuleTimeRange(capsule)}</dd>
                </div>
                <div>
                  <dt>함께한 시간</dt>
                  <dd>{formatTogether(capsule.durationSeconds)}</dd>
                </div>
                <div>
                  <dt>캡슐</dt>
                  <dd>{`${capsulesForConnection(capsule.durationSeconds)}개`}</dd>
                </div>
              </dl>
              {capsule.line && (
                <blockquote className="record-holo-line">
                  <p>{capsule.line}</p>
                  <footer>{mateName}의 한마디</footer>
                </blockquote>
              )}
              <div className="record-holo-actions">
                {capsule.connectionId && (
                  <Link to={`/connections/${capsule.connectionId}`} className="capsule-jar-card-link">
                    연결 기록 보기
                  </Link>
                )}
                <button ref={closeButtonRef} type="button" className="capsule-jar-card-close" onClick={onClose}>
                  닫기
                </button>
              </div>
              <span className="capsule-card-effects" aria-hidden="true">
                <span className="capsule-card-foil" />
                <span className="capsule-card-glitter" />
                <span className="capsule-card-glare" />
                <span className="capsule-card-sweep" />
              </span>
              {/* The light the card comes out of (fades as the card turns in). */}
              <span className="record-holo-flash" aria-hidden="true" />
            </article>
          </div>
        </div>
      </div>
    </dialog>
  )
}
