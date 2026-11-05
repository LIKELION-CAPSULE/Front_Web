import type { CSSProperties } from 'react'
import { roomDetailBanners } from '../detail-banners'
import './room-detail-banner.css'

export function RoomDetailBanner({ roomId, src }: { roomId: string; src?: string }) {
  const banner = roomDetailBanners[roomId] ?? roomDetailBanners['dawn-library']!
  return (
    <div className="room-detail-backdrop" aria-hidden="true" style={{ '--room-detail-mobile-position': banner.mobilePosition } as CSSProperties}>
      <img
        className="room-detail-banner-image"
        src={src || banner.src}
        alt=""
        width={src ? undefined : banner.width}
        height={src ? undefined : banner.height}
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
    </div>
  )
}
