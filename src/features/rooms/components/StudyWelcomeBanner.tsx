import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { CompanionGreeting } from '@/features/characters/components/CompanionGreeting'
import { HoverScratchCarousel } from '@/shared/ui/hover-scratch/HoverScratchCarousel'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { welcomeBanners } from '../welcome-banners'
import { welcomeCopy } from '../welcome-copy'
import { MVP_ROOM_ID } from '@/features/mvp/policy'

export function StudyWelcomeBanner({ onExplore }: { onExplore: () => void }) {
  const { state } = useDemo()
  const latest = state.records[0]
  const room = getStudyRoom(MVP_ROOM_ID)!
  const active = state.activeSession
  const returning = !!active || (!state.firstVisit && !!latest)
  const copy = active ? welcomeCopy.active : returning ? welcomeCopy.returning : welcomeCopy.fresh
  const preparationPath = `/rooms/${room.id}/prepare`
  return (
    <HoverScratchCarousel
      className="welcome-hero"
      labelledBy="welcome-title"
      slides={welcomeBanners}
      renderSlide={(slide) => (
        <>
          <div className="welcome-art-shade" aria-hidden="true" />
          <div className="welcome-greeting-slot">
            <CompanionGreeting name={slide.name} quote={slide.quote} className="welcome-speech" />
          </div>
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
            <div className="welcome-actions">
              {returning ? (
                <ButtonLink
                  to={
                    active
                      ? `/study/${active.id}`
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
