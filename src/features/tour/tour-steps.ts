/**
 * The service tour (홈 「사용법 보기」): one pass over the whole service, 홈 → 메이트 상세 → 연습 통화 → 내 메이트 →
 * 내 기록 → 계정 설정 → 마무리. 채린's cursor points at each step's target (a `data-tour` attribute on the real screen;
 * the practice call is its own page) and says the line.
 *
 * Dependency-free so Node tests can check the script. The controller (ServiceTour.tsx) moves between screens only when
 * the user presses 「다음」/「이전」; the cursor's press never navigates.
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

export type TourStep = {
  id: string
  screen: TourScreen
  /** CSS selectors tried in order; the first present element is the target. Empty: no target (a line only). */
  targets: readonly string[]
  at?: TourPoint
  action: 'hover' | 'click' | 'type' | 'say'
  say: string
  /** `type`: what the cursor types into the target (the practice chat). */
  text?: string
  labelSide?: 'left'
  /** Hidden by a mate feature flag in production (mate-features.ts): the step is skipped when the flag is off. */
  feature?: 'affinity' | 'expressions'
  /** How long to wait for the target after arriving (lazy screens, the my-mates pour, the records board). */
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
  { id: 'home-card', screen: 'home', targets: ['[data-tour="mate-card"]'], at: { x: 0.96, y: 0.42 }, action: 'hover', say: '같이 있을 메이트는 여기서 골라. 카드를 누르면 먼저 만나 볼 수 있어.' },
  { id: 'home-connect', screen: 'home', targets: ['[data-tour="connect"] button', '[data-tour="connect"] a', '[data-tour="mate-card-status"]'], at: CORNER, action: 'click', say: '연결하면 나랑 영상통화처럼 같이 있는 거야. 음성이랑 PIP도 돼.' },
  // 메이트 상세
  { id: 'detail-intro', screen: 'mate-detail', targets: ['[data-tour="mate-detail-tagline"]', '[data-tour="mate-detail-intro"]', '[data-tour="mate-detail-name"]'], at: CORNER, action: 'hover', waitMs: 6000, say: '어떤 메이트인지, 어떤 상황에서 만나는지는 여기서 봐.' },
  { id: 'detail-age', screen: 'mate-detail', targets: ['[data-tour="mate-detail-age"]'], at: CORNER, action: 'hover', say: '메이트마다 연령 등급이 있어.' },
  { id: 'detail-voice', screen: 'mate-detail', targets: ['[data-tour="mate-detail-voice"] button', '[data-tour="mate-detail-voice"]'], at: CORNER, action: 'click', say: '목소리는 여기서 미리 들어 볼 수 있어.' },
  { id: 'detail-connect', screen: 'mate-detail', targets: ['[data-tour="mate-detail-connect"] button', '[data-tour="mate-detail-connect"] a'], at: CORNER, action: 'click', say: '연결하기를 누르면 바로 통화가 시작돼.' },
  // 연습 통화
  { id: 'call-mate', screen: 'call', targets: ['[data-tour="call-mate"]'], at: EDGE, action: 'hover', waitMs: 6000, say: '통화 중엔 내가 여기서 반응하고 먼저 말도 걸어.' },
  { id: 'call-mode', screen: 'call', targets: ['[data-tour="call-mode"]'], at: CORNER, action: 'hover', say: '기본은 크레딧 없이, 고급은 한 턴에 크레딧을 써서 더 깊게 얘기해.' },
  { id: 'call-chat', screen: 'call', targets: ['[data-tour="call-composer"] textarea', '[data-tour="call-composer"] input'], at: CORNER, action: 'type', text: '오늘 수학 같이 하자', say: '하고 싶은 말은 여기에 써서 보내면 돼.' },
  { id: 'call-media', screen: 'call', targets: ['[data-tour="call-dock"] [data-action="camera"]', '[data-tour="call-dock"]'], at: CORNER, action: 'hover', say: '누르고 말하면 목소리로 대화하고, 카메라를 켜면 같이 있던 시간도 재 줘.' },
  { id: 'call-layout', screen: 'call', targets: ['[data-tour="call-layout"]'], at: CORNER, action: 'hover', say: '화면 배치는 여기서 바꿔. 나를 크게, 나눠서, 너를 크게.' },
  { id: 'call-pip', screen: 'call', targets: ['[data-tour="call-dock"] [data-action="pip"]', '[data-tour="call-pip"]'], at: CORNER, action: 'hover', labelSide: 'left', say: 'PIP로 작게 띄워 두면 다른 일 하면서도 같이 있을 수 있어.' },
  { id: 'call-leave', screen: 'call', targets: ['[data-tour="call-dock"] [data-action="leave"]', '[data-tour="call-leave"]'], at: CORNER, action: 'click', labelSide: 'left', say: '끝낼 땐 여기. 끊으면 연결 기록이 남아.' },
  // 내 메이트
  { id: 'mates-capsules', screen: 'my-mates', targets: ['[data-tour="my-mates-scene"]'], at: EDGE, action: 'hover', labelSide: 'left', waitMs: 9000, say: '같이 보낸 시간은 이렇게 캡슐로 쌓여.' },
  { id: 'mates-total', screen: 'my-mates', targets: ['[data-tour="my-mates-total"]'], at: CORNER, action: 'hover', labelSide: 'left', say: '함께한 시간이랑 연결 횟수는 여기.' },
  { id: 'mates-affinity', screen: 'my-mates', targets: ['[data-tour="my-mates-affinity"]'], at: CORNER, action: 'hover', labelSide: 'left', feature: 'affinity', say: '같이 있을수록 친해지고, 단계가 오르면 새 표정이 열려.' },
  { id: 'mates-expressions', screen: 'my-mates', targets: ['[data-tour="my-mates-expressions"]'], at: CORNER, action: 'hover', labelSide: 'left', feature: 'expressions', say: '열린 표정은 여기 모여. 누르면 내가 그 표정을 지어 줄게.' },
  { id: 'mates-recent', screen: 'my-mates', targets: ['[data-tour="my-mates-recent"]'], at: CORNER, action: 'hover', labelSide: 'left', say: '최근 캡슐을 누르면 그날의 기록 카드가 열려.' },
  { id: 'mates-meet', screen: 'my-mates', targets: ['[data-tour="my-mates-meet"]'], at: CORNER, action: 'hover', labelSide: 'left', say: '보고 싶으면 여기서 바로 만나러 와.' },
  // 내 기록
  { id: 'records-period', screen: 'records', targets: ['[data-tour="records-periods"]'], at: CORNER, action: 'hover', waitMs: 6000, say: '주, 월, 연으로 기간을 바꿔 볼 수 있어.' },
  { id: 'records-view', screen: 'records', targets: ['[data-tour="records-view"]'], at: CORNER, action: 'hover', labelSide: 'left', say: '보드는 2D나 2.5D로 볼 수 있어.' },
  { id: 'records-day', screen: 'records', targets: ['[data-tour="records-board"]'], at: { x: 0.5, y: 0.72 }, action: 'click', waitMs: 8000, say: '날짜를 누르면 그날 기록이 열려.' },
  { id: 'records-comment', screen: 'records', targets: ['[data-records-mate-comment]'], at: CORNER, action: 'hover', say: '기간마다 내가 한마디 남겨 둘게.' },
  { id: 'records-summary', screen: 'records', targets: ['[data-tour="records-summary"]'], at: CORNER, action: 'hover', labelSide: 'left', say: '함께한 시간, 만난 날, 연결 횟수는 여기서 한눈에 봐.' },
  // 계정 설정
  { id: 'account-profile', screen: 'account', targets: ['[data-tour="account-avatar"]'], at: EDGE, action: 'hover', waitMs: 6000, say: '아바타랑 닉네임, 나를 부를 호칭은 여기서 정해.' },
  { id: 'account-settings', screen: 'account', targets: ['[data-tour="account-settings"]'], at: CORNER, action: 'hover', waitMs: 6000, say: '카메라, 마이크, PIP 말풍선은 설정에서 바꿔.' },
  { id: 'account-security', screen: 'account', targets: ['[data-account-view="security"]'], at: CORNER, action: 'hover', say: '비밀번호랑 탈퇴는 보안 탭에 있어.' },
  // 마무리
  { id: 'outro', screen: 'outro', targets: [], action: 'say', say: '이제 만나러 가 볼까?' },
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
      return step.id === 'account-profile' ? '/?account=profile' : '/?account=settings'
  }
}

/** The steps this build shows: feature-flagged steps go when their flag is off (production). */
export function tourSteps(context: TourContext): TourStep[] {
  return TOUR_STEPS.filter((step) => !step.feature || context.features[step.feature])
}

export function tourHref(step: TourStep, context: TourContext): string {
  const path = stepPath(step, context)
  return `${path}${path.includes('?') ? '&' : '?'}tour=${step.id}`
}

/** Long enough to read the line (Korean, ~7 characters a second), never shorter than 2.6 s. */
export const readMs = (text: string) => Math.max(2600, Math.round(Array.from(text).length * 140))

/** Where 「건너뛰기」 returns to: the screen the tour was opened from (kept for this tab). */
export const TOUR_ORIGIN_KEY = 'capsule-tour-origin'
