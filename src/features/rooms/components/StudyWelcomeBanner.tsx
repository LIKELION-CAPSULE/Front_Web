import { useDemo } from '@/features/demo/demo-context'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { relationship, todaySeconds } from '@/features/demo/selectors'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { duration } from '@/shared/lib/format'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { RoomArtwork } from './RoomArtwork'

export function StudyWelcomeBanner({ onExplore }: { onExplore: () => void }) {
  const { state } = useDemo()
  const latest = state.records[0]
  const room = getStudyRoom(state.activeSession?.roomId ?? latest?.roomId ?? 'dawn-library')!
  const character = room.characters[0]!
  const art = getCharacterArtwork(character.id)
  const relation = relationship(state, character.id)
  const active = state.activeSession
  const returning = !state.firstVisit && !!latest
  const promise = state.memories.find(
    (memory) => memory.kind === '약속' && memory.characterId === character.id,
  )
  return (
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <p className="eyebrow">
          <span className="live-dot" /> YOUR DAILY STUDY COMPANION
        </p>
        <h1 id="welcome-title">
          오늘도,
          <br />
          <span>네 옆자리에서.</span>
        </h1>
        <p className="welcome-description">
          {returning
            ? `${state.profile.name}님, ${character.name}이 기다리고 있어요.`
            : '혼자서는 미뤘던 공부도, 같이 하면 달라지니까.'}
          <br />
          좋아하는 친구와 나란히, 오늘의 한 페이지를 채워요.
        </p>
        <div className="welcome-actions">
          {returning ? (
            <ButtonLink to={active ? `/study/${active.id}` : `/rooms/${room.id}/prepare?step=set`}>
              <Icon name="play" size={17} /> 이어서 공부하기 <Icon name="arrow" size={18} />
            </ButtonLink>
          ) : (
            <Button onClick={onExplore}>
              추천 룸 보기 <Icon name="arrow" size={18} />
            </Button>
          )}
          <span className="text-xs text-subtle">50분의 집중, 10분의 설렘</span>
        </div>
        <div className="welcome-metrics">
          <div>
            <span>오늘 함께한 시간</span>
            <strong>{duration(todaySeconds(state))}</strong>
          </div>
          <span className="welcome-metrics-divider" />
          <div>
            <span>{promise ? '다음 공부 약속' : '우리의 공부 루틴'}</span>
            <strong>
              {promise ? `${promise.date.slice(5)} · ${promise.time}` : '연속 5일째'}{' '}
              <Icon name="sparkle" size={15} />
            </strong>
          </div>
        </div>
      </div>
      <div className="welcome-art">
        <RoomArtwork roomId={room.id} variant="hero" eager />
        <div className="welcome-art-shade" />
        <span className="welcome-scene-label">
          <span className="live-dot" /> {room.name}
        </span>
        <div className="welcome-speech">
          <span className="text-xs text-brand-strong">
            {character.name} · Lv.{relation.level} 친구
          </span>
          <p>“{art.quote}”</p>
          <Icon name="heart" size={18} />
        </div>
        <div className="welcome-art-caption">
          <span>늘 같은 자리, 조금 더 가까워지는 우리.</span>
          <span>STUDY TOGETHER</span>
        </div>
      </div>
    </section>
  )
}
