import { forwardRef, type Ref } from 'react'
import { Link } from 'react-router'
import { mateCallBackground, matePortrait } from '@/features/mates/artwork'
import { ageRatingLabel, type AvailableMate } from '@/features/mates/catalog'
import { useConnectMate } from '@/features/mates/use-connect-mate'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { HOME_COPY } from '../home-copy'

/** Cards in the row: available mates first, then 「추가 예정」 placeholders for the rest. */
const ROW_SLOTS = 4

/**
 * "오늘은 누구와 함께할까요?": a card per available mate (채린, 서도현) and 「추가 예정」 placeholders filling the row.
 * The first card carries the service tour's home targets (`data-tour`).
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
          ? mates.map((mate, index) => <MateShowcaseCard key={mate.id} mate={mate} tour={index === 0} />)
          : <MateLoadFailedCard onRetry={onRetry} />}
        {Array.from({ length: Math.max(0, ROW_SLOTS - Math.max(mates.length, 1)) }, (_, index) => <UpcomingMateCard key={index} />)}
      </div>
    </section>
  )
})

function MateShowcaseCard({ mate, tour }: { mate: AvailableMate; tour: boolean }) {
  const { connect, busy, error } = useConnectMate(mate)
  // A coming-soon mate (11 `comingSoon`): its card still opens its page (「공개 알림 받기」 there), the arrow is closed.
  const comingSoon = Boolean(mate.comingSoon)
  return (
    <article className="home-mate-card home-mate-card--active" data-coming-soon={comingSoon || undefined} data-tour={tour ? 'mate-card' : undefined}>
      {/* The whole card opens the mate's page; the arrow starts the connection (with the pickup sequence). */}
      <Link to={`/mates/${mate.id}`} className="home-mate-card-link" aria-label={`${mate.name} 메이트 보기`} />
      <div className="home-mate-card-art">
        <img className="home-mate-card-bg" src={mateCallBackground(mate.id).landscape} alt="" loading="lazy" decoding="async" draggable={false} />
        <img className="home-mate-card-figure" src={matePortrait(mate.id, mate.image)} alt="" loading="lazy" decoding="async" draggable={false} />
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
      {comingSoon ? (
        <span className="home-round-button home-mate-card-enter" aria-hidden="true" data-disabled>
          <Icon name="chevron" size={18} />
        </span>
      ) : (
        <button
          type="button"
          className="home-round-button home-mate-card-enter"
          data-tour={tour ? 'mate-card-connect' : undefined}
          aria-label={HOME_COPY.connectMate(mate.name)}
          // Starting from home picks up the phone (the hang-up in reverse) on the way into the call.
          onClick={() => void connect({ pickup: true })}
          disabled={busy}
        >
          <Icon name="chevron" size={18} />
        </button>
      )}
    </article>
  )
}

/** A mate still to come: an abstract silhouette and a question mark, not clickable. */
function UpcomingMateCard() {
  return (
    <article className="home-mate-card home-mate-card--upcoming" aria-label={`${HOME_COPY.upcomingName} · ${HOME_COPY.upcoming}`}>
      <div className="home-mate-card-art home-mate-card-art--upcoming" aria-hidden="true">
        <svg className="home-mate-silhouette" viewBox="0 0 120 120">
          <circle cx="60" cy="44" r="22" />
          <path d="M18 120c4-30 20-46 42-46s38 16 42 46z" />
        </svg>
        <span className="home-mate-question">?</span>
      </div>
      <span className="home-mate-badge">{HOME_COPY.upcoming}</span>
      <div className="home-mate-card-copy">
        <div className="home-mate-card-name"><h3>{HOME_COPY.upcomingName}</h3></div>
        <p>{HOME_COPY.upcomingLine}</p>
      </div>
      <span className="home-round-button home-mate-card-enter" aria-hidden="true" data-disabled>
        <Icon name="chevron" size={18} />
      </span>
    </article>
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
