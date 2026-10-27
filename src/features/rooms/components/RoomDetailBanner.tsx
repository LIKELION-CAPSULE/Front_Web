import { roomDetailBanners } from '../detail-banners'
import './room-detail-banner.css'

export function RoomDetailBanner({ roomId }: { roomId: string }) {
  const banner = roomDetailBanners[roomId] ?? roomDetailBanners['dawn-library']!
  return (
    <div className="room-detail-backdrop" aria-hidden="true">
      <img
        className="room-detail-banner-image"
        src={banner.src}
        alt=""
        width={banner.width}
        height={banner.height}
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
    </div>
  )
}
