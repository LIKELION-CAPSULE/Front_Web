import type { ChatRoomState } from '../chat-room'
import '../reply-actions.css'

export const CHAT_HISTORY_COPY = {
  loadingFirst: '지난 대화를 불러오고 있어요.',
  loadingOlder: '이전 대화를 불러오고 있어요.',
  failedLatest: '지난 대화를 불러오지 못했어요.',
  failedOlder: '이전 대화를 불러오지 못했어요.',
  retry: '다시 시도',
} as const

/**
 * The top line of the call screen's chat (32): the first read, an older page on its way (laid over the list, so the
 * lines do not move), or a failed read with 「다시 시도」.
 */
export function ChatHistoryStatus({ room, onRetry }: { room: ChatRoomState; onRetry: () => void }) {
  if (room.failed) {
    return (
      <p className="connection-history-status" role="alert">
        {room.failed === 'older' ? CHAT_HISTORY_COPY.failedOlder : CHAT_HISTORY_COPY.failedLatest}
        <button type="button" className="connection-history-retry" onClick={onRetry}>{CHAT_HISTORY_COPY.retry}</button>
      </p>
    )
  }
  if (room.loading.older) return <p className="connection-history-status connection-history-status--over" role="status">{CHAT_HISTORY_COPY.loadingOlder}</p>
  if (room.loading.latest && !room.loaded) return <p className="connection-history-status" role="status">{CHAT_HISTORY_COPY.loadingFirst}</p>
  return null
}
