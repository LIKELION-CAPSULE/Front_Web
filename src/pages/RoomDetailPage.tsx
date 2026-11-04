import { Link, useParams } from 'react-router'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { CharacterCard } from '@/features/characters/components/CharacterCard'
import { RoomDetailBanner } from '@/features/rooms/components/RoomDetailBanner'
import { getStudyRoom } from '@/features/rooms/services/room-service'
import { ButtonLink } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { useDemo } from '@/features/demo/demo-context'
import NotFoundPage from '@/pages/NotFoundPage'
import MvpUnavailablePage from '@/pages/MvpUnavailablePage'
import { isMvpCharacter, isMvpRoom } from '@/features/mvp/policy'
import { MvpGate } from '@/features/mvp/MvpGate'

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
  if (!room.serverRoom && !isMvpRoom(room.id)) return <MvpUnavailablePage />
  return (
    <>
      <SiteHeader
        navigation={(
          <nav aria-label="현재 위치" className="detail-breadcrumb">
            <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-divider md:block" />
            <div className="detail-breadcrumb-links">
              <Link to="/" className="shrink-0 text-body-compact text-muted hover:text-ink">
                홈
              </Link>
              <Icon name="chevron" size={14} className="shrink-0 text-subtle" />
              <span aria-current="page" className="truncate text-body-compact font-semibold">
                {room.name}
              </span>
            </div>
          </nav>
        )}
        account={state.profile.loggedIn ? (
          <HeaderAccount />
        ) : (
          <ButtonLink
            to={`/login?next=${encodeURIComponent(`/rooms/${room.id}`)}`}
            variant="secondary"
          >
            로그인
          </ButtonLink>
        )}
      />
      <div className="page-container py-8 sm:py-10">
        <section
          className="room-detail-hero room-detail-hero--illustrated"
          aria-labelledby="room-title"
        >
          {room.serverRoom && room.coverUrl && !room.artworkId ? <div className="room-detail-backdrop"><img src={room.coverUrl} alt="" className="room-detail-banner-image" /></div> : <RoomDetailBanner roomId={room.artworkId ?? room.id} />}
          <div className="room-detail-copy">
            <h1 id="room-title" className="type-story-title">{room.name}</h1>
            <p className="mt-4 max-w-md type-body text-muted">{room.description}</p>
            <ButtonLink
              to={
                state.activeSession
                  ? `/study/${state.activeSession.id}`
                  : `/rooms/${room.id}/prepare`
              }
              className="mt-6 max-w-full"
            >
              {state.activeSession ? '진행 중인 공부로 돌아가기' : '이곳에서 공부하기'}
              <Icon name="arrow" size={18} className="shrink-0" />
            </ButtonLink>
          </div>
        </section>
        <section className="mt-10" aria-labelledby="room-characters">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="room-characters" className="type-section-title">
              이곳에서 함께할 {room.characters.length === 1 ? '친구' : '친구들'}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {room.characters.map((character) => (
              (character.serverCharacter || isMvpCharacter(character.id))
                ? <CharacterCard key={character.id} character={character} />
                : <MvpGate key={character.id} label={character.name} className="mvp-friend">
                    <CharacterCard character={character} />
                  </MvpGate>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
