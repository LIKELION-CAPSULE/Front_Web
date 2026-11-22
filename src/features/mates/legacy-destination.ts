import type { ActiveSession, StudyRecord } from '../demo/types.ts'
import type { ActiveSessionSummary } from '../../shared/api/types.ts'
import { mateByName, type AvailableMate } from './catalog.ts'

const serverId = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0

/** Retired URLs never create a session, select a study goal, or open a payment/card surface. */
export function legacyBetaDestination(path: string, mates: readonly AvailableMate[], active: ActiveSession | null, summary: ActiveSessionSummary | null, records: readonly StudyRecord[]) {
  const parts = path.split('/').filter(Boolean)
  const id = parts[1] ?? ''
  if (parts[0] === 'rooms') {
    const mate = mates.find(value => value.roomId === id || value.id === 'chaerin' && id === 'dawn-library')
    return mate ? `/mates/${mate.id}` : '/'
  }
  if (parts[0] === 'characters') {
    const mate = mates.find(value => value.id === id || value.characterId === id)
    return mate ? `/mates/${mate.id}` : '/mates/me'
  }
  if (parts[0] === 'study') {
    if (!serverId(id)) return '/records'
    const mate = active?.serverSession && active.id === id
      ? mates.find(value => active.roomId === value.roomId && active.characterIds.length === 1 && active.characterIds[0] === value.characterId)
      : String(summary?.sessionId) === id ? mates.find(value => !!mateByName(summary?.characterName, [value]) && String(summary?.roomId) === value.roomId) : undefined
    if (mate) return `/connect/${mate.id}`
    return records.some(record => record.id === id && record.serverReport) || !summary ? `/connections/${id}` : '/'
  }
  if (parts[0] === 'reports' || parts[0] === 'capsules') return serverId(id) ? `/connections/${id}` : '/records'
  return '/'
}
