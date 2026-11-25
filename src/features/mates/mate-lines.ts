import type { MateReactionState } from '../auth/login-backgrounds/desktop/desktop-config.ts'

/**
 * Front-end lines a mate says on its own (preview bubbles, the home hero, the local mock's reactions). Each mate keeps
 * its own lines so one mate's voice never shows on another. 채린 also keeps the login screen's table
 * (`DEFAULT_REACTION_LINES`) for the login-only states. A state a mate has no line for shows no bubble.
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

/**
 * 채린 (persona 2026-11-25, short blunt 반말: 「~거든?」 「~잖아.」 「…뭐.」 「됐어.」 「착각하지 마.」 「책이나 봐!」).
 * greet · returnAfterLong · quiet · praised · question · farewell are the persona's own lines; the rest are drafts in
 * her voice awaiting the user's review (docs/MATE_MODEL_V2_CONTRACT.md).
 */
const CHAERIN_LINES: Readonly<Record<MateLineKey, string>> = {
  greet: '…왔냐. 늦었잖아. 빨리 앉기나 해.',
  returnAfterLong: '뭐야, 살아 있었네? …딱히 기다린 건 아니거든.',
  quiet: '…야, 졸아? 모르는 거 있으면 그냥 물어봐. 안 잡아먹어.',
  praised: '뭐래, 갑자기 왜 그래? …뭐 사줄 거 있으면 그냥 말해.',
  question: '…그거 나도 몰라. 같이 찾아보든가. 너 혼자 끙끙대는 거 보기 답답하니까.',
  farewell: '내일도 늦으면 딸기우유 쏘는 거다. …조심히 가.',
  away: '어디 가? …빨리 와. 심심해서 그러는 거 아니거든?',
  back: '왔네. 늦었잖아. …됐어, 책이나 봐!',
  breakStart: '쉬어? …뭐, 잠깐만이다. 오는 길에 딸기우유나 사 와.',
  breakEnd: '다 쉬었지? 이제 책이나 봐!',
  goalDone: '다 했네? …뭐, 오늘은 좀 봐줄게. 수고했어.',
  givingUp: '벌써 포기하게? 됐어, 조금만 더 해. 나도 할 거니까.',
  cheer: '너 할 수 있잖아. …착각하지 마, 응원하는 거 아니거든?',
}

export const MATE_LINES: Readonly<Record<string, Readonly<Record<MateLineKey, string>>>> = { chaerin: CHAERIN_LINES, dohyun: DOHYUN_LINES }

export function mateLine(mateId: string | undefined, key: MateLineKey): string | null {
  return (mateId && MATE_LINES[mateId]?.[key]) || null
}

/** Preview / home-hero reaction states → a mate's own lines (greet, the long-idle nudge). */
const STATE_LINES: Partial<Record<MateReactionState, MateLineKey>> = { greet: 'greet', idleLong: 'quiet' }

/**
 * The bubble line for a preview reaction: a mate's own line for greet and the long-idle nudge. Otherwise 채린 (and
 * unknown mates) use the shared table (`sharedLine`, the login screen's `getDefaultLineForState`, written for her);
 * other mates show no bubble rather than her lines.
 */
export function mateLineForState(mateId: string | undefined, state: MateReactionState, sharedLine: (state: MateReactionState) => string | null): string | null {
  const key = STATE_LINES[state]
  if (mateId && MATE_LINES[mateId] && key) return mateLine(mateId, key)
  if (!mateId || mateId === 'chaerin' || !MATE_LINES[mateId]) return sharedLine(state)
  return null
}
