import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
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

function useGoalNotice(setItems: Dispatch<SetStateAction<NotificationItem[]>>, key: string, reached: boolean, enabled: boolean) {
  const shown = useRef(new Set<string>())
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!enabled || !reached) {
        setItems(current => current.some(item => item.id === 'study-goal') ? current.filter(item => item.id !== 'study-goal') : current)
        return
      }
      if (shown.current.has(key)) return
      const storageKey = `capsule-goal-notice:${key}`
      let alreadyShown = false
      try { alreadyShown = sessionStorage.getItem(storageKey) === '1' } catch { /* The in-memory guard also works without storage. */ }
      shown.current.add(key)
      if (alreadyShown) return
      try { sessionStorage.setItem(storageKey, '1') } catch { /* Keep the session running when storage is unavailable. */ }
      setItems(current => enqueueNotification(current.filter(item => item.id !== 'study-goal'), {
        id: 'study-goal', title: '목표 시간이 다 됐어요', tone: 'success',
        text: '조금 더 이어갈까요? 쉬거나 마치려면 아래 독에서 선택해 주세요.',
      }))
    })
    return () => cancelAnimationFrame(frame)
  }, [setItems, key, reached, enabled])
}

export function StudyNotifications({ goalNoticeKey, goalReached, studying, presenceUnknown, cameraError, microphoneError, syncError, sessionError, onRetrySync }: {
  goalNoticeKey: string
  goalReached: boolean
  studying: boolean
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
  useGoalNotice(setItems, goalNoticeKey, goalReached, studying)

  return <NotificationStack items={items} placement="container" onDismiss={id => setItems(current => current.filter(item => item.id !== id))} />
}
