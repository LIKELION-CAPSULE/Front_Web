import type { ReactNode } from 'react'

/** Every piece of connection-record copy in one place. */
export const CAPSULE_RECORD_COPY = {
  title: '오늘도 함께했어요',
  subtitle: '오늘의 만남이 새로운 추억이 되었어요.',
  levelUpTitle: '우리, 조금 더 가까워졌어요!',
  levelUpSubtitle: '함께한 시간이 쌓여, 새로운 단계에 도달했어요.',
  levelUpBadge: '친밀도 상승',
  levelUp: 'LEVEL UP!',
  summaryBefore: '함께 ',
  summaryAfter: ' 함께했어요.',
  completed: '완료',
  together: '함께한 시간',
  togetherRing: '함께한 시간(캠)',
  togetherOff: '이번엔 캠 없이 함께했어요',
  togetherNone: '캠에 함께 잡힌 시간이 없어요',
  connection: '연결 시간',
  dialogue: '나눈 대화',
  dialogueNone: '대화 없이 조용히 있었어요',
  dialogueUnknown: '대화 수를 받지 못했어요',
  dialogueUnit: '번',
  affinity: (name: string) => `${name} · 친밀도`,
  remembered: '기억한 것',
  unlockSub: '내 메이트에서 볼 수 있어요.',
  view: '세계관 보기',
  home: '홈으로',
} as const

export type CapsuleRecordStats = {
  /** Seconds the camera saw the user; null when the camera stayed off. */
  togetherSeconds: number | null
  connectionSeconds: number
  /** Absent when the server did not report it. */
  dialogueCount?: number
}

/**
 * The world the new stage opened (mate-worlds.ts): `line` is 「새 세계관이 열렸어요 · EP.03 도서관」 (the episode alone
 * before its content exists); `to` opens 내 메이트 at that mate.
 */
export type CapsuleRecordUnlock = {
  line: string
  to?: string
}

export type CapsuleRecordCardProps = {
  titleId: string
  mateName: string
  /** The mate art for the left column (the Live2D preview, with its own static fallback). */
  portrait: ReactNode
  /** The mate's closing line. */
  quote?: string
  /** "기본 모드" / "고급 모드". */
  modeLabel?: string
  endedAt: number
  stage: { previous?: string; current?: string }
  levelUp: boolean
  stats: CapsuleRecordStats
  nextStageCaption?: string
  /** Progress toward the next stage in [0, 1]. */
  stageProgress?: number
  /** What the mate remembered from this connection (P1; no API field yet). */
  remembered?: string
  unlock?: CapsuleRecordUnlock
  homeTo: string
  /** The reconnect control (keeps the existing connect flow, its loading and errors). */
  reconnect?: ReactNode
  /** Extra notice above the actions (e.g. credits ran out). */
  notice?: ReactNode
}

/** Seconds under a minute, minutes from there on: 42초, 25분, 132분. */
export function recordAmount(seconds: number): { value: string; unit: string } {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return { value: String(total), unit: '초' }
  return { value: Math.floor(total / 60).toLocaleString('ko-KR'), unit: '분' }
}

export function recordAmountText(seconds: number) {
  const { value, unit } = recordAmount(seconds)
  return `${value}${unit}`
}

export function recordModeLabel(mode: string | undefined) {
  if (mode === 'BASIC') return '기본 모드'
  if (mode === 'ADVANCED') return '고급 모드'
  return undefined
}

/** "2026. 11. 25" in Korea time. */
export function recordCardDate(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(timestamp)
    .replace(/\.$/, '')
}

/** "11. 25. 00:47" in Korea time. */
export function recordEndedLabel(timestamp: number) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(timestamp)
}
