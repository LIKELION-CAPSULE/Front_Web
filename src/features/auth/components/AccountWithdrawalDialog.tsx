import { useRef, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'

export function AccountWithdrawalDialog({ onClose }: { onClose: () => void }) {
  const { withdrawAccount } = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  async function withdraw() {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError('')
    try {
      await withdrawAccount()
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409
        ? '진행 중인 공부를 먼저 마친 뒤 탈퇴해 주세요.'
        : reason instanceof Error ? reason.message : '회원탈퇴를 처리하지 못했어요. 다시 시도해 주세요.')
    } finally { pending.current = false; setBusy(false) }
  }

  return <Dialog open title="정말 탈퇴하시겠어요?" onClose={onClose} dismissible={!busy} showCloseButton={!busy}>
    <p className="type-body text-muted">탈퇴하면 개인정보가 비워지고 저장한 일정과 대화 기억이 삭제돼요. 모든 기기에서 로그아웃되며, 삭제된 정보는 되돌릴 수 없어요.</p>
    {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <Button variant="secondary" disabled={busy} onClick={onClose} data-dialog-initial-focus>취소</Button>
      <Button variant="danger-solid" loading={busy} onClick={() => { void withdraw() }}>{busy ? '탈퇴하고 있어요…' : '회원탈퇴하기'}</Button>
    </div>
  </Dialog>
}
