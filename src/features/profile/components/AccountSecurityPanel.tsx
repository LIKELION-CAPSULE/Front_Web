import { useId } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { AccountWithdrawalContent } from '@/features/auth/components/AccountWithdrawalDialog'
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm'

/**
 * The security tab: password reset, then 회원탈퇴 with its confirmation already open (user decision 2026-11-25: no
 * folded summary to unfold). Nothing takes the focus when the tab opens — the confirmation field is never focused by
 * itself, so nothing is typed into it by accident. 「취소」 clears what was typed (there is nothing to fold).
 */
export function AccountSecurityPanel({
  busy,
  onBusyChange,
}: {
  busy: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const { me } = useBackend()
  const passwordId = useId()

  return (
    <>
      <fieldset disabled={busy} className="account-security-fields">
        <section className="account-security-row" aria-labelledby={`${passwordId}-heading`}>
          <h3 id={`${passwordId}-heading`} className="account-security-label">
            비밀번호 재설정
          </h3>
          <div className="account-security-content account-password-form">
            <PasswordRecoveryForm defaultEmail={me?.email ?? undefined} onBusyChange={onBusyChange} />
          </div>
        </section>

        <section className="account-security-row" aria-labelledby={`${passwordId}-withdrawal`}>
          <h3 id={`${passwordId}-withdrawal`} className="account-security-label">
            회원탈퇴
          </h3>
          <div className="account-security-content">
            <div className="account-settings-action-card" data-withdraw-panel>
              <AccountWithdrawalContent onBusyChange={onBusyChange} />
            </div>
          </div>
        </section>
      </fieldset>
    </>
  )
}
