import { withParticle } from '@/shared/lib/korean'

/** Every piece of home copy in one place. */
export const HOME_COPY = {
  heroTitle: (name: string) => ({ before: '오늘도 ', accent: withParticle(name, '이와', '와'), after: '함께해요!' }),
  heroSub: '매일 출석하고 특별한 보상을 받아보세요.',
  heroSubDone: '오늘 출석 완료! 이제 같이 공부해요.',
  ctaCheckIn: '출석하고 크레딧 받기',
  ctaStudy: (name: string) => `${withParticle(name, '과', '와')} 공부 시작하기`,
  aiLabel: 'AI 캐릭터',
  matesTitle: '오늘은 누구와 함께할까요?',
  more: '더보기',
  available: '연결 가능',
  upcoming: '추가 예정',
  upcomingName: '새로운 메이트',
  upcomingLine: '곧 새로운 인연이 찾아와요!',
  enterRoom: (name: string) => `${name} 스터디룸 들어가기`,
  loadFailed: '메이트를 불러오지 못했어요',
  retry: '다시 시도',
} as const
