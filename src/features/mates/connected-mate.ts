import { withParticle } from '../../shared/lib/korean.ts'
import type { AvailableMate } from './catalog.ts'

/**
 * Which mate a connection really is with. A start refused as already in progress continues that connection (409
 * `detail.connectionId`), which may be with another mate (another tab or device): it stays that mate's, never relabelled
 * as the one asked for, and the call screen says why (`notice`).
 */
export function connectedMate(requested: AvailableMate, characterId: string | undefined, mates: readonly AvailableMate[]): { mate: AvailableMate | undefined; notice: string | null } {
  if (characterId === requested.characterId) return { mate: requested, notice: null }
  const mate = mates.find(value => value.characterId === characterId)
  return {
    mate,
    notice: mate
      ? `다른 곳에서 ${withParticle(mate.name, '과', '와')} 연결 중이었어요. 그 연결을 이어서 할게요.`
      : '다른 곳에서 다른 메이트와 연결 중이었어요. 그 연결을 이어서 할게요.',
  }
}
