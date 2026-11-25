import type { StudyRecord } from '../../demo/types.ts'
import type { CapsuleRecord } from './capsule-jar-types.ts'
import { isCompletedRecord } from '../../records/connection-day.ts'

const finitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * Maps the app's connection records to capsules, oldest first. Only connections that have ended by `now` count
 * (records/connection-day.ts, the same cutoff as the records page).
 *
 * Source: connection records (`useDemo().state.records`; the capsule preview and the tests). 내 메이트 itself reads 37
 * (use-my-mates.ts `capsulesFromConnections`).
 * Only server-reported records count as connections. `durationSeconds` is the connection time (`studySeconds`)
 * because camera-measured together time is 0 for connections made without a camera, which would leave most capsules
 * at the minimum size. The line is the server's `closingLine`; it stays empty when the server sent none.
 */
export function capsuleRecordsFromStudyRecords(
  records: readonly StudyRecord[],
  characterId: string,
  now = Date.now(),
): CapsuleRecord[] {
  const result: CapsuleRecord[] = []
  for (const record of records) {
    if (!record.characterIds.includes(characterId) || !isCompletedRecord(record, now)) continue
    const capsule = capsuleFromStudyRecord(record)
    if (capsule) result.push(capsule)
  }
  return sortCapsules(result)
}

/**
 * One connection record as a capsule (also used by the records calendar for its record card). Null for records
 * without a server report or without any time. The date rule is the records page's: the start time.
 */
export function capsuleFromStudyRecord(record: StudyRecord): CapsuleRecord | null {
  if (!record.serverReport) return null
  const durationSeconds = finitePositive(record.studySeconds)
    ? record.studySeconds
    : finitePositive(record.serverReport.connectedSeconds)
      ? record.serverReport.connectedSeconds
      : 0
  const endedAt = finitePositive(record.endedAt) ? record.endedAt : undefined
  const startedAt = finitePositive(record.startedAt)
    ? record.startedAt
    : endedAt !== undefined
      ? endedAt - durationSeconds * 1000
      : null
  if (startedAt === null) return null
  const line = record.serverReport.closingLine?.trim()
  return {
    id: record.id,
    startedAt,
    ...(endedAt !== undefined ? { endedAt } : {}),
    durationSeconds,
    ...(line ? { line } : {}),
    connectionId: record.id,
  }
}

export function sortCapsules(capsules: readonly CapsuleRecord[]): CapsuleRecord[] {
  return capsules.slice().sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
}

export function capsuleEndedAt(capsule: CapsuleRecord) {
  return capsule.endedAt ?? capsule.startedAt + Math.max(0, capsule.durationSeconds) * 1000
}

export function totalCapsuleSeconds(capsules: readonly CapsuleRecord[]) {
  return capsules.reduce((sum, capsule) => sum + Math.max(0, capsule.durationSeconds), 0)
}

/** Small deterministic PRNG so layouts and dummy data are identical on every render and in tests. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashId(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatTogether(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  if (minutes < 60) return `${minutes}분`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`
}

const seoulParts = (timestamp: number) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(timestamp)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { year: get('year'), month: get('month'), day: get('day'), hour: Number(get('hour')), minute: get('minute'), weekday: get('weekday') }
}

const WEEKDAYS: Record<string, string> = { Sun: '일', Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토' }

/** `2026.11.22 (일)` in Asia/Seoul. */
export function formatCapsuleDate(timestamp: number) {
  const { year, month, day, weekday } = seoulParts(timestamp)
  return `${year}.${month}.${day} (${WEEKDAYS[weekday] ?? weekday})`
}

/** `11.22` in Asia/Seoul. */
export function formatCapsuleShortDate(timestamp: number) {
  const { month, day } = seoulParts(timestamp)
  return `${month}.${day}`
}

export function partOfDay(hour: number) {
  if (hour < 5) return '새벽'
  if (hour < 11) return '아침'
  if (hour < 17) return '낮'
  if (hour < 21) return '저녁'
  return '밤'
}

const clockLabel = (timestamp: number) => {
  const { hour, minute } = seoulParts(timestamp)
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 === 0 ? 12 : hour % 12}:${minute}`
}

/** `저녁 · 오후 7:10 – 오후 8:40` in Asia/Seoul. */
/** `오후 7:40 – 오후 8:35` (the time range alone, no time band word). */
export function formatCapsuleClockRange(capsule: CapsuleRecord) {
  return `${clockLabel(capsule.startedAt)} – ${clockLabel(capsuleEndedAt(capsule))}`
}

export function formatCapsuleTimeRange(capsule: CapsuleRecord) {
  const start = capsule.startedAt
  return `${partOfDay(seoulParts(start).hour)} · ${clockLabel(start)} – ${clockLabel(capsuleEndedAt(capsule))}`
}

/** Alternative text for the scene, e.g. `채린과 연결 5번, 캡슐 32개, 함께한 시간 5시간 20분`. */
export function capsuleJarSummary(mateName: string, capsules: readonly CapsuleRecord[], capsuleCount = capsules.length) {
  const withMate = `${mateName}${withParticle(mateName)}`
  if (capsules.length === 0) return `${withMate}의 캡슐 보관함, 아직 캡슐이 없어요`
  return `${withMate} 연결 ${capsules.length}번, 캡슐 ${capsuleCount}개, 함께한 시간 ${formatTogether(totalCapsuleSeconds(capsules))}`
}

/** 과 after a final consonant (채린과), 와 otherwise. */
export function withParticle(name: string) {
  const code = name.charCodeAt(name.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '와'
  return (code - 0xac00) % 28 === 0 ? '와' : '과'
}

/** Groups capsules by Seoul calendar day, newest day first, for the 「목록으로 보기」 list. */
export function groupCapsulesByDay(capsules: readonly CapsuleRecord[]) {
  const groups: { day: string; capsules: CapsuleRecord[] }[] = []
  for (const capsule of sortCapsules(capsules).reverse()) {
    const day = formatCapsuleDate(capsule.startedAt)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.capsules.push(capsule)
    else groups.push({ day, capsules: [capsule] })
  }
  return groups
}
