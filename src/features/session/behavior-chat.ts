import {
  BEHAVIOR_GLOBAL_COOLDOWN_MS, BEHAVIOR_KIND_COOLDOWN_MS, BEHAVIOR_RECENT_LIMIT, BEHAVIOR_RECENT_MS, CHAT_TEXT_LIMIT,
} from '../media/behavior-constants.ts'
import { behaviorPriority, type BehaviorKind } from '../media/behavior-rules.ts'
import type { BehaviorChange } from '../media/behavior-monitor.ts'

/** A detection worth telling the friend about. Away is recorded on return, with how long it lasted. */
export type BehaviorMoment = { kind: BehaviorKind; at: number; awayMs?: number }
export type BehaviorChatState = {
  lastSentAt: number | null
  sentAt: Partial<Record<BehaviorKind, number>>
  recent: BehaviorMoment[]
}

export function createBehaviorChatState(): BehaviorChatState {
  return { lastSentAt: null, sentAt: {}, recent: [] }
}

/**
 * Decides whether a detection change makes the friend speak first.
 * Only starts count, never ongoing states; away is answered when the user comes back, not while they are gone.
 * A dropped request (busy, cooling down) does not start a cooldown, but the moment is still kept as context.
 */
export function reactToBehavior(state: BehaviorChatState, change: BehaviorChange, busy: boolean) {
  const moments: BehaviorMoment[] = [
    ...change.started.filter((kind) => kind !== 'away').map((kind) => ({ kind, at: change.at })),
    ...change.ended.filter((item) => item.kind === 'away')
      .map((item) => ({ kind: item.kind, at: change.at, awayMs: Math.max(0, change.at - item.since) })),
  ]
  if (!moments.length) return { state, prompt: null }
  const recent = [...state.recent, ...moments]
    .filter((moment) => change.at - moment.at <= BEHAVIOR_RECENT_MS)
    .slice(-BEHAVIOR_RECENT_LIMIT)
  const next = { ...state, recent }
  if (busy || (state.lastSentAt !== null && change.at - state.lastSentAt < BEHAVIOR_GLOBAL_COOLDOWN_MS))
    return { state: next, prompt: null }
  const prompt = moments
    .sort((a, b) => behaviorPriority.indexOf(a.kind) - behaviorPriority.indexOf(b.kind))
    .find((moment) => {
      const sent = state.sentAt[moment.kind]
      return sent === undefined || change.at - sent >= BEHAVIOR_KIND_COOLDOWN_MS
    }) ?? null
  if (!prompt) return { state: next, prompt }
  return {
    state: { ...next, lastSentAt: change.at, sentAt: { ...state.sentAt, [prompt.kind]: change.at } },
    prompt,
  }
}

function span(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000))
  return seconds < 60 ? `${seconds}초` : `${Math.round(seconds / 60)}분`
}

const situations: Record<BehaviorKind, { situation: (moment: BehaviorMoment) => string; direction: string; recap: (moment: BehaviorMoment) => string }> = {
  away: {
    situation: (moment) => `사용자가 ${span(moment.awayMs ?? 0)} 정도 자리를 비웠다가 방금 돌아왔다.`,
    direction: '돌아온 걸 반겨 주며 어디 갔다 왔는지 가볍게 묻는다.',
    recap: (moment) => `${span(moment.awayMs ?? 0)} 자리를 비웠다가 돌아옴`,
  },
  drowsy: {
    situation: () => '사용자가 눈을 감은 채 졸고 있는 것 같다.',
    direction: '졸고 있는 걸 알아채고 부드럽게 깨운다.',
    recap: () => '눈을 감고 졸았음',
  },
  yawn: {
    situation: () => '사용자가 방금 크게 하품했다.',
    direction: '졸리냐고 장난스럽게 묻고, 피곤함에 공감하며 같이 잠을 깨자고 한다.',
    recap: () => '하품함',
  },
  headTurn: {
    situation: () => '사용자가 고개를 돌려 한동안 다른 곳을 보고 있다.',
    direction: '어디 보는지 궁금해하며 자연스럽게 다시 집중하도록 이끈다.',
    recap: () => '고개를 돌려 다른 곳을 봄',
  },
  phone: {
    situation: () => '사용자가 핸드폰을 들고 보고 있다.',
    direction: '폰은 잠깐 내려놓자고 가볍게 말한다.',
    recap: () => '핸드폰을 봄',
  },
  wave: {
    situation: () => '사용자가 너를 보며 손을 흔들었다.',
    direction: '인사로 받아 주고, 같이 손 흔드는 느낌으로 반가워한다.',
    recap: () => '손을 흔들어 인사함',
  },
}

const tone = '너의 성격과 말투 그대로 1~2문장으로 말한다. 카메라·감지·알림 같은 말은 하지 않고, 죄책감을 주거나 비난하지 말고 장난스럽게 챙겨 준다.'

/** The request text for a friend speaking first: what happened and how to react, never a fixed line. */
export function behaviorPromptText(moment: BehaviorMoment) {
  const { situation, direction } = situations[moment.kind]
  return [
    '[상황 알림 · 사용자가 보낸 메시지가 아님]',
    `상황: ${situation(moment)}`,
    `반응 방향: ${direction}`,
    `이번에는 네가 먼저 사용자에게 말을 건다. ${tone}`,
  ].join('\n')
}

function ago(ms: number) {
  return ms < 10_000 ? '방금' : `${span(ms)} 전`
}

/** Prefixes recent detections to an ordinary chat message so the friend knows what just happened. */
export function withRecentBehavior(text: string, recent: readonly BehaviorMoment[], active: readonly BehaviorKind[], now: number) {
  const lines = recent
    .filter((moment) => now - moment.at <= BEHAVIOR_RECENT_MS)
    .map((moment) => `- ${ago(now - moment.at)}: ${situations[moment.kind].recap(moment)}`)
  const ongoing = active.filter((kind) => kind !== 'away').map((kind) => situations[kind].recap({ kind, at: now }))
  if (ongoing.length) lines.push(`- 지금도: ${ongoing.join(', ')}`)
  if (!lines.length) return text
  const withContext = [
    '[최근 상황 메모 · 사용자가 쓴 말이 아님. 대화에 필요할 때만 자연스럽게 반영하고 메모를 언급하지 않음]',
    ...lines,
    '[사용자 메시지]',
    text,
  ].join('\n')
  // The server cuts text at its limit; dropping the context keeps the user's own words whole.
  return withContext.length <= CHAT_TEXT_LIMIT ? withContext : text
}

/** When a reply finishes typing in the chat; mirrors the pace in TypingMessage. */
export function typingEndsAt(text: string, createdAt: number) {
  const letters = Array.from(text).length
  return createdAt + letters * Math.max(15, Math.min(32, 2500 / Math.max(1, letters)))
}
