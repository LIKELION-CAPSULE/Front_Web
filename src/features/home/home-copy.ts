import { withParticle } from '@/shared/lib/korean'

/** Every piece of home copy in one place. */
export const HOME_COPY = {
  heroTitle: { before: '오늘도 ', accent: '캡슐과', after: '함께해요!' },
  heroSub: '매일 출석하고 1,500 크레딧을 받아보세요.',
  heroSubDone: '오늘 출석 완료! 친구를 초대하면 크레딧을 더 받아요.',
  ctaCheckIn: '출석하고 크레딧 받기',
  ctaInvite: '친구 초대하고 크레딧 받기',
  /** Read while the hero's line and button wait for today's attendance. */
  attendanceLoading: '오늘 출석 정보를 불러오고 있어요.',
  matesTitle: '오늘은 누구와 함께할까요?',
  available: '연결 가능',
  /** A mate shown but not open yet (11 `comingSoon`): its page offers 「공개 알림 받기」 (46). */
  comingSoon: '곧 만나요',
  comingSoonLabel: (name: string) => `${name} · 곧 만나요`,
  /**
   * The card's 「바로 연결」 control starts the connection right away (the card itself opens the detail). Its name holds
   * the visible words, so voice control and screen readers match what is on screen (UX review 2-1).
   */
  connectNow: '바로 연결',
  connectMate: (name: string) => `${withParticle(name, '과', '와')} 바로 연결`,
  /**
   * The 「?」 cards that fill the row after the real mates (home only, not mate data). New mates open after the beta, on
   * no set date: nothing here may promise when (no 「곧」, no "coming soon").
   */
  mysteryName: '???',
  mysteryLine: '다음 메이트를 준비하고 있어요',
  /** Read once for all the 「?」 cards (each card itself is hidden from screen readers). */
  mysteryLabel: '다음 메이트 준비 중',
  loadFailed: '메이트를 불러오지 못했어요',
  retry: '다시 시도',
} as const
