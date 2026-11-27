import { withParticle } from '../../shared/lib/korean.ts'
import { launchMateId, type AvailableMate } from './catalog.ts'

/**
 * The launch mate a server mate is shown as (catalog.ts `launchMateId`: the /home card with that id, else the launch
 * profile its server name maps to). The server may list one persona twice (서진 id 2 and 3): /home's card stands for one
 * of them, and a connection with the other one is still that mate's. A non-launch server mate (「말포이」): undefined.
 */
export function frontMateOf(characterId: string | undefined, serverName: string | undefined, mates: readonly AvailableMate[]): AvailableMate | undefined {
  const id = launchMateId({ id: characterId, name: serverName }, mates)
  return id ? mates.find(value => value.id === id) : undefined
}

/**
 * Which mate a connection really is with. A start refused as already in progress continues that connection (409
 * `detail.connectionId`), which may be with another mate (another tab or device): it stays that mate's, never relabelled
 * as the one asked for, and the call screen says why (`notice`). `frontId` is the launch mate the connection was already
 * matched to (by id or by server name, DemoProvider `installSession`).
 *
 * `mate` is undefined when the connection's mate is none of the launch mates: callers must not fall back to the mate
 * asked for (use-connect-mate.ts).
 */
export function connectedMate(requested: AvailableMate, characterId: string | undefined, mates: readonly AvailableMate[], frontId?: string): { mate: AvailableMate | undefined; notice: string | null } {
  const mate = (frontId ? mates.find(value => value.id === frontId) : undefined) ?? mates.find(value => value.characterId === characterId)
  if (mate?.id === requested.id) return { mate: requested, notice: null }
  return {
    mate,
    notice: mate
      ? `다른 곳에서 ${withParticle(mate.name, '과', '와')} 연결 중이었어요. 그 연결을 이어서 할게요.`
      : '다른 곳에서 다른 메이트와 연결 중이었어요. 그 연결을 이어서 할게요.',
  }
}

/**
 * The call screen's mate for a connection: the launch mate, with the connection's own server mate id when it is the
 * other entry under the same name, so messages are sent to and read from the mate the connection is with.
 */
export function withConnectionCharacter(mate: AvailableMate | undefined, connection: { characterIds: readonly string[]; roomId?: string } | null | undefined): AvailableMate | undefined {
  const characterId = connection?.characterIds[0]
  if (!mate || !characterId || characterId === mate.characterId) return mate
  return { ...mate, characterId, roomId: connection.roomId ?? characterId }
}
