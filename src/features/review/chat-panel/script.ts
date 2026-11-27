/**
 * Sample conversation of the call-screen chat panel drafts P1 / P2 / P3 (review catalog only, 2026-11-27). Three
 * states for each draft: nothing said yet, a few lines, and a long log over two days (it scrolls). Written for the
 * layout review, not the mate's real dialogue; never imported by the product entry.
 */

export type ChatPanelVariant = 'p1' | 'p2' | 'p3'
export type ChatPanelState = 'empty' | 'few' | 'long'
export type DraftSender = 'user' | 'mate' | 'system'
/** `system`: a line from the app, not from her or me (P2 shows them: affinity went up, time studied together). */
export type DraftLine = {
  id: string
  sender: DraftSender
  text: string
  at: number
  system?: 'affinity' | 'time'
  /** Her reply that arrived in this preview (types in, as the call's chat). */
  live?: boolean
  /** Mine, read by her (P3 shows 「읽음」). */
  read?: boolean
}

export const DRAFT_MATE = '채린'
export const DRAFT_USER = '나'

export const CHAT_PANEL_VARIANT_NAME: Record<ChatPanelVariant, string> = {
  p1: 'P1 · 픽셀 대화 기록',
  p2: 'P2 · 무드 패널',
  p3: 'P3 · 메신저형 정돈',
}

export const CHAT_PANEL_STATES: readonly { id: ChatPanelState; label: string }[] = [
  { id: 'empty', label: '비어 있음' },
  { id: 'few', label: '대화 몇 개' },
  { id: 'long', label: '긴 대화' },
]

const minute = 60_000
/** 2026-11-27 23:39 KST: the log's 「now」 (fixed, so the drafts read the same every time). */
export const DRAFT_NOW = Date.UTC(2026, 10, 27, 14, 39)
const YESTERDAY = DRAFT_NOW - 24 * 60 * minute - 89 * minute // 2026-11-26 22:10 KST

type Row = readonly [DraftSender, string, number, DraftLine['system']?]

const TODAY: readonly Row[] = [
  ['mate', '왔어? 오늘은 늦었네.', 0],
  ['mate', '…기다린 건 아니고, 그냥 시계를 봤을 뿐이야.', 0],
  ['user', '미안 미안, 학원이 늦게 끝났어', 1],
  ['user', '오늘은 수학 문제집 하려고', 1],
  ['mate', '수학? 어디까지 했는데.', 2],
  ['user', '28쪽까지', 3],
  ['system', '친밀도가 올랐어요 · 3단계 친구', 3, 'affinity'],
  ['mate', '그럼 오늘은 35쪽까지. 모르는 거 있으면 말해. 들어는 줄게.', 4],
]

const TODAY_MORE: readonly Row[] = [
  ['user', '응 고마워', 5],
  ['user', '근데 29쪽 3번 이거 어떻게 풀어?', 9],
  ['mate', '보여 줘 봐. …아, 이건 공식부터 다시 써 봐.', 10],
  ['mate', '양변에 같은 걸 곱하는 거 잊지 말고.', 10],
  ['user', '아 됐다!', 12],
  ['mate', '거봐. 할 수 있잖아.', 12],
]

const YESTERDAY_ROWS: readonly Row[] = [
  ['mate', '오늘은 영어 단어 외운다고 했지?', 0],
  ['user', '응 20개', 1],
  ['mate', '20개면 30분이면 충분해. 시작해.', 1],
  ['user', '어제 영어 단어 시험 봤어', 6],
  ['mate', '결과는?', 6],
  ['user', '18개 맞았어 20개 중에', 7],
  ['mate', '흠. 나쁘지 않네.', 7],
  ['mate', '틀린 두 개는 오늘 다시 외우고.', 7],
  ['user', '알았어', 8],
  ['mate', '대답만 잘하지.', 8],
  ['system', '함께 공부한 지 30분 됐어요', 30, 'time'],
  ['user', '다 외웠다', 31],
  ['mate', '정말? 그럼 내일 아침에 한 번 더 보고 가.', 32],
  ['user', '오늘은 여기까지 할게', 40],
  ['mate', '그래, 수고했어. …내일도 와.', 40],
]

const toLines = (rows: readonly Row[], prefix: string, base: number): DraftLine[] => rows.map(([sender, text, offset, system], index) => ({
  id: `${prefix}-${index}`,
  sender,
  text,
  at: base + offset * minute,
  ...(system ? { system } : {}),
  ...(sender === 'user' ? { read: true } : {}),
}))

