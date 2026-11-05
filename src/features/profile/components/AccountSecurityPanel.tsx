import { useId } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { AccountWithdrawalContent } from '@/features/auth/components/AccountWithdrawalDialog'
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm'

export function AccountSecurityPanel({ busy, onBusyChange }: { busy: boolean; onBusyChange: (busy: boolean) => void }) {
  const { me } = useBackend()
  const passwordId = useId()
  return <>
    <h2 className="account-settings-title">보안</h2>
    <fieldset disabled={busy} className="account-security-fields">
      <section className="account-security-row" aria-labelledby={`${passwordId}-heading`}>
        <h3 id={`${passwordId}-heading`} className="account-security-label">비밀번호 재설정</h3>
        <div className="account-security-content account-password-form">
          <PasswordRecoveryForm defaultEmail={me?.email} onBusyChange={onBusyChange} />
        </div>
      </section>
      <section className="account-security-row" aria-labelledby={`${passwordId}-withdrawal`}>
        <h3 id={`${passwordId}-withdrawal`} className="account-security-label">회원탈퇴</h3>
        <div className="account-settings-action-card"><AccountWithdrawalContent onBusyChange={onBusyChange} /></div>
      </section>
    </fieldset>
  </>
}
