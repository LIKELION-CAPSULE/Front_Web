import { Link, useParams } from 'react-router'
import { CharacterCard } from '@/features/characters/components/CharacterCard'
import { RoomDetailBanner } from '@/features/rooms/components/RoomDetailBanner'
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
            홈
          </Link>
          <Icon name="chevron" size={14} className="text-subtle" />
          <span aria-current="page" className="text-sm font-semibold">
            {room.name}
          </span>
        </nav>
      </header>
      <div className="page-container py-8 sm:py-10">
        <section
          className="room-detail-hero room-detail-hero--illustrated"
          aria-labelledby="room-title"
        >
          <RoomDetailBanner roomId={room.id} />
          <div className="room-detail-copy">
            <h1 id="room-title">{room.name}</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/75">{room.introduction}</p>
            <ButtonLink
              to={
                state.activeSession
                  ? `/study/${state.activeSession.id}`
                  : `/rooms/${room.id}/prepare${state.cameraChecked ? '?step=goal' : ''}`
              }
              className="mt-6 max-w-full"
            >
              {state.activeSession ? '진행 중인 공부로 돌아가기' : '이 룸에서 공부 시작'}
              <Icon name="arrow" size={18} motion="nudge" className="shrink-0" />
            </ButtonLink>
          </div>
        </section>
        <section className="mt-10" aria-labelledby="room-characters">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="room-characters" className="text-2xl font-bold">
              네 옆자리를 지킬 친구들
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {room.characters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
