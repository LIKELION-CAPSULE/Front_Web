import { withParticle } from '@/shared/lib/korean'

/** Every piece of home copy in one place. */
export const HOME_COPY = {
  heroTitle: { before: '오늘도 ', accent: '캡슐과', after: '함께해요!' },
  heroSub: '매일 출석하고 특별한 보상을 받아보세요.',
  heroSubDone: '오늘 출석 완료! 친구를 초대하면 크레딧을 더 받아요.',
  ctaCheckIn: '출석하고 크레딧 받기',
  ctaInvite: '친구 초대하고 크레딧 받기',
  matesTitle: '오늘은 누구와 함께할까요?',
  available: '연결 가능',
  /** A mate shown but not open yet (11 `comingSoon`): its page offers 「공개 알림 받기」 (46). */
  comingSoon: '곧 만나요',
  comingSoonLabel: (name: string) => `${name} · 곧 만나요`,
  upcoming: '추가 예정',
  upcomingName: '새로운 메이트',
  upcomingLine: '곧 새로운 인연이 찾아와요!',
  /** The card's arrow starts the connection right away, like the hero CTA (the card itself opens the detail). */
  connectMate: (name: string) => `${withParticle(name, '과', '와')} 연결하기`,
  loadFailed: '메이트를 불러오지 못했어요',
  retry: '다시 시도',
} as const
