import { Link, useParams } from 'react-router'
import { CharacterCard } from '@/features/characters/components/CharacterCard'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { ButtonLink } from '@/shared/ui/Button'
import { Brand } from '@/shared/ui/Brand'
import { Icon } from '@/shared/ui/Icon'
import { useDemo } from '@/features/demo/demo-context'
import NotFoundPage from '@/pages/NotFoundPage'

export default function RoomDetailPage() {
  const { roomId } = useParams()
  const { state } = useDemo()
  const room = roomId ? getStudyRoom(roomId) : undefined
  if (!room || room.contentStatus === 'coming-soon')
    return (
      <div className="page-container py-7">
        <NotFoundPage />
      </div>
    )
  return (
    <>
      <header className="detail-header">
        <nav aria-label="현재 위치" className="page-container flex min-h-20 items-center gap-6">
          <Link to="/" aria-label="CAPSULE 홈">
            <Brand />
          </Link>
          <span className="h-5 w-px bg-line" />
          <Link to="/" className="text-sm text-muted hover:text-ink">
            ← 홈
          </Link>
          <Icon name="chevron" size={14} className="text-subtle" />
          <span aria-current="page" className="text-sm font-semibold">
            {room.name}
          </span>
        </nav>
      </header>
      <div className="page-container py-8 sm:py-10">
        <section className="room-detail-hero" aria-labelledby="room-title">
          <div className="room-detail-backdrop">
            <RoomArtwork roomId={room.id} variant="hero" eager />
          </div>
          <div className="room-detail-copy">
            <p className="eyebrow mb-5">
              <span className="live-dot" /> YOUR NEXT CHAPTER
            </p>
            <h1 id="room-title">{room.name}</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/75">{room.introduction}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="scene-chip">
                <Icon name="clock" size={13} /> 50분 공부 · 10분 휴식
              </span>
              <span className="scene-chip">
                <Icon name="heart" size={13} /> {room.characters.length}명의 공부 메이트
              </span>
              <span className="scene-chip">기본 공부 무료</span>
            </div>
          </div>
          {room.coverUrl && (
            <img src={room.coverUrl} alt={`${room.name} 포스터`} className="room-detail-poster" />
          )}
        </section>
        <section className="mt-10" aria-labelledby="room-characters">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">MEET YOUR COMPANIONS</p>
              <h2 id="room-characters" className="text-2xl font-bold">
                네 옆자리를 지킬 친구들
              </h2>
            </div>
            <p className="text-xs text-subtle">공부할 때 각자 자기 칸에 앉아요</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {room.characters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </div>
        </section>
        <div className="room-start-bar">
          <div className="flex items-center gap-4">
            <span className="hidden rounded-2xl bg-brand-soft p-3 text-brand sm:block">
              <Icon name="book" size={23} />
            </span>
            <div>
              <p className="text-sm font-semibold">오늘의 한 페이지, 함께 시작할까요?</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {room.characters.map((c) => c.name).join(' · ')}와 50분의 집중 · 기본 공부는
                무료예요
              </p>
            </div>
          </div>
          <ButtonLink
            to={
              state.activeSession
                ? `/study/${state.activeSession.id}`
                : `/rooms/${room.id}/prepare${state.cameraChecked ? '?step=set' : ''}`
            }
            className="shrink-0"
          >
            {state.activeSession ? '진행 중인 공부로 돌아가기' : '이 룸에서 공부 시작'}
            <Icon name="arrow" size={18} />
          </ButtonLink>
        </div>
      </div>
    </>
  )
}
