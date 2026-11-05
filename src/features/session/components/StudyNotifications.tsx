import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import { enqueueNotification, type NotificationItem } from '@/shared/ui/notification-queue'

function useStudyNotice(
  setItems: Dispatch<SetStateAction<NotificationItem[]>>,
  id: string,
  title: string,
  tone: NotificationItem['tone'],
  text: string,
  retry?: () => Promise<void>,
) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => setItems(current => {
      const remaining = current.filter(item => item.id !== id)
      if (!text) return remaining.length === current.length ? current : remaining
      return enqueueNotification(remaining, {
        id, title, tone, text,
        action: retry ? { label: '연결 다시 확인', onClick: () => { void retry() } } : undefined,
      })
    }))
    return () => cancelAnimationFrame(frame)
  }, [setItems, id, title, tone, text, retry])
}

export function StudyNotifications({ presenceUnknown, cameraError, microphoneError, syncError, sessionError, onRetrySync }: {
  presenceUnknown: boolean
  cameraError: string
  microphoneError: string
  syncError: string
  sessionError: string
  onRetrySync: () => Promise<void>
}) {
  const [items, setItems] = useState<NotificationItem[]>([])
  useStudyNotice(setItems, 'study-presence', '자리 지킴 복구 불가', 'warning', presenceUnknown
    ? '이전 자리 지킴 시간을 불러오지 못했어요. 공부 결과를 저장하려면 처음 공부한 브라우저에서 이어가 주세요.' : '')
  useStudyNotice(setItems, 'study-camera', '카메라 연결 오류', 'error', cameraError)
  useStudyNotice(setItems, 'study-microphone', '마이크 연결 오류', 'error', microphoneError)
  useStudyNotice(setItems, 'study-sync', '공부 기록 연결 오류', 'error', syncError, onRetrySync)
  useStudyNotice(setItems, 'study-session', '공부 처리 오류', 'error', sessionError)

  return <NotificationStack items={items} onDismiss={id => setItems(current => current.filter(item => item.id !== id))} />
}
