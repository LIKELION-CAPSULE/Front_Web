import type { MateReactionState } from '../auth/login-backgrounds/desktop/desktop-config.ts'

/**
 * Front-end lines a mate says on its own (preview bubbles, the home hero, the local mock's reactions). Each mate keeps
 * its own lines so one mate's voice never shows on another. 채린's are the login screen's table
 * (`DEFAULT_REACTION_LINES`); other mates list theirs here. A state a mate has no line for shows no bubble.
 * Conversation lines come from the server persona; these are only the fixed ones.
 */
export type MateLineKey =
  | 'greet' // connection start
  | 'returnAfterLong' // back after a long time
  | 'quiet' // no talk for a while
  | 'praised'
  | 'question' // asked something they did not know
  | 'farewell'
  | 'away' // left the seat (camera)
  | 'back' // back to the seat
  | 'breakStart'
  | 'breakEnd'
  | 'goalDone'
  | 'givingUp'
  | 'cheer'

/** 서도현 (persona 2026-11-25). */
const DOHYUN_LINES: Readonly<Record<MateLineKey, string>> = {
  greet: '왔냐. 자리 맡아놨어. 가방 내려놓고 앉아.',
  returnAfterLong: '너 요즘 안 보이더라. …뭐, 바빴냐?',
  quiet: '왜 이렇게 조용해. 졸리면 잠깐 쉬든가.',
  praised: '뭘 새삼스럽게. 원래 이 정도는 했잖아.',
  question: '잠깐 봐봐. …아, 이거네. 여기부터 다시 해.',
  farewell: '벌써 가냐. …그래, 내일 보자. 조심히 가고.',
  away: '어디 가냐. 금방 올 거지?',
  back: '왔냐. 책 펴놨으니까 이어서 해.',
  breakStart: '이제 쉬냐. 고생했네. 뭐 마실래?',
  breakEnd: '다 쉬었으면 시작하자. 나도 이거 마저 풀게.',
  goalDone: '다 했네. 오늘 좀 열심히 했다? 수고했어.',
  givingUp: '하기 싫은 건 알겠는데, 조금만 더 하자. 나도 할게.',
  cheer: '야, 너무 조급해하지 마. 너 원래 끝까지 하면 해내잖아.',
}

export const MATE_LINES: Readonly<Record<string, Readonly<Record<MateLineKey, string>>>> = { dohyun: DOHYUN_LINES }

export function mateLine(mateId: string | undefined, key: MateLineKey): string | null {
  return (mateId && MATE_LINES[mateId]?.[key]) || null
}

/** Preview / home-hero reaction states → a mate's own lines (greet, the long-idle nudge). */
const STATE_LINES: Partial<Record<MateReactionState, MateLineKey>> = { greet: 'greet', idleLong: 'quiet' }

/**
 * The bubble line for a preview reaction: 채린 (and unknown mates) use the shared table (`sharedLine`, the login
 * screen's `getDefaultLineForState`), others their own lines.
 */
export function mateLineForState(mateId: string | undefined, state: MateReactionState, sharedLine: (state: MateReactionState) => string | null): string | null {
  if (!mateId || mateId === 'chaerin' || !MATE_LINES[mateId]) return sharedLine(state)
  const key = STATE_LINES[state]
  return key ? mateLine(mateId, key) : null
}
