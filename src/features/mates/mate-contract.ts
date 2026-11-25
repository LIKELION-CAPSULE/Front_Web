import type { ModelInfo } from '../../shared/api/types.ts'
import { ApiError } from '../../shared/api/client.ts'
import type { MateAgeRating } from './catalog.ts'

/**
 * Mate preview model. `ModelInfo` (Cubism: `modelJsonUrl` + layout) plus the v2 (Aliving2D) runtime URLs.
 * The wire contract for the v2 fields is a draft: docs/MATE_MODEL_V2_CONTRACT.md. Missing or malformed v2 fields
 * never fail the detail; the preview just falls back to the v2 still image.
 */
export type MateModelInfo = ModelInfo & {
  /** Optional format hint: 'aliving2d' | 'cubism'. Without it the format comes from the `modelJsonUrl` suffix. */
  format?: string
  /** Aliving2D engine script (`engine.js`). Must be same-origin or on the API origin (`isAllowedEngineUrl`). */
  engineUrl?: string
  /** Aliving2D player script (`player.js`); defaults to `player.js` next to `engineUrl`. */
  playerUrl?: string
  /** Optional reaction table (`reactions.default.json`). */
  reactionsUrl?: string
}

/** UI projections only. No new server endpoint or wire field is assumed here. */
export type MateDetailContent = {
  characterId: number
  introduction?: string
  description?: string
  role?: string
  intro?: string
  farewellLine?: string
  tags?: readonly string[]
  model?: MateModelInfo
  voiceSampleUrl?: string
  /** 31 `ageRating` (`ALL` · `ADULT`). */
  ageRating?: MateAgeRating
  /** 31 `comingSoon`: shown, but the connection is closed (16 answers 409 `MATE_COMING_SOON`); 46 '알림 받기' instead. */
  comingSoon?: boolean
  /** 31 `hasConversation`: earlier messages in the chat room (32). */
  hasConversation?: boolean
}
/**
 * 47 대화 초기화 (`POST /mates/{mateId}/conversation/reset`, 204, no body): hides the chat room (32), the past-connection
 * cards and the facts the mate remembered. Intimacy, unlocks, records and credits stay. The only conflict is 409
 * `CONNECTION_IN_PROGRESS` (connected with this mate now). docs/API_FRONT_GAP_2026-11-25.md §13.
 */
export const MATE_RESET_CLEARS = ['대화 기록', '대화 맥락(메이트가 기억한 내용)'] as const
export const MATE_RESET_KEEPS = ['친밀도와 열린 표정', '연결 기록', '크레딧'] as const
export type MateContentPort = {
  load: (userId: number, characterId: number) => Promise<MateDetailContent>
  resetConversation?: (input: { userId: number; characterId: number }) => Promise<void>
}

const invalid = () => new ApiError('요청을 처리하지 못했어요.', 502)
function assetUrl(value: unknown, audio = false): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  if (audio && /^data:audio\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value)) return true
  try { const url = new URL(value, 'https://capsule.invalid'); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password }
  catch { return false }
}
export function checkedMateDetail(value: MateDetailContent, characterId: number): MateDetailContent {
  if (!Number.isSafeInteger(characterId) || characterId <= 0 || !value || value.characterId !== characterId) throw invalid()
  const result: MateDetailContent = { characterId }
  for (const key of ['introduction', 'description', 'role', 'intro', 'farewellLine'] as const) {
    if (value[key] === undefined) continue
    if (typeof value[key] !== 'string') throw invalid()
    result[key] = value[key]
  }
  if (value.tags != null) { // An optional list: null is none.
    if (!Array.isArray(value.tags) || !value.tags.every(tag => typeof tag === 'string')) throw invalid()
    result.tags = [...new Set(value.tags.map(tag => tag.trim()).filter(Boolean))]
  }
  if (value.model !== undefined) {
    if (!value.model || !assetUrl(value.model.modelJsonUrl)) throw invalid()
    const model: MateModelInfo = { modelJsonUrl: value.model.modelJsonUrl }
    for (const key of ['scale', 'offsetX', 'offsetY'] as const) {
      const number = value.model[key]
      if (number === undefined) continue
      if (!Number.isFinite(number) || key === 'scale' && number <= 0) throw invalid()
      model[key] = number
    }
    // v2 runtime URLs are optional: keep only well-formed http(s) URLs (the origin allowlist runs at render time).
    for (const key of ['engineUrl', 'playerUrl', 'reactionsUrl'] as const) {
      const url = value.model[key]
      if (assetUrl(url)) model[key] = url.trim()
    }
    if (typeof value.model.format === 'string' && value.model.format.trim()) model.format = value.model.format.trim()
    result.model = model
  }
  if (value.voiceSampleUrl !== undefined) {
    if (!assetUrl(value.voiceSampleUrl, true)) throw invalid()
    result.voiceSampleUrl = value.voiceSampleUrl
  }
  if (value.ageRating === 'all' || value.ageRating === 'adult') result.ageRating = value.ageRating
  for (const key of ['comingSoon', 'hasConversation'] as const) {
    if (value[key] === undefined) continue
    if (typeof value[key] !== 'boolean') throw invalid()
    result[key] = value[key]
  }
  return result
}
export const MATE_RESET_IN_CONNECTION_MESSAGE = '지금 이 메이트와 연결 중이에요. 연결을 먼저 마쳐 주세요.'

/** 47's only conflict: 409 `CONNECTION_IN_PROGRESS` (this mate is connected now, here or on another device). */
export function isMateResetBlocked(reason: unknown): boolean {
  return reason instanceof ApiError && (reason.code === 'CONNECTION_IN_PROGRESS' || reason.status === 409)
}

export function mateResetErrorMessage(reason: unknown): string {
  if (isMateResetBlocked(reason)) return MATE_RESET_IN_CONNECTION_MESSAGE
  return reason instanceof Error && reason.message ? reason.message : '대화를 초기화하지 못했어요. 다시 시도해 주세요.'
}

export function selectLeaveQuote(
  detail?: Pick<MateDetailContent, 'farewellLine'>,
  mate?: { farewellLine?: string },
): string {
  const fromDetail = detail?.farewellLine?.trim()
  if (fromDetail) return fromDetail
  const fromMate = mate?.farewellLine?.trim()
  return fromMate || ''
}
