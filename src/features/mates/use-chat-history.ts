import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { getChatRoom } from '@/features/backend/server-api'
import type { Message } from '@/features/demo/types'
import { api } from '@/shared/api/client'
import { chatRoomGeneration, chatRoomSnapshot, loadLatestChat, loadOlderChat, mergeChatHistory, subscribeChatRooms } from './chat-room'

/**
 * The call screen's chat with the server's history (32, chat-room.ts). The latest page is read when the panel opens
 * (again), when the connection changes or ends, and on 「다시 시도」 — unless 31 says there is no conversation yet
 * (`hasConversation: false`). What is loaded stays on screen while a read is on its way. Older pages come when the
 * list is scrolled to its top (`loadOlder`).
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
  // Opening, a new or ended connection, another mate or account (and a room forgotten by 47): the latest page again.
  // (The store notifies on a forget, so this render sees the new generation.)
  const generation = chatRoomGeneration(userId, characterId)
  useEffect(() => {
    if (!wanted) return
    void loadLatestChat(userId!, characterId!, read)
  }, [wanted, activeConnectionId, userId, characterId, read, generation])
  const loadOlder = useCallback(async () => {
    if (userId === undefined || !characterId || room.failed === 'older') return false
    return loadOlderChat(userId, characterId, read)
  }, [userId, characterId, room.failed, read])
  const retry = useCallback(() => {
    if (userId === undefined || !characterId) return
    if (room.failed === 'older') void loadOlderChat(userId, characterId, read)
    else void loadLatestChat(userId, characterId, read)
  }, [userId, characterId, room.failed, read])
  const messages = useMemo(
    () => mergeChatHistory(room.messages, local, activeConnectionId, room.loaded, room.readAt),
    [room.messages, local, activeConnectionId, room.loaded, room.readAt],
  )
  /** Lines from this browser (they may still type in); the rest came from the history and show at once. */
  const localIds = useMemo(() => new Set(local.map(message => message.id)), [local])
  return { messages, room, loadOlder, retry, localIds }
}
