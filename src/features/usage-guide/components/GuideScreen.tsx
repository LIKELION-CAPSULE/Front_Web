import { getStudyRooms } from '@/features/rooms/services/room-service'
import { welcomeBanners } from '@/features/rooms/welcome-banners'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { GUIDE_COPY } from '../guide-steps'

/**
 * What the monitor shows, laid out at viewport size and fitted onto the screen in 3D: the room list, then a study
 * session with a companion nudging you back, then the affection gauge and a capsule card. Purely a picture.
 */
export function GuideScreen({ step }: { step: number }) {
  const rooms = getStudyRooms().slice(0, 4)
  const study = welcomeBanners.find((banner) => banner.quote) ?? welcomeBanners[0]
  const companion = rooms[0]?.characters[0]
  const portrait = getCharacterArtwork(companion?.id).affection
  return (
    <div className="guide-screen">
      <section className="guide-screen-page guide-screen-rooms" data-active={step === 0 || undefined}>
        <p className="guide-screen-heading">오늘은 어디서 공부할까요?</p>
        <div className="guide-screen-grid">
          {rooms.map((room) => (
            <div key={room.id} className="guide-screen-room">
              {room.coverUrl && <img src={room.coverUrl} alt="" decoding="async" />}
              <span>{room.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="guide-screen-page guide-screen-study" data-active={step === 1 || undefined}>
        {study && <img className="guide-screen-cover" src={study.src} alt="" decoding="async" />}
        <p className="guide-screen-bubble">{GUIDE_COPY.companionNudge}</p>
        <div className="guide-screen-cam">
          <span className="guide-screen-cam-dot" />
          CAM
        </div>
      </section>

      <section className="guide-screen-page guide-screen-capsule" data-active={step === 2 || undefined}>
        <div className="guide-screen-card">
          <img src={portrait} alt="" decoding="async" />
          <span>{GUIDE_COPY.capsuleLabel}</span>
        </div>
        <div className="guide-screen-affection">
          <p>
            {companion?.name ?? '친구'} {GUIDE_COPY.affectionLabel}
          </p>
          <div className="guide-screen-meter">
            <span />
          </div>
          <p className="guide-screen-gain">+ 2시간 함께 공부</p>
        </div>
      </section>
    </div>
  )
}
