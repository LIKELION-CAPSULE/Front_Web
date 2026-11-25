import { useId, useRef, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { ApiError } from '@/shared/api/client'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { FormField } from '@/shared/ui/FormField'
import { WITHDRAWAL_CONFIRMATION } from '../withdrawal-confirmation'

/**
 * 회원탈퇴 confirmation (the security tab's inline panel, AccountSecurityPanel): the exact phrase, then the withdrawal
 * (a connection still running is refused with a message; success signs out). The former modal wrapper
 * (`AccountWithdrawalDialog`) had no users and was removed.
 */
export function AccountWithdrawalContent({ onCancel, onBusyChange }: { onCancel?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const { withdrawAccount } = useBackend()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const warningId = useId()
  const pending = useRef(false)

  async function withdraw() {
    if (pending.current || confirmation !== WITHDRAWAL_CONFIRMATION) return
    pending.current = true
    setBusy(true); onBusyChange?.(true); setError('')
    try {
      await withdrawAccount()
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409
        ? '진행 중인 연결을 먼저 마친 뒤 탈퇴해 주세요.'
        : reason instanceof Error ? reason.message : '회원탈퇴를 처리하지 못했어요. 다시 시도해 주세요.')
    } finally { pending.current = false; setBusy(false); onBusyChange?.(false) }
  }

  return <form onSubmit={event => { event.preventDefault(); void withdraw() }}>
    <h4 className="type-card-title">정말 탈퇴하시겠어요?</h4>
    <p className="mt-3 text-body-compact text-muted">탈퇴하면 개인정보와 대화 기록, 친밀도가 삭제돼요. 남은 크레딧(초대분 포함)도 사라져요.</p>
    <p id={warningId} className="mt-2 text-body-compact text-danger">삭제된 정보는 되돌릴 수 없어요.</p>
    <FormField className="mt-5" label={`확인을 위해 “${WITHDRAWAL_CONFIRMATION}”를 입력해 주세요.`}>
      <input className="form-input" name="withdrawalConfirmation" data-withdraw-confirmation autoComplete="off" spellCheck={false} readOnly={busy} aria-describedby={warningId} placeholder={WITHDRAWAL_CONFIRMATION} value={confirmation} onChange={event => { setConfirmation(event.target.value); setError('') }} />
    </FormField>
    {error && <FeedbackMessage tone="error" className="mt-4">{error}</FeedbackMessage>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <Button variant="ghost" disabled={busy} onClick={() => { setConfirmation(''); setError(''); onCancel?.() }} data-dialog-initial-focus>취소</Button>
      <Button type="submit" variant="danger-solid" loading={busy} disabled={confirmation !== WITHDRAWAL_CONFIRMATION}>회원탈퇴</Button>
    </div>
  </form>
}
