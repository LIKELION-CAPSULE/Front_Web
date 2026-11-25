import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { getChatRoom } from '@/features/backend/server-api'
import type { Message } from '@/features/demo/types'
import { api } from '@/shared/api/client'
import { chatRoomSnapshot, loadChatRoom, mergeChatHistory, subscribeChatRooms } from './chat-room'

/**
 * The call screen's chat with the server's history (32, chat-room.ts). The first page is read when the panel opens,
 * unless 31 says there is no conversation yet (`hasConversation: false`); older pages when the list is scrolled to its
 * top (`loadOlder`).
 */
export function useChatHistory({ userId, characterId, open, hasConversation, local, activeConnectionId }: {
  userId: number | undefined
  characterId: string | undefined
  open: boolean
  hasConversation: boolean | undefined
  /** This browser's messages with the mate. */
  local: readonly Message[]
  activeConnectionId: string | null
}) {
  const room = useSyncExternalStore(subscribeChatRooms, () => chatRoomSnapshot(userId, characterId), () => chatRoomSnapshot(userId, characterId))
  const read = useCallback((cursor: string | null) => getChatRoom(api, Number(characterId), { cursor, size: 20 }), [characterId])
  const wanted = open && userId !== undefined && Boolean(characterId) && hasConversation !== false
  useEffect(() => {
    if (!wanted || room.status !== 'idle') return
    void loadChatRoom(userId!, characterId!, read)
  }, [wanted, room.status, userId, characterId, read])
  const loadOlder = useCallback(async () => {
    if (userId === undefined || !characterId || room.status !== 'ready' || !room.nextCursor) return false
    await loadChatRoom(userId, characterId, read)
    return true
  }, [userId, characterId, room.status, room.nextCursor, read])
  const messages = useMemo(
    () => mergeChatHistory(room.messages, local, activeConnectionId, room.status === 'ready'),
    [room.messages, local, activeConnectionId, room.status],
  )
  /** Lines from this browser (they may still type in); the rest came from the history and show at once. */
  const localIds = useMemo(() => new Set(local.map(message => message.id)), [local])
  return { messages, room, loadOlder, localIds }
}
