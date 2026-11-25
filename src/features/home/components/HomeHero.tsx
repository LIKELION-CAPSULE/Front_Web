import { mateCallBackground, mateHeroPortrait } from '@/features/mates/artwork'
import { launchMates, type AvailableMate } from '@/features/mates/catalog'
import { useConnectMate } from '@/features/mates/use-connect-mate'
import { useAttendanceController } from '@/features/attendance/attendance-controller'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { HOME_COPY } from '../home-copy'

/**
 * The home hero: copy and the attendance CTA on the left, the companion illustration fading into the room behind.
 * Before today's check-in the CTA plays the attendance widget's sequence (in the mates section below); afterwards
 * it starts the connection with the mate (「○○와 연결하기」), the way "다시 연결하기" used to.
 */
export function HomeHero({ mate, onExplore }: { mate: AvailableMate | null; onExplore: () => void }) {
  const { state, busy, isLoading, start } = useAttendanceController()
  const { connect, busy: connecting, error } = useConnectMate(mate)
  const name = mate?.name ?? launchMates[0]!.name
  const title = HOME_COPY.heroTitle(name)
  const done = state.checkedToday && !busy
  const figure = mateHeroPortrait(mate?.id ?? launchMates[0]!.id, mate?.image)

  function onCta() {
    if (!done) return void start()
    // Starting to study picks up the phone (the hang-up in reverse) on the way into the call.
    if (mate) void connect({ pickup: true })
    else onExplore()
  }

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-backdrop" aria-hidden="true">
        <img className="home-hero-room" src={mateCallBackground(mate?.id ?? launchMates[0]!.id).landscape} alt="" decoding="async" draggable={false} />
      </div>
      {figure && (
        <figure className="home-hero-figure">
          <div className="home-hero-figure-art">
            <img src={figure} width={1520} height={1800} alt="" decoding="async" draggable={false} />
          </div>
        </figure>
      )}

      <div className="home-hero-inner page-container">
        <div className="home-hero-copy">
          <h1 id="home-hero-title" className="home-hero-title">
            {title.before}
            <span className="home-hero-accent">{title.accent}</span>
            <span className="home-hero-sparkle" aria-hidden="true" />
            <br />
            {title.after}
          </h1>
          <p className="home-hero-sub" aria-live="polite">
            <span data-active={!done || undefined} aria-hidden={done}>{HOME_COPY.heroSub}</span>
            <span data-active={done || undefined} aria-hidden={!done}>{HOME_COPY.heroSubDone}</span>
          </p>
          <button
            type="button"
            className="home-hero-cta"
            data-tour="connect"
            onClick={onCta}
            disabled={busy || isLoading || connecting}
            aria-busy={busy || connecting || undefined}
          >
            <span className="home-hero-cta-labels">
              <span data-active={!done || undefined} aria-hidden={done}>{HOME_COPY.ctaCheckIn}</span>
              <span data-active={done || undefined} aria-hidden={!done}>{HOME_COPY.ctaConnect(name)}</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
          {error && <FeedbackMessage tone="error" className="mt-3">{error}</FeedbackMessage>}
        </div>
      </div>
    </section>
  )
}
