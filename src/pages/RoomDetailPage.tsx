import { Link, useParams } from 'react-router'
import { HeaderAccount } from '@/app/components/HeaderAccount'
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
        <div className="page-container detail-header-inner">
          <Link to="/" aria-label="CAPSULE 홈" className="shrink-0">
            <Brand />
          </Link>
          <nav aria-label="현재 위치" className="detail-breadcrumb">
            <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-line sm:block" />
            <Link to="/" className="shrink-0 text-sm text-muted hover:text-ink">
              홈
            </Link>
            <Icon name="chevron" size={14} className="shrink-0 text-subtle" />
            <span aria-current="page" className="truncate text-sm font-semibold">
              {room.name}
            </span>
          </nav>
          {state.profile.loggedIn ? (
            <HeaderAccount studyTime="always" />
          ) : (
            <ButtonLink
              to={`/login?next=${encodeURIComponent(`/rooms/${room.id}`)}`}
              variant="secondary"
              className="ml-auto"
            >
              로그인
            </ButtonLink>
          )}
        </div>
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
                  : `/rooms/${room.id}/prepare`
              }
              className="mt-6 max-w-full"
            >
              {state.activeSession ? '진행 중인 공부로 돌아가기' : '이곳에서 공부하기'}
              <Icon name="arrow" size={18} motion="nudge" className="shrink-0" />
            </ButtonLink>
          </div>
        </section>
        <section className="mt-10" aria-labelledby="room-characters">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="room-characters" className="text-2xl font-bold">
              이곳에서 함께할 {room.characters.length === 1 ? '친구' : '친구들'}
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
