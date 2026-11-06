import { useLocation } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { CompanionGreeting } from '@/features/characters/components/CompanionGreeting'
import { HoverScratchCarousel } from '@/shared/ui/hover-scratch/HoverScratchCarousel'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { welcomeBanners } from '../welcome-banners'
import { welcomeCopy } from '../welcome-copy'
import { useBackend } from '@/features/backend/backend-context'

export function StudyWelcomeBanner({ onExplore }: { onExplore: () => void }) {
  const location = useLocation()
  const { state } = useDemo()
  const latest = state.records[0]
  const { activeSummary, home } = useBackend()
  const room = getStudyRooms()[0]
  const active = state.activeSession ?? (activeSummary?.sessionId ? { id: String(activeSummary.sessionId) } : null)
  const returning = !!active || !state.firstVisit || !!latest
  const copy = active ? welcomeCopy.active : returning ? welcomeCopy.returning : welcomeCopy.fresh
  const preparationPath = room ? `/rooms/${room.id}/prepare` : '/'
  return (
    <HoverScratchCarousel
      className="welcome-hero"
      labelledBy="welcome-title"
      slides={welcomeBanners}
      renderSlide={(slide) => (
        <>
          <div className="welcome-art-shade" aria-hidden="true" />
          {slide.quote && <div className="welcome-greeting-slot">
            <CompanionGreeting name={slide.name} quote={slide.quote} className="welcome-speech" />
          </div>}
        </>
      )}
    >
      {() => (
        <>
          <div className="welcome-copy">
            <h1 id="welcome-title" className="type-hero-title">
              {copy.title}
              <br />
              <span>{copy.accent}</span>
            </h1>
            <p className="welcome-description">
              {returning && `${state.profile.name}님, `}
              {copy.description}
            </p>
            {home?.todayStudySeconds !== undefined && <p className="mt-3 text-body-compact text-muted">오늘 함께 공부한 시간 {Math.floor(home.todayStudySeconds / 60)}분</p>}
            <div className="welcome-actions">
              {returning ? (
                <ButtonLink
                  state={active ? undefined : { prepareBackground: location }}
                  aria-haspopup={active ? undefined : 'dialog'}
                  preventScrollReset
                  to={
                    active
                      ? `/study/${active.id}${state.activeSession ? '' : '?resume=1'}`
                      : preparationPath
                  }
                >
                  <Icon name="play" size={17} /> 이어서 공부하기
                </ButtonLink>
              ) : (
                <Button onClick={onExplore}>
                  스터디룸 둘러보기 <Icon name="arrow" size={18} className="rotate-90" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </HoverScratchCarousel>
  )
}
