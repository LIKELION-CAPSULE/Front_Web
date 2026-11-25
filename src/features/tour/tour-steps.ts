/**
 * The service tour (홈 「사용법 보기」): one pass over the whole service, 홈 → 메이트 상세 → 연습 통화 → 내 메이트 →
 * 내 기록 → 계정 설정 → 마무리, in 11 steps (user decision 2026-11-26: from 29). 채린's cursor visits a step's marks one
 * after another (a `data-tour` attribute on the real screen; the practice call is its own page) and says the line.
 *
 * Dependency-free so Node tests can check the script. The controller (ServiceTour.tsx) moves between screens only when
 * the user presses 「다음」/「이전」/「이 화면 건너뛰기」; the cursor's press never navigates.
 */

export type TourScreen = 'home' | 'mate-detail' | 'call' | 'my-mates' | 'records' | 'account' | 'outro'

export const SCREEN_LABELS: Readonly<Record<TourScreen, string>> = {
  home: '홈',
  'mate-detail': '메이트 상세',
  call: '연습 통화',
  'my-mates': '내 메이트',
  records: '내 기록',
  account: '계정 설정',
  outro: '마무리',
}

/** Where the arrow tip lands on the target (fractions of its box): an edge or a lower corner, never on its words. */
export type TourPoint = { x: number; y: number }

export type TourFeature = 'affinity' | 'expressions'

/** One place the cursor visits inside a step. */
export type TourMark = {
  /** CSS selectors tried in order; the first present element is the target. */
  targets: readonly string[]
  at?: TourPoint
  action: 'hover' | 'click' | 'type'
  /** `type`: what the cursor types into the target (the practice chat). */
  text?: string
  /** A visual press shows these chips next to 채린's line (nothing real happens). */
  preview?: readonly string[]
  /** Hidden by a mate feature flag in production (mate-features.ts): the mark is left out when the flag is off. */
  feature?: TourFeature
}

export type TourStep = {
  id: string
  screen: TourScreen
  /**
   * Visited in order. The step waits for the first one (it is the step's anchor; missing in time, the step is skipped);
   * the others are used when they are on screen. Empty: no target (a line only).
   */
  marks: readonly TourMark[]
  say: string
  /** The line when a mark of this step is left out by its feature flag (it must not name a hidden feature). */
  sayWithout?: string
  labelSide?: 'left'
  /** How long to wait for the first mark after arriving (lazy screens, the my-mates pour, the records board). */
  waitMs?: number
}

export type TourContext = {
  /** The first mate (detail and practice call). */
  mateId: string
  features: { affinity: boolean; expressions: boolean }
}

/** Lower-right corner just inside the box: buttons, chips, menu items, tabs. */
const CORNER: TourPoint = { x: 0.9, y: 0.94 }
/** Right edge of a large block, a little above the middle. */
const EDGE: TourPoint = { x: 0.97, y: 0.4 }

