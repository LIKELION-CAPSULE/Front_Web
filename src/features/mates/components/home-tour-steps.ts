/**
 * Steps of the home 「사용법 보기」 coach mark (MateTutorial.tsx): what 채린's cursor points at and says. Targets are the
 * `data-tour` attributes on the real home screen and header. Dependency-free so Node tests can check the script.
 */
export type Target = () => Element | null
/**
 * Where on the target the arrow tip lands, as fractions of its box. Always an edge or a lower corner, never the middle,
 * so the arrow (it points up-left and its body hangs down-right) never covers the target's own words.
 */
export type TourPoint = { x: number; y: number }
export type TourStep = { id: string; target: Target | null; at?: TourPoint; action: 'hover' | 'click' | 'say'; say: string; labelSide?: 'left'; scroll?: 'top' | 'center' }

/** Lower-right corner just inside the box: for buttons, chips and menu items. */
const LOWER_CORNER: TourPoint = { x: 0.9, y: 0.94 }

/** Builds the steps for what the home screen shows now (one or two mates, with or without a reconnect button). */
export function buildTourSteps(query: (selector: string) => Element | null = (selector) => document.querySelector(selector)): TourStep[] {
  const first = (selector: string): Target => () => query(selector)
  const hasConnect = Boolean(query('[data-tour="connect"] button, [data-tour="connect"] a'))
  const steps: TourStep[] = [
    { id: 'mate-card', target: first('[data-tour="mate-card"]'), at: { x: 0.96, y: 0.42 }, action: 'hover', scroll: 'center', say: '같이 있을 메이트는 여기서 골라. 카드를 누르면 먼저 만나 볼 수 있어.' },
    hasConnect
      ? { id: 'connect', target: first('[data-tour="connect"] button, [data-tour="connect"] a'), at: LOWER_CORNER, action: 'click', scroll: 'center', say: '연결하기를 누르면 나랑 영상통화처럼 같이 있는 거야. 음성이랑 PIP도 돼.' }
      : { id: 'connect', target: first('[data-tour="mate-card-status"]'), at: LOWER_CORNER, action: 'click', scroll: 'center', say: '카드를 누르면 상세에서 연결할 수 있어. 연결하면 영상통화처럼 같이 있는 거야. 음성이랑 PIP도 돼.' },
    { id: 'nav-my-mates', target: first('[data-tour="nav-my-mates"]'), at: LOWER_CORNER, action: 'hover', scroll: 'top', say: '같이 보낸 시간은 여기 캡슐로 차곡차곡 쌓여.' },
    { id: 'nav-records', target: first('[data-tour="nav-records"]'), at: LOWER_CORNER, action: 'hover', scroll: 'top', say: '언제 얼마나 함께했는지는 여기서 볼 수 있어.' },
    { id: 'credits', target: first('[data-tour="credits"]'), at: LOWER_CORNER, action: 'hover', scroll: 'top', labelSide: 'left', say: '크레딧은 매일 채워지고, 친구를 초대하면 더 받아.' },
    { id: 'profile', target: first('[data-tour="profile"]'), at: LOWER_CORNER, action: 'hover', scroll: 'top', labelSide: 'left', say: '아바타랑 닉네임은 여기서 바꿀 수 있어.' },
    { id: 'outro', target: null, action: 'say', say: '이제 만나러 가 볼까?' },
  ]
  // A target the screen does not show (e.g. no credits yet) is skipped.
  return steps.filter((step) => !step.target || Boolean(step.target()))
}

/** Long enough to read the line (Korean, ~7 characters a second), never shorter than 2.6 s. */
export const readMs = (text: string) => Math.max(2600, Math.round(Array.from(text).length * 140))

