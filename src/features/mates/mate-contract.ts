import type { ModelInfo } from '../../shared/api/types.ts'
import { ApiError } from '../../shared/api/client.ts'

/** UI projections only. No new server endpoint or wire field is assumed here. */
export type MateDetailContent = {
  characterId: number
  introduction?: string
  description?: string
  role?: string
  intro?: string
  farewellLine?: string
  tags?: readonly string[]
  model?: ModelInfo
  voiceSampleUrl?: string
  conversationRevision?: string
}
export const resetScopes = ['messages', 'memory', 'intimacy', 'unlocks'] as const
export type MateResetReceipt = {
  characterId: number
  previousRevision: string
  revision: string
  cleared: readonly (typeof resetScopes[number])[]
}
export type MateContentPort = {
  load: (userId: number, characterId: number) => Promise<MateDetailContent>
  resetConversation?: (input: { userId: number; characterId: number; expectedRevision: string }) => Promise<MateResetReceipt>
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
  for (const key of ['introduction', 'description', 'role', 'intro', 'farewellLine', 'conversationRevision'] as const) {
    if (value[key] === undefined) continue
    if (typeof value[key] !== 'string' || key === 'conversationRevision' && !value[key].trim()) throw invalid()
    result[key] = value[key]
  }
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || !value.tags.every(tag => typeof tag === 'string')) throw invalid()
    result.tags = [...new Set(value.tags.map(tag => tag.trim()).filter(Boolean))]
  }
  if (value.model !== undefined) {
    if (!value.model || !assetUrl(value.model.modelJsonUrl)) throw invalid()
    const model: ModelInfo = { modelJsonUrl: value.model.modelJsonUrl }
    for (const key of ['scale', 'offsetX', 'offsetY'] as const) {
      const number = value.model[key]
      if (number === undefined) continue
      if (!Number.isFinite(number) || key === 'scale' && number <= 0) throw invalid()
      model[key] = number
    }
    result.model = model
  }
  if (value.voiceSampleUrl !== undefined) {
    if (!assetUrl(value.voiceSampleUrl, true)) throw invalid()
    result.voiceSampleUrl = value.voiceSampleUrl
  }
  return result
}
export const MATE_RESET_CONFLICT_MESSAGE =
  '다른 곳에서 대화가 바뀌었어요. 최신 상태로 다시 불러왔으니 한 번 더 확인해 주세요.'

const RESET_CONFLICT_CODES = new Set([
  'CONVERSATION_REVISION_CONFLICT',
  'MATE_REVISION_CONFLICT',
  'REVISION_CONFLICT',
])

export function isMateResetConflict(reason: unknown): boolean {
  if (!(reason instanceof ApiError)) return false
  if (reason.code) return RESET_CONFLICT_CODES.has(reason.code) || reason.status === 409
  return reason.status === 409
}

export function mateResetErrorMessage(reason: unknown): string {
  if (isMateResetConflict(reason)) return MATE_RESET_CONFLICT_MESSAGE
  return reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.'
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

export function checkMateReset(value: MateResetReceipt, characterId: number, revision: string) {
  if (!Number.isSafeInteger(characterId) || characterId <= 0 || typeof revision !== 'string' || !revision.trim() ||
    !value || value.characterId !== characterId || value.previousRevision !== revision || typeof value.revision !== 'string' ||
    !value.revision.trim() || value.revision === revision || !Array.isArray(value.cleared) ||
    resetScopes.some(scope => !value.cleared.includes(scope)) || value.cleared.some(scope => !resetScopes.includes(scope))) throw invalid()
}
