import { mateColorStyle } from '@/features/mates/capsule-jar/capsule-jar-theme'
import { forwardRef, useId, type Ref, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { mateCallBackground, mateHeroPortrait } from '@/features/mates/artwork'
import { ageRatingLabel, type AvailableMate } from '@/features/mates/catalog'
import { useConnectMate } from '@/features/mates/use-connect-mate'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { HOME_COPY } from '../home-copy'

/** The row's length: after the real mates, 「?」 cards fill it up to this many (none once the mates do). */
const HOME_MATE_ROW = 4

/**
 * "오늘은 누구와 함께할까요?": a tall card per available mate (채린, 서도현), then `max(0, 4 - mates)` 「?」 cards for the
 * mates to come (home only; they are not mate data). The first real card carries the service tour's home targets
 * (`data-tour`).
 */
export const HomeMateSection = forwardRef(function HomeMateSection(
  { mates, onRetry }: { mates: readonly AvailableMate[]; onRetry: () => void },
  headingRef: Ref<HTMLHeadingElement>,
) {
  return (
    <section className="home-mates" aria-labelledby="mates-heading">
      <div className="home-section-heading">
        <h2 ref={headingRef} tabIndex={-1} id="mates-heading" className="home-section-title">{HOME_COPY.matesTitle}</h2>
      </div>
      <div className="home-mate-grid">
        {mates.length
          ? <>
              {mates.map((mate, index) => <MateShowcaseCard key={mate.id} mate={mate} tour={index === 0} />)}
              <MysteryMateCards first={mates.length} />
            </>
          : <MateLoadFailedCard onRetry={onRetry} />}
      </div>
    </section>
  )
})

function MateShowcaseCard({ mate, tour }: { mate: AvailableMate; tour: boolean }) {
  const { connect, busy, error } = useConnectMate(mate)
  // A coming-soon mate (11 `comingSoon`): its card still opens its page (「공개 알림 받기」 there) and has no connect
  // control (a closed one read as if the whole card were closed).
  const comingSoon = Boolean(mate.comingSoon)
  return (
    <article style={mateColorStyle(mate.id, mate.name) as CSSProperties} className="home-mate-card home-mate-card--active" data-coming-soon={comingSoon || undefined} data-tour={tour ? 'mate-card' : undefined}>
      {/* The whole card opens the mate's page; 「바로 연결」 starts the connection (with the pickup sequence, which 취소 or
          Esc stops). A labelled call control, not a `>`: an arrow on a card reads as "open the page" (UX review 2-1). */}
      <Link to={`/mates/${mate.id}`} className="home-mate-card-link" aria-label={`${mate.name} 메이트 보기`} />
      <div className="home-mate-card-art">
        <img className="home-mate-card-bg" src={mateCallBackground(mate.id).landscape} alt="" loading="lazy" decoding="async" draggable={false} />
        {/* Head → waist (the tall card's framing): the face stays above the name and line at the bottom. */}
        <img className="home-mate-card-figure" src={mateHeroPortrait(mate.id, mate.image)} alt="" loading="lazy" decoding="async" draggable={false} />
      </div>
      {/* Age rating at the top left, the status at the top right: one row of chips over the art (the name row keeps its
          layout). */}
      <div className="home-mate-chips">
        <span className="home-mate-badge home-mate-badge--rating" data-rating={mate.ageRating}>{ageRatingLabel(mate.ageRating)}</span>
      </div>
      {comingSoon ? (
        <span className="home-mate-badge home-mate-badge--soon" data-tour={tour ? 'mate-card-status' : undefined}>{HOME_COPY.comingSoon}</span>
      ) : (
        <span className="home-mate-badge home-mate-badge--online" data-tour={tour ? 'mate-card-status' : undefined}>{HOME_COPY.available}</span>
      )}
      <div className="home-mate-card-copy">
        <div className="home-mate-card-name">
          <h3>{mate.name}</h3>
          {/* A study relationship (짝꿍형, 소꿉친구형): no heart or pink, nothing that reads as romance. */}
          {mate.relationTag && <span className="home-mate-tag"><Icon name="book" size={12} />{mate.relationTag}</span>}
        </div>
        <p>{mate.tagline ?? mate.introduction}</p>
        {error && <FeedbackMessage tone="error" className="mt-2">{error}</FeedbackMessage>}
      </div>
      {!comingSoon && (
        <button
          type="button"
          className="home-round-button home-mate-card-enter"
          data-tour={tour ? 'mate-card-connect' : undefined}
          aria-label={HOME_COPY.connectMate(mate.name)}
          // Starting from home picks up the phone (the hang-up in reverse) on the way into the call.
          onClick={() => void connect({ pickup: true })}
          disabled={busy}
        >
          <Icon name="video" size={16} />
          <span>{HOME_COPY.connectNow}</span>
        </button>
      )}
    </article>
  )
}

/**
 * The 「?」 cards after the real ones: nothing to press (no link, no button, no hover, not focusable), one line for screen
 * readers for all of them. `data-slot` is each one's place in the row: home.css drops the last ones first where the
 * row is too narrow for them beside full-size real cards, and the line goes with the first.
 */
function MysteryMateCards({ first }: { first: number }) {
  const count = Math.max(0, HOME_MATE_ROW - first)
  if (!count) return null
  return (
    <>
      <p className="sr-only home-mate-slot" data-slot={first}>{HOME_COPY.mysteryLabel}</p>
      {Array.from({ length: count }, (_, index) => (
        <MysteryMateCard key={index} slot={first + index} variant={index % 2 ? 'b' : 'a'} />
      ))}
    </>
  )
}

function MysteryMateCard({ slot, variant }: { slot: number; variant: 'a' | 'b' }) {
  return (
    <div className="home-mate-card home-mate-card--mystery home-mate-slot" data-slot={slot} aria-hidden="true">
      <div className="home-mate-card-art">
        <MysterySilhouette variant={variant} />
        <span className="home-mate-mystery-mark">?</span>
      </div>
      <div className="home-mate-card-copy">
        <div className="home-mate-card-name"><span className="home-mate-mystery-name">{HOME_COPY.mysteryName}</span></div>
        <p>{HOME_COPY.mysteryLine}</p>
      </div>
    </div>
  )
}

/**
 * A dark head-and-shoulders shape on the real cards' framing (head → waist, the face in the upper half); `b` has longer
 * hair and narrower shoulders, so the two cards are not copies. A slow light band sweeps it (stopped for reduced motion).
 */
function MysterySilhouette({ variant }: { variant: 'a' | 'b' }) {
  const id = useId()
  const shape = variant === 'a'
    ? <>
        <circle cx="100" cy="104" r="36" />
        <path d="M87 130h26v34H87z" />
        <path d="M24 300c0-90 30-140 76-146 46 6 76 56 76 146z" />
      </>
    : <>
        <path d="M60 110c0-34 18-52 40-52s40 18 40 52l6 66c-10 8-22 8-30 2H84c-8 6-20 6-30-2z" />
        <circle cx="100" cy="106" r="33" />
        <path d="M36 300c0-78 26-124 64-130 38 6 64 52 64 130z" />
      </>
  return (
    <svg className="home-mate-mystery-figure" viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet">
      <defs>
        <clipPath id={`${id}-shape`}>{shape}</clipPath>
        <linearGradient id={`${id}-shine`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.07" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="home-mate-mystery-body">{shape}</g>
      <g clipPath={`url(#${id}-shape)`}>
        <rect className="home-mate-mystery-shine" x="0" y="0" width="120" height="300" fill={`url(#${id}-shine)`} />
      </g>
    </svg>
  )
}

function MateLoadFailedCard({ onRetry }: { onRetry: () => void }) {
  return (
    <article className="home-mate-card home-mate-card--failed">
      <p>{HOME_COPY.loadFailed}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>{HOME_COPY.retry}</Button>
    </article>
  )
}
