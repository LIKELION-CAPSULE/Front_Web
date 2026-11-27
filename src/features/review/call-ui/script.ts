/**
 * Sample conversation of the call-screen drafts (review catalog only, 2026-11-27). Written for the layout review:
 * short and long lines, consecutive messages from one side, a line long enough to need a second subtitle page.
 * Never imported by the product entry; not the mate's real dialogue.
 */

export type CallUiVariant = 'c1' | 'c2' | 'c3'
export type CallUiScene = 'idle' | 'speaking' | 'waiting' | 'unread'
export type CallUiSender = 'user' | 'mate'
export type CallUiMessage = { id: string; sender: CallUiSender; text: string; at: number; live?: boolean }

export const CALL_UI_MATE = '채린'
export const CALL_UI_USER = '나'

export const CALL_UI_VARIANT_NAME: Record<CallUiVariant, string> = { c1: 'C1 · 대사창', c2: 'C2 · 말풍선 무대', c3: 'C3 · 분할 정돈' }

export const CALL_UI_SCENES: readonly { id: CallUiScene; label: string }[] = [
  { id: 'idle', label: '기본' },
  { id: 'speaking', label: '말하는 중' },
  { id: 'waiting', label: '답장 대기' },
  { id: 'unread', label: '새 메시지 알림' },
]

/** 2026-11-27 21:40 KST: the history's clock (fixed, so the drafts look the same every time). */
const BASE = Date.UTC(2026, 10, 27, 12, 40, 0)
const minute = 60_000

const HISTORY: readonly [CallUiSender, string, number][] = [
  ['mate', '왔어? 오늘은 늦었네.', 0],
  ['mate', '…기다린 건 아니고, 그냥 시계를 봤을 뿐이야.', 0],
  ['user', '미안 미안, 학원이 늦게 끝났어', 1],
  ['user', '오늘은 수학 문제집 하려고', 1],
  ['mate', '수학? 어디까지 했는데.', 2],
  ['user', '28쪽까지', 3],
  ['mate', '그럼 오늘은 35쪽까지. 모르는 거 있으면 말해. 들어는 줄게.', 3],
  ['user', '응 고마워', 4],
]

/** Older lines for the 「새 메시지」 scene: enough to scroll the log. */
const OLDER: readonly [CallUiSender, string, number][] = [
  ['user', '어제 영어 단어 시험 봤어', -30],
  ['mate', '결과는?', -30],
  ['user', '18개 맞았어 20개 중에', -29],
  ['mate', '흠. 나쁘지 않네. 틀린 두 개는 오늘 다시 외우고.', -29],
  ['user', '알았어', -28],
  ['mate', '대답만 잘하지.', -28],
  ['user', '진짜 할 거야', -27],
  ['mate', '그래, 지켜볼게.', -27],
]

const toMessages = (rows: readonly [CallUiSender, string, number][], prefix: string): CallUiMessage[] =>
  rows.map(([sender, text, offset], index) => ({ id: `${prefix}-${index}`, sender, text, at: BASE + offset * minute }))

export function callUiHistory(scene: CallUiScene): CallUiMessage[] {
  const base = toMessages(HISTORY, 'h')
  if (scene === 'unread') return [...toMessages(OLDER, 'o'), ...base]
  if (scene === 'waiting') return [...base, { id: 'w-user', sender: 'user', text: '30쪽까지 풀었다! 생각보다 빨리 했어', at: BASE + 6 * minute }]
  return base
}

/** The line the 「말하는 중」 scene plays: long enough for a second subtitle page. */
export const LONG_LINE = '30쪽? 생각보다 빠르네. …칭찬하는 거 아니야. 그 속도면 오늘 35쪽까지 충분하다는 거지. 대신 틀린 문제는 꼭 다시 풀어 보고 넘어가. 그리고 30분 지나면 한 번 쉬어. 쉬는 것도 공부니까. 알았지?'
/** The reply that arrives while the log is scrolled up (「새 메시지 알림」). */
export const UNREAD_LINE = '야, 위에서 뭐 해? 지난 얘기 그만 보고 문제 풀어.'
/** Replies to what the user sends in the drafts, in turn. */
export const REPLIES: readonly string[] = [
  '응, 들었어. 그럼 다음 문제로 넘어가자.',
  '잠깐이면 기다려 줄게. 오래는 안 돼.',
  '나? 너 공부하는 거 보고 있었지. …다른 뜻은 없어.',
  '좋아. 그 기세로 조금만 더 해 보자.',
]

/** Quick replies under the input. */
export const QUICK_REPLIES: readonly string[] = ['응', '잠깐만', '오늘 뭐 했어?']
/** What the draft's 「누르고 말하기」 pretends to have heard. */
export const SPOKEN_SAMPLE = '이제 31쪽 풀게'

/** Splits a line into subtitle pages of about `max` letters at sentence ends, then at spaces. */
export function subtitlePages(text: string, max: number): string[] {
  const sentences = text.match(/[.!?…]*[^.!?…]+[.!?…]*\s*/g)?.map(part => part.trim()).filter(Boolean) ?? [text]
  const pages: string[] = []
  let current = ''
  const push = (part: string) => {
    if (!current) current = part
    else if (Array.from(current).length + 1 + Array.from(part).length <= max) current = `${current} ${part}`
    else { pages.push(current); current = part }
  }
  for (const sentence of sentences) {
    if (Array.from(sentence).length <= max) { push(sentence); continue }
    for (const word of sentence.split(' ')) push(word)
  }
  if (current) pages.push(current)
  return pages
}

/** The chat's letter pace (TypingMessage): ms per letter for the whole line. Subtitles type at the same speed. */
export const letterPace = (text: string) => Math.max(15, Math.min(32, 2500 / Array.from(text).length))

const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' })
export const messageTime = (at: number) => timeFormat.format(at)
