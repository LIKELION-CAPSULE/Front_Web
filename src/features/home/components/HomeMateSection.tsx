import { forwardRef, type Ref } from 'react'
import { Link } from 'react-router'
import { mateCallBackground, matePortrait } from '@/features/mates/artwork'
import { ageRatingLabel, type AvailableMate } from '@/features/mates/catalog'
import { useConnectMate } from '@/features/mates/use-connect-mate'
import { AttendanceWidget } from '@/features/attendance/components/AttendanceWidget'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { HOME_COPY } from '../home-copy'

/**
 * "오늘은 누구와 함께할까요?": a card per available mate (채린, 서도현), a placeholder for the next one while the row has
 * room, and the attendance rewards. The first card carries the service tour's home targets (`data-tour`).
 */
export const HomeMateSection = forwardRef(function HomeMateSection(
  { mates, onRetry }: { mates: readonly AvailableMate[]; onRetry: () => void },
  headingRef: Ref<HTMLHeadingElement>,
) {
  return (
    <section className="home-mates" aria-labelledby="mates-heading">
      <div className="home-section-heading">
        <h2 ref={headingRef} tabIndex={-1} id="mates-heading" className="home-section-title">{HOME_COPY.matesTitle}</h2>
        <Link to="/mates/me" className="home-more">
          {HOME_COPY.more} <Icon name="chevron" size={16} />
        </Link>
      </div>
      <div className="home-mate-grid">
        {mates.length
          ? mates.map((mate, index) => <MateShowcaseCard key={mate.id} mate={mate} tour={index === 0} />)
          : <MateLoadFailedCard onRetry={onRetry} />}
        {/* The row holds two mate slots beside the rewards; 「추가 예정」 fills the second until a mate takes it. */}
        {mates.length < 2 && <UpcomingMateCard />}
        <div className="home-attendance" data-tour="home-attendance">
          <AttendanceWidget size="compact" visibleSlots={4} />
        </div>
      </div>
    </section>
  )
})

function MateShowcaseCard({ mate, tour }: { mate: AvailableMate; tour: boolean }) {
  const { connect, busy, error } = useConnectMate(mate)
  return (
    <article className="home-mate-card home-mate-card--active" data-tour={tour ? 'mate-card' : undefined}>
      {/* The whole card opens the mate's page; the arrow starts the connection. */}
      <Link to={`/mates/${mate.id}`} className="home-mate-card-link" aria-label={`${mate.name} 메이트 보기`} />
      <div className="home-mate-card-art">
        <img className="home-mate-card-bg" src={mateCallBackground(mate.id).landscape} alt="" loading="lazy" decoding="async" draggable={false} />
        <img className="home-mate-card-figure" src={matePortrait(mate.id, mate.image)} alt="" loading="lazy" decoding="async" draggable={false} />
      </div>
      <span className="home-mate-badge home-mate-badge--online" data-tour={tour ? 'mate-card-status' : undefined}>{HOME_COPY.available}</span>
      <div className="home-mate-card-copy">
        <div className="home-mate-card-name">
          <h3>{mate.name}</h3>
          {mate.relationTag && <span className="home-mate-tag"><Icon name="heart" size={12} />{mate.relationTag}</span>}
          {/* An age-rated mate (none at launch: 채린 and 서도현 are 전연령) shows it on the card, as on their page. */}
          {mate.ageRating !== 'all' && <span className="mate-age-badge" data-rating={mate.ageRating}>{ageRatingLabel(mate.ageRating)}</span>}
        </div>
        <p>{mate.tagline ?? mate.introduction}</p>
        {error && <FeedbackMessage tone="error" className="mt-2">{error}</FeedbackMessage>}
      </div>
      <button
        type="button"
        className="home-round-button home-mate-card-enter"
        data-tour={tour ? 'mate-card-connect' : undefined}
        aria-label={HOME_COPY.connectMate(mate.name)}
        onClick={() => void connect()}
        disabled={busy}
      >
        <Icon name="chevron" size={18} />
      </button>
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