export function draftHistory(state: ChatPanelState): DraftLine[] {
  if (state === 'empty') return []
  const today = toLines(TODAY, 't', DRAFT_NOW)
  if (state === 'few') return today
  return [...toLines(YESTERDAY_ROWS, 'y', YESTERDAY), ...today, ...toLines(TODAY_MORE, 'm', DRAFT_NOW)]
}

/** Her greeting on the stage when nothing has been said yet (an event line: the log does not keep it). */
export const GREETING_LINE = '왔어? 오늘은 뭐부터 할 거야?'
/** Replies to what is sent in the drafts, in turn. */
export const DRAFT_REPLIES: readonly string[] = [
  '응, 들었어. 그럼 다음 문제로 넘어가자.',
  '잠깐이면 기다려 줄게. 오래는 안 돼.',
  '나? 너 공부하는 거 보고 있었지. …다른 뜻은 없어.',
  '좋아. 그 기세로 조금만 더 해 보자.',
]
/** Quick replies (P3 has more, in a row that scrolls sideways). */
export const DRAFT_QUICK: readonly string[] = ['응', '잠깐만', '오늘 뭐 했어?']
export const DRAFT_QUICK_MORE: readonly string[] = [...DRAFT_QUICK, '같이 공부하자', '이 문제 모르겠어', '조금 쉴래']
/** P2's empty state: ways to say the first word. */
export const DRAFT_STARTERS: readonly string[] = ['오늘 뭐 했어?', '같이 공부하자', '나 왔어!']
/** What the drafts' 누르고 말하기 pretends to have heard. */
export const DRAFT_SPOKEN = '이제 31쪽 풀게'

/* ── Blocks: day dividers, system lines, runs ─────────────────────────────────────────────────────────────── */

export type DraftBlock =
  | { kind: 'divider'; key: string; at: number }
  | { kind: 'system'; key: string; line: DraftLine }
  | { kind: 'group'; key: string; sender: 'user' | 'mate'; lines: DraftLine[] }

/** A new divider when the day changes or 30 minutes pass without a word. */
const SESSION_GAP = 30 * minute
/** Consecutive lines of one side within 3 minutes are one run (the call chat's rule, chat-groups.ts). */
const RUN_GAP = 3 * minute

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

/**
 * The log in blocks. `system` off (P1, P3): app lines are left out. A system line ends the run it falls in, and does
 * not by itself start a divider.
 */
export function chatBlocks(lines: readonly DraftLine[], { system }: { system: boolean }): DraftBlock[] {
  const blocks: DraftBlock[] = []
  let lastAt: number | null = null
  let run: Extract<DraftBlock, { kind: 'group' }> | null = null
  for (const line of lines) {
    if (line.sender === 'system' && !system) continue
    if (lastAt === null || line.at - lastAt >= SESSION_GAP || dayKey.format(line.at) !== dayKey.format(lastAt)) {
      blocks.push({ kind: 'divider', key: `d-${line.id}`, at: line.at })
      run = null
    }
    if (line.sender === 'system') {
      blocks.push({ kind: 'system', key: line.id, line })
      run = null
    } else {
      const previous = run?.lines.at(-1)
      if (run && previous && run.sender === line.sender && line.at - previous.at < RUN_GAP) run.lines.push(line)
      else {
        run = { kind: 'group', key: line.id, sender: line.sender, lines: [line] }
        blocks.push(run)
      }
    }
    lastAt = line.at
  }
  return blocks
}

const clockFormat = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Seoul' })
const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })

/** 「23:39」 */
export const clock = (at: number) => clockFormat.format(at)

/** The day word: 「오늘」, 「어제」, or 「11월 25일」 (against `now`). */
export function dayWord(at: number, now = DRAFT_NOW) {
  const day = dayKey.format(at)
  if (day === dayKey.format(now)) return '오늘'
  if (day === dayKey.format(now - 24 * 60 * minute)) return '어제'
  return dateFormat.format(at)
}

/** A divider's words: 「오늘 23:39」. */
export const dividerLabel = (at: number, now = DRAFT_NOW) => `${dayWord(at, now)} ${clock(at)}`

/** 「오후 11:39」: the run's time in P3 (a messenger's own clock words). */
const meridiemFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' })
export const runTime = (at: number) => meridiemFormat.format(at)
