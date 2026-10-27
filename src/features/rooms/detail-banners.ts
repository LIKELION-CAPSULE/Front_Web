import classroom from '@/assets/room-detail-banners/classroom-detail-banner-v1.webp'
import night from '@/assets/room-detail-banners/night-detail-banner-v1.webp'
import cat from '@/assets/room-detail-banners/cat-detail-banner-v1.webp'
import lantern from '@/assets/room-detail-banners/lantern-detail-banner-v1.webp'
import fantasy from '@/assets/room-detail-banners/fantasy-detail-banner-v1.webp'
import iljin from '@/assets/room-detail-banners/iljin-detail-banner-v2.webp'
import jurassic from '@/assets/room-detail-banners/jurassic-detail-banner-v1.webp'
import lab from '@/assets/room-detail-banners/lab-detail-banner-v1.webp'
import joseon from '@/assets/room-detail-banners/joseon-detail-banner-v1.webp'

const banner = (src: string, width = 2172, height = 724) => ({ src, width, height })

/** Complete illustrations for detail pages; room cards keep their independent scene layers. */
export const roomDetailBanners: Record<string, ReturnType<typeof banner>> = {
  'dawn-library': banner(classroom),
  'room-2': banner(night, 2167, 726),
  'room-3': banner(cat),
  lantern: banner(lantern),
  fantasy: banner(fantasy),
  iljin: banner(iljin),
  jurassic: banner(jurassic),
  lab: banner(lab),
  joseon: banner(joseon),
}
