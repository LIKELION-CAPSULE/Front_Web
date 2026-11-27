/**
 * The mobile access screen's 「PC에서 이렇게 시작해요」 steps (MobileNoticeScreen; user decision 2026-11-27). No imports,
 * so tests/mobile-gate.test.ts runs it as is. The third step's note about the invite code shows only on an invite visit.
 */

export type PcStartStep = { title: string; note: string | null }

export const PC_START_TITLE = 'PC에서 이렇게 시작해요'

export function pcStartSteps(invited: boolean): PcStartStep[] {
  return [
    { title: '링크를 PC로 보내요', note: "카톡 '나에게 보내기'나 메일" },
    { title: 'PC 브라우저에서 열어요', note: null },
    { title: '가입하고 메이트를 만나요', note: invited ? '초대 코드는 자동으로 들어가요' : null },
  ]
}
