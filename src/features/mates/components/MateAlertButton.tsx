import { useRef, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { requestMateAlert } from '@/features/backend/server-api'
import { api, ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import type { AvailableMate } from '../catalog'

export const MATE_ALERT_COPY = {
  request: '공개 알림 받기',
  requested: '공개되면 알려 드릴게요',
  note: '아직 준비 중인 메이트예요. 공개되면 알림으로 알려 드려요.',
  alreadyOpen: '이제 만날 수 있어요. 잠시 뒤 다시 열어 주세요.',
  failed: '알림을 신청하지 못했어요. 다시 시도해 주세요.',
} as const

/** The server keeps the request (46 answers 204 again), but cannot tell it back: this browser remembers it per account. */
const storageKey = (userId: number | undefined, characterId: string) => `capsule-mate-alert:v1:${userId ?? 'guest'}:${characterId}`
function remembered(key: string) {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
function remember(key: string) {
  try { localStorage.setItem(key, '1') } catch { /* The button shows the request again after a reload. */ }
}

/**
 * 「공개 알림 받기」 for a coming-soon mate (31 · 11 `comingSoon`; 46 `POST /mates/{id}/alert`). Done: 「공개되면 알려
 * 드릴게요」, disabled. 409 `MATE_ALREADY_OPEN`: the mate opened meanwhile, so /home is read again (the page then shows the
 * connect button).
 */
export function MateAlertButton({ mate }: { mate: AvailableMate }) {
  const { refreshHome } = useBackend()
  const { state } = useDemo()
  const key = storageKey(state.profile.userId, mate.characterId)
  const [phase, setPhase] = useState<'idle' | 'busy' | 'done'>(() => (remembered(key) ? 'done' : 'idle'))
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const pending = useRef(false)

  async function request() {
    if (pending.current || phase === 'done') return
    pending.current = true
    setPhase('busy')
    setMessage(null)
    try {
      await requestMateAlert(api, Number(mate.characterId))
      remember(key)
      setPhase('done')
    } catch (reason) {
      setPhase('idle')
      if (reason instanceof ApiError && reason.code === 'MATE_ALREADY_OPEN') {
        setMessage({ tone: 'info', text: MATE_ALERT_COPY.alreadyOpen })
        void refreshHome().catch(() => {})
      } else {
        setMessage({ tone: 'error', text: reason instanceof Error && reason.message ? reason.message : MATE_ALERT_COPY.failed })
      }
    } finally {
      pending.current = false
    }
  }

  return (
    <div className="mate-connect-action mate-alert-action">
      <p className="mate-alert-note">{MATE_ALERT_COPY.note}</p>
      <Button onClick={() => void request()} loading={phase === 'busy'} disabled={phase === 'done'} data-mate-alert={phase}>
        <Icon name={phase === 'done' ? 'check' : 'clock'} size={18} />
        {phase === 'done' ? MATE_ALERT_COPY.requested : MATE_ALERT_COPY.request}
      </Button>
      {message && <FeedbackMessage tone={message.tone === 'error' ? 'error' : 'info'}>{message.text}</FeedbackMessage>}
    </div>
  )
}
