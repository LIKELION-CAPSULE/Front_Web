import type { DemoState, FocusTotals, Message, StudyRecord } from '../demo/types.ts'
import { report } from './adapters.ts'
import type { ReportResponse } from '../../shared/api/types.ts'

export const connectionCacheKey = (userId: number) => `capsule-beta-cache:v1:${userId}`
type Cache = Pick<DemoState, 'records' | 'messages' | 'latestRecordId'>
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const numeric = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const user = (value: number) => Number.isSafeInteger(value) && value > 0

function camera(value: unknown): FocusTotals | undefined {
  if (!object(value) || !finite(value.observedMs) || !finite(value.focusedMs) || value.focusedMs > value.observedMs || !finite(value.returns) || !Number.isInteger(value.returns)) return
  return { observedMs: value.observedMs, focusedMs: value.focusedMs, returns: value.returns }
}

/**
 * Cached reports must retain their real API identity. Demo metrics never become beta history.
 * Reports cached before 11-25 (`sessionId` · `character`) no longer match the record shape and are dropped.
 */
export function serverRecords(value: unknown): StudyRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!object(item) || item.dataSource === 'dummy' || !numeric(item.id) || !object(item.serverReport)) return []
    const dto = item.serverReport as ReportResponse
    if (String(dto.connectionId) !== item.id || !dto.mate || !numeric(String(dto.mate.id)) ||
      !Array.isArray(item.characterIds) || item.characterIds.length !== 1 || item.characterIds[0] !== String(dto.mate.id)) return []
    try {
      const result = report(dto)
      if (result.endedAt < result.startedAt) return []
      result.cameraFocus = camera(item.cameraFocus)
      return [result]
    } catch { return [] }
  })
}

export function serverMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!object(item) || !numeric(item.sessionId) || !numeric(item.characterId) || typeof item.id !== 'string' ||
      !item.id || typeof item.text !== 'string' || !['user', 'character'].includes(String(item.sender)) || item.delivery === 'pending') return []
    return [{ id: item.id, sessionId: item.sessionId, characterId: item.characterId, text: item.text,
      sender: item.sender as Message['sender'], voice: item.voice === true,
      ...(typeof item.requestId === 'string' ? { requestId: item.requestId } : {}),
      ...(finite(item.createdAt) ? { createdAt: item.createdAt } : {}),
      ...(item.delivery === 'confirmed' ? { delivery: 'confirmed' as const } : {}),
    }]
  })
}

function decode(raw: string | null): Cache {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (object(value)) {
      const records = serverRecords(value.records), messages = serverMessages(value.messages)
      return { records, messages, latestRecordId: records.some(record => record.id === value.latestRecordId) ? String(value.latestRecordId) : null }
    }
  } catch { /* Invalid or unavailable cache starts empty; it never seeds sample data. */ }
  return { records: [], messages: [], latestRecordId: null }
}

/** Migrate once. A later empty beta cache must not resurrect old history after a reset. */
export function readConnectionCache(storage: Pick<Storage, 'getItem'>, userId: number): Cache {
  if (!user(userId)) return { records: [], messages: [], latestRecordId: null }
  try {
    const raw = storage.getItem(connectionCacheKey(userId))
    if (raw !== null) {
      const value: unknown = JSON.parse(raw)
      if (object(value) && value.version === 1 && value.userId === userId) return decode(raw)
      return decode(null)
    }
    return decode(storage.getItem(`capsule-dummy:v1:${userId}`))
  } catch { return decode(null) }
}

export function writeConnectionCache(storage: Pick<Storage, 'setItem'>, userId: number, state: Pick<DemoState, 'records' | 'messages' | 'latestRecordId'>) {
  if (!user(userId)) return false
  const records = serverRecords(state.records), messages = serverMessages(state.messages)
  const latestRecordId = records.some(record => record.id === state.latestRecordId) ? state.latestRecordId : null
  try { storage.setItem(connectionCacheKey(userId), JSON.stringify({ version: 1, userId, records, messages, latestRecordId })); return true }
  catch { return false }
}