export const TOUR_STEPS: readonly TourStep[] = [
  // 홈
  {
    id: 'home-mates', screen: 'home',
    marks: [
      { targets: ['[data-tour="mate-card"]'], at: { x: 0.96, y: 0.42 }, action: 'hover' },
      // The card's 「○○와 연결하기」 arrow; then the hero's CTA (「○○와 연결하기」 once checked in) or the card badge.
      { targets: ['[data-tour="mate-card-connect"]', '[data-tour="connect"]', '[data-tour="mate-card-status"]'], at: CORNER, action: 'click', preview: ['영상통화처럼 함께', '음성 대화', 'PIP로 띄우기'] },
    ],
    say: '같이 있을 메이트는 카드에서 골라. 연결하면 영상통화처럼 같이 있고, 음성이랑 PIP도 돼.',
  },
  {
    id: 'home-attendance', screen: 'home', labelSide: 'left',
    marks: [{ targets: ['[data-tour="home-attendance"]'], at: EDGE, action: 'hover' }],
    say: '매일 출석하면 크레딧을 받아. 날마다 보상이 달라지니까 빠지지 말고 와.',
  },
  // 메이트 상세
  {
    id: 'mate-detail', screen: 'mate-detail', waitMs: 6000,
    marks: [
      { targets: ['[data-tour="mate-detail-tagline"]', '[data-tour="mate-detail-intro"]', '[data-tour="mate-detail-name"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-tour="mate-detail-age"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-tour="mate-detail-voice"] button', '[data-tour="mate-detail-voice"]'], at: CORNER, action: 'click', preview: ['목소리 미리 듣기'] },
      { targets: ['[data-tour="mate-detail-connect"] button', '[data-tour="mate-detail-connect"] a'], at: CORNER, action: 'click', preview: ['연결하면 통화 화면이 열려요'] },
    ],
    say: '소개랑 연령 등급, 목소리는 여기서 미리 확인해. 연결하기를 누르면 바로 통화가 시작돼.',
  },
  // 연습 통화
  {
    id: 'call-mate', screen: 'call', waitMs: 6000,
    marks: [
      { targets: ['[data-tour="call-mate"]'], at: EDGE, action: 'hover' },
      { targets: ['[data-tour="call-talk"]'], at: CORNER, action: 'hover' },
    ],
    say: '통화 중엔 내가 반응하고 먼저 말도 걸어. 말 거는 빈도는 위에서 정할 수 있어.',
  },
  {
    id: 'call-talk', screen: 'call',
    marks: [
      { targets: ['[data-tour="call-composer"] textarea', '[data-tour="call-composer"] input'], at: CORNER, action: 'type', text: '오늘 수학 같이 하자' },
      { targets: ['[data-tour="call-dock"] [data-action="camera"]', '[data-tour="call-dock"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-tour="call-mode"]'], at: CORNER, action: 'hover' },
    ],
    say: '채팅으로 쓰거나 누르고 말하면 음성으로 대화하고, 카메라를 켜면 같이 있던 시간도 재 줘. 기본 모드는 크레딧 없이, 고급 모드는 크레딧을 써서 더 깊게 얘기해.',
  },
  {
    id: 'call-end', screen: 'call', labelSide: 'left',
    marks: [
      { targets: ['[data-tour="call-dock"] [data-action="pip"]', '[data-tour="call-dock"] [data-action="more"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-tour="call-dock"] [data-action="leave"]'], at: CORNER, action: 'click', preview: ['끊으면 연결 기록이 남아요'] },
    ],
    say: 'PIP로 작게 띄워 두면 다른 일 하면서도 같이 있을 수 있어. 끝낼 땐 여기, 끊으면 연결 기록이 남아.',
  },
  // 내 메이트
  {
    id: 'mates-capsules', screen: 'my-mates', labelSide: 'left', waitMs: 9000,
    marks: [
      { targets: ['[data-tour="my-mates-scene"]'], at: EDGE, action: 'hover' },
      { targets: ['[data-tour="my-mates-total"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-tour="my-mates-affinity"]'], at: CORNER, action: 'hover', feature: 'affinity' },
    ],
    say: '같이 보낸 시간은 캡슐로 쌓이고, 함께한 시간도 여기서 봐. 같이 있을수록 친밀도가 오르고 새 표정이 열려.',
    sayWithout: '같이 보낸 시간은 캡슐로 쌓여. 함께한 시간이랑 연결 횟수는 여기서 봐.',
  },
  {
    id: 'mates-recent', screen: 'my-mates', labelSide: 'left',
    marks: [
      // The recent list sits at the bottom of the side column, controls all round: the arrow takes its left edge.
      { targets: ['[data-tour="my-mates-recent"]'], at: { x: 0.03, y: 0.5 }, action: 'hover' },
      { targets: ['[data-tour="my-mates-expressions"]'], at: CORNER, action: 'hover', feature: 'expressions' },
    ],
    say: '최근 캡슐을 누르면 그날의 기록 카드가 열려. 열린 표정은 여기 모이고, 누르면 그 표정을 지어 줄게.',
    sayWithout: '최근 캡슐을 누르면 그날의 기록 카드가 열려. 보고 싶으면 언제든 만나러 와.',
  },
  // 내 기록
  {
    id: 'records', screen: 'records', waitMs: 8000,
    marks: [
      { targets: ['[data-tour="records-periods"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-tour="records-view"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-tour="records-board"]'], at: { x: 0.5, y: 0.72 }, action: 'click', preview: ['그날의 기록 카드'] },
    ],
    say: '주, 월, 연으로 기간을 바꾸고, 보드는 2D나 2.5D로 볼 수 있어. 날짜를 누르면 그날 기록이 열려.',
  },
  // 계정 설정
  {
    id: 'account', screen: 'account', waitMs: 6000,
    marks: [
      { targets: ['[data-account-view="profile"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-account-view="settings"]'], at: CORNER, action: 'hover' },
      { targets: ['[data-account-view="security"]'], at: CORNER, action: 'hover' },
    ],
    say: '프로필에선 아바타랑 닉네임을 정하고, 설정에선 말 거는 정도랑 기기, PIP를 바꿔. 비밀번호랑 탈퇴는 보안 탭에 있어.',
  },
  // 마무리
  { id: 'outro', screen: 'outro', marks: [], say: '이제 만나러 가 볼까?' },
]

/** The screen's address for a step (the controller adds `tour=<id>`). */
export function stepPath(step: TourStep, context: TourContext): string {
  switch (step.screen) {
    case 'home':
    case 'outro':
      return '/'
    case 'mate-detail':
      return `/mates/${context.mateId}`
    case 'call':
      return `/tour/call/${context.mateId}`
    case 'my-mates':
      return `/mates/me?mate=${context.mateId}`
    case 'records':
      return '/records'
    case 'account':
      return '/?account=profile'
  }
}

/**
 * The steps this build shows: marks behind a flag that is off go (production), and such a step speaks its
 * `sayWithout` line. A step left with no marks (all flagged off) goes too.
 */
export function tourSteps(context: TourContext): TourStep[] {
  return TOUR_STEPS.flatMap((step) => {
    const marks = step.marks.filter((mark) => !mark.feature || context.features[mark.feature])
    if (marks.length === step.marks.length) return [step]
    if (!marks.length) return []
    return [{ ...step, marks, say: step.sayWithout ?? step.say }]
  })
}

export function tourHref(step: TourStep, context: TourContext): string {
  const path = stepPath(step, context)
  return `${path}${path.includes('?') ? '&' : '?'}tour=${step.id}`
}

/** The first step of the next screen (「이 화면 건너뛰기」), or null on the last screen. */
export function nextScreenStep(steps: readonly TourStep[], index: number): TourStep | null {
  const screen = steps[index]?.screen
  return steps.slice(index + 1).find((step) => step.screen !== screen) ?? null
}

/** Long enough to read the line (Korean, ~7 characters a second), never shorter than 2.6 s. */
export const readMs = (text: string) => Math.max(2600, Math.round(Array.from(text).length * 140))

/** Where 「건너뛰기」 returns to: the screen the tour was opened from (kept for this tab). */
export const TOUR_ORIGIN_KEY = 'capsule-tour-origin'
