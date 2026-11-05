import { Link, useLocation, useParams } from 'react-router'
import { HeaderAccount } from '@/app/components/HeaderAccount'
import { SiteHeader } from '@/app/components/SiteHeader'
import { CharacterCard } from '@/features/characters/components/CharacterCard'
import { RoomDetailBanner } from '@/features/rooms/components/RoomDetailBanner'
import { RoomDetailWordmark } from '@/features/rooms/components/RoomDetailWordmark'
import { roomArtwork } from '@/features/rooms/artwork'
import { roomPosterOverrides, roomPosters } from '@/features/rooms/posters'
import { getRoomAssetId } from '@/features/rooms/room-asset-id'
import { getStudyRoom, getStudyRooms } from '@/features/rooms/services/room-service'
import { ButtonLink } from '@/shared/ui/Button'
import { BookmarkButton } from '@/shared/ui/BookmarkButton'
import { Icon } from '@/shared/ui/Icon'
import { useDemo } from '@/features/demo/demo-context'
import NotFoundPage from '@/pages/NotFoundPage'
import MvpUnavailablePage from '@/pages/MvpUnavailablePage'
import { isMvpCharacter, isMvpRoom } from '@/features/mvp/policy'
import { MvpGate } from '@/features/mvp/MvpGate'

export default function RoomDetailPage() {
  const { roomId } = useParams()
  const location = useLocation()
  const { state, dispatch } = useDemo()
  const room = roomId ? getStudyRoom(roomId) : undefined
  if (!room || room.contentStatus === 'coming-soon')
    return (
      <div className="page-container py-7">
        <NotFoundPage />
      </div>
    )
  if (!room.serverRoom && !isMvpRoom(room.id)) return <MvpUnavailablePage />
  const artwork = roomArtwork[room.artworkId ?? room.id]
  const poster = roomPosterOverrides[getRoomAssetId(room.artworkId ?? room.id, room.name)] || room.coverUrl || (artwork && roomPosters[artwork.tone])
  const relatedRooms = getStudyRooms().filter(value => value.id !== room.id && value.contentStatus === 'preview' && (value.serverRoom || isMvpRoom(value.id))).slice(0, 3)
  const studyPath = state.activeSession ? `/study/${state.activeSession.id}` : `/rooms/${room.id}/prepare`
  const saved = state.savedRooms.includes(room.id)
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
      <div className="room-detail-page">
        <section className="room-detail-hero" aria-labelledby="room-title">
          <RoomDetailBanner
            roomId={room.artworkId ?? room.id}
            src={room.bannerUrl || (room.serverRoom && !room.artworkId ? room.coverUrl : undefined)}
          />
          <div className="page-container room-detail-hero-content">
            <div className="room-detail-heading">
              <h1 id="room-title">{room.name}</h1>
            </div>
            <div className="room-detail-hero-footer">
              <ButtonLink to={studyPath} state={state.activeSession ? undefined : { prepareBackground: location }} aria-haspopup={state.activeSession ? undefined : 'dialog'} preventScrollReset className="room-detail-start">
                <Icon name="play" size={18} fill="currentColor" />
                {state.activeSession ? '진행 중인 공부로 돌아가기' : '이곳에서 공부하기'}
              </ButtonLink>
              <BookmarkButton
                pressed={saved}
                label={saved ? '스터디룸 저장 해제' : '스터디룸 저장'}
                onClick={() => dispatch({ type: 'SAVE_ROOM', roomId: room.id })}
                className="room-detail-save"
              >{saved ? '저장됨' : '저장하기'}</BookmarkButton>
            </div>
          </div>
        </section>
        <div className="page-container room-detail-content">
          <aside className="room-detail-sidebar" aria-label="스터디룸 포스터">
            {poster && <figure className="room-detail-poster"><img src={poster} alt={`${room.name} 포스터`} loading="eager" decoding="async" /></figure>}
          </aside>
          <div className="room-detail-main">
            <section className="room-detail-introduction" aria-labelledby="room-introduction-title">
              <h2 id="room-introduction-title" className="room-detail-section-label">공간 소개</h2>
              <p className="room-detail-description">{room.description || room.name}</p>
              {room.introduction && <p className="room-detail-story">{room.introduction}</p>}
            </section>
            <section className="room-detail-friends" aria-labelledby="room-characters">
              <div className="room-detail-section-heading">
                <h2 id="room-characters" className="type-section-title">
                  이곳에서 함께할 {room.characters.length === 1 ? '친구' : '친구들'}
                </h2>
              </div>
              <div className="room-detail-characters" data-single={room.characters.length === 1 || undefined}>
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
        </div>
        {relatedRooms.length > 0 && <section className="page-container room-detail-related" aria-labelledby="room-related-title">
          <div className="room-detail-section-heading">
            <h2 id="room-related-title" className="type-section-title">다른 공간도 둘러보세요</h2>
          </div>
          <div className="room-detail-related-grid">{relatedRooms.map(value => (
            <Link key={value.id} to={`/rooms/${value.id}`} className="room-detail-recommendation">
              <div className="room-detail-recommendation-image">
                {value.coverUrl && <img src={value.coverUrl} alt="" loading="lazy" decoding="async" />}
              </div>
              <h3>{value.name}</h3>
              {value.description && <p>{value.description}</p>}
            </Link>
          ))}</div>
        </section>}
        <RoomDetailWordmark />
      </div>
    </>
  )
}
