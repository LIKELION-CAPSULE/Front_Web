import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { CompanionGreeting } from '@/features/characters/components/CompanionGreeting'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { HoverScratchCarousel } from '@/shared/ui/hover-scratch/HoverScratchCarousel'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { welcomeBanners } from '../welcome-banners'
import { welcomeCopy } from '../welcome-copy'

export function StudyWelcomeBanner({ onExplore }: { onExplore: () => void }) {
  const { state } = useDemo()
  const latest = state.records[0]
  const room = getStudyRoom(state.activeSession?.roomId ?? latest?.roomId ?? 'dawn-library')!
  const active = state.activeSession
  const returning = !!active || (!state.firstVisit && !!latest)
  const copy = active ? welcomeCopy.active : returning ? welcomeCopy.returning : welcomeCopy.fresh
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
      {({ index, select }) => (
        <>
          <div className="welcome-copy">
            <h1 id="welcome-title">
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
                      : `/rooms/${room.id}/prepare?step=goal${latest?.targetSeconds ? `&goal=${latest.targetSeconds / 60}` : ''}${latest?.tier ? `&tier=${latest.tier}` : ''}`
                  }
                >
                  <Icon name="play" size={17} /> 이어서 공부하기
                </ButtonLink>
              ) : (
                <Button onClick={onExplore}>
                  룸 둘러보기 <Icon name="arrow" size={18} className="rotate-90" />
                </Button>
              )}
            </div>
          </div>
          <div
            className="welcome-banner-picker"
            role="group"
            aria-label="배너 캐릭터 선택"
            data-scratch-ignore
          >
            {welcomeBanners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                aria-pressed={index === i}
                aria-label={`${banner.name} 배너 보기`}
                onClick={() => select(i)}
              >
                <CharacterAvatar characterId={banner.id} />
                <span>{banner.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </HoverScratchCarousel>
  )
}
