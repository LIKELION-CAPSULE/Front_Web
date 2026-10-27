import chaerin from '@/assets/welcome-banners/chaerin-banner-v1.webp'
import sua from '@/assets/welcome-banners/sua-banner-v1.webp'
import dahee from '@/assets/welcome-banners/dahee-banner-v1.webp'
import type { ScratchSlide } from '@/shared/ui/hover-scratch/HoverScratchCarousel'

export type WelcomeBanner = ScratchSlide & { name: string; quote: string }

/** Text is authored in HTML, independent of the generated illustration. */
export const welcomeBanners: readonly WelcomeBanner[] = [
  {
    id: 'chaerin',
    name: '채린',
    src: chaerin,
    label: '노을빛 교실에서 함께 공부하는 채린',
    quote: '네 자리, 비워 뒀어. 얼른 와.',
  },
  {
    id: 'sua',
    name: '수아',
    src: sua,
    label: '비 오는 도서관에서 책을 읽는 수아',
    quote: '조금씩 해도 괜찮아. 같이 하자.',
  },
  {
    id: 'dahee',
    name: '다희',
    src: dahee,
    label: '보랏빛 야간 스터디룸에서 공부하는 다희',
    quote: '오늘도 한 장씩, 같이 넘겨 볼까?',
  },
]
