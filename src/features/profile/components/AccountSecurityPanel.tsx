import { useEffect, useId, useRef, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { AccountWithdrawalContent } from '@/features/auth/components/AccountWithdrawalDialog'
import { PasswordRecoveryForm } from '@/features/auth/components/PasswordRecoveryForm'
import { Button } from '@/shared/ui/Button'

export function AccountSecurityPanel({
  busy,
  onBusyChange,
}: {
  busy: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const { me } = useBackend()
  const passwordId = useId()
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const withdrawCardRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  // Folding the panel back (취소, Esc) returns the focus to 「회원탈퇴」.
  useEffect(() => {
    if (wasOpen.current && !withdrawOpen) triggerRef.current?.focus({ preventScroll: true })
    wasOpen.current = withdrawOpen
  }, [withdrawOpen])

  useEffect(() => {
    if (!withdrawOpen) return
    const card = withdrawCardRef.current
    if (!card) return
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = requestAnimationFrame(() => {
      card.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
      card
        .querySelector<HTMLInputElement>('input[name="withdrawalConfirmation"]')
        ?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [withdrawOpen])

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
            {withdrawOpen ? (
              <div
                ref={withdrawCardRef}
                className="account-settings-action-card"
                // Esc folds the panel (not the whole dialog); nothing closes while the withdrawal runs.
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return
                  event.preventDefault()
                  event.stopPropagation()
                  if (!busy) setWithdrawOpen(false)
                }}
              >
                <AccountWithdrawalContent
                  onCancel={() => setWithdrawOpen(false)}
                  onBusyChange={onBusyChange}
                />
              </div>
            ) : (
              <div className="account-withdraw-summary">
                <p className="text-body-compact text-muted">
                  탈퇴하면 대화 기록과 친밀도가 삭제되고 되돌릴 수 없어요.
                </p>
                <Button
                  ref={triggerRef}
                  variant="danger"
                  size="md"
                  className="mt-4 account-withdraw-trigger"
                  onClick={() => setWithdrawOpen(true)}
                  data-withdraw-trigger
                >
                  회원탈퇴
                </Button>
              </div>
            )}
          </div>
        </section>
      </fieldset>
    </>
  )
}
