import { useEffect, useRef, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { CreditsAppWindow } from '@/features/credits/components/CreditsAppWindow'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { number } from '@/shared/lib/format'
import {
  ReferralCodeField,
  type ReferralFieldValidationState,
} from '@/features/auth/components/ReferralCodeField'
import { clearStoredReferralCode, normalizeReferralCode } from '@/features/auth/referral-code'

function isReviewInviteLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'invite-loading'
  )
}

export default function InvitePage() {
  const { invitation, status, reload, redeemInvitation, accountDetails, validateReferralCode } = useBackend()
  const [code, setCode] = useState('')
  const [validation, setValidation] = useState<ReferralFieldValidationState>({ status: 'idle' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedKey, setCopiedKey] = useState<'code' | 'url' | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    void import('@/pages/CreditsPage')
    return () => clearTimeout(copyTimerRef.current)
  }, [])

  const loading = status === 'loading' || isReviewInviteLoading()
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  if (loading) {
    return (
      <CreditsAppWindow page="invite" loadingScreen="invite">
        <div className="credits-skeleton-stack" aria-busy="true">
          <span className="sr-only" role="status">
            초대 정보를 불러오고 있어요.
          </span>
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--mid" aria-hidden="true" />
          <div className="invite-grid" aria-hidden="true">
            <span className="skeleton-line credits-skeleton-card" />
            <span className="skeleton-line credits-skeleton-card" />
          </div>
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" aria-hidden="true" />
        </div>
      </CreditsAppWindow>
    )
  }

  if (!invitation) {
    return (
      <CreditsAppWindow page="invite">
        <div className="credits-state-box" role="alert">
          <p className="credits-state-title">초대 정보를 불러오지 못했어요.</p>
          <Button
            onClick={() => {
              void reload()
            }}
          >
            다시 시도
          </Button>
        </div>
      </CreditsAppWindow>
    )
  }

  const alreadyRegistered =
    Boolean(accountDetails?.referralRegistered) || invitation.canRedeem === false
  const filledCapsules = Math.max(0, Math.min(CREDIT_PRICING.inviteMaxCount, invitation.invitedCount))
  const inviteFull = invitation.invitedCount >= CREDIT_PRICING.inviteMaxCount

  async function handleCopy(kind: 'code' | 'url', value: string) {
    setError('')
    try {
      await navigator.clipboard.writeText(value)
      clearTimeout(copyTimerRef.current)
      setCopiedKey(kind)
      setCopyStatus(kind === 'code' ? '초대 코드를 복사했어요.' : '초대 링크를 복사했어요.')
      copyTimerRef.current = setTimeout(() => {
        setCopiedKey(null)
      }, 2000)
    } catch {
      setError('복사하지 못했어요. 다시 시도해 주세요.')
    }
  }

  /** 「초대 링크 공유」: the share sheet where the browser has one, otherwise the link is copied. */
  async function handleShare() {
    if (!invitation?.url) return
    if (!canNativeShare) {
      await handleCopy('url', invitation.url)
      return
    }
    setError('')
    try {
      await navigator.share({
        title: 'CAPSULE 초대',
        text: `초대 코드 ${invitation.code}로 함께해요.`,
        url: invitation.url,
      })
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') return
      setError('공유하지 못했어요. 링크를 복사해 보내 주세요.')
    }
  }

  async function validateCode(raw: string): Promise<boolean> {
    const norm = normalizeReferralCode(raw)
    if (!norm) {
      setValidation({ status: 'idle' })
      return false
    }
    if (!validateReferralCode) return true
    setValidation({ status: 'checking' })
    try {
      const res = await validateReferralCode(norm)
      if (res.valid) {
        setValidation({
          status: 'valid',
          ...(res.inviterNickname ? { inviterNickname: res.inviterNickname } : {}),
        })
        return true
      }
      setValidation({ status: 'invalid', message: res.message })
      return false
    } catch {
      setValidation({ status: 'invalid', message: '초대 코드를 확인하지 못했어요.' })
      return false
    }
  }

  async function redeem() {
    const norm = normalizeReferralCode(code)
    if (alreadyRegistered || !invitation?.canRedeem || !redeemInvitation || busy || !norm) return
    if (validateReferralCode) {
      const ok = await validateCode(norm)
      if (!ok) return
    }
    setBusy(true)
    setError('')
    try {
      await redeemInvitation(norm)
      clearStoredReferralCode()
      setCode('')
      setValidation({ status: 'idle' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CreditsAppWindow page="invite">
      <div className="invite-grid">
        {/* ② My code: copy it, or share the invite link */}
        <section className="invite-card" aria-labelledby="invite-mine-title">
          <h2 id="invite-mine-title">
            친구를 초대하면 둘 다 크레딧 {number(CREDIT_PRICING.inviteReward)}을 받아요
          </h2>
          <p className="invite-card-sub">친구가 첫 연결을 마치면 들어와요. 초대 크레딧은 사라지지 않아요.</p>
          {invitation.code ? (
            <>
              <div className="invite-code-row">
                <span className="invite-code-box" aria-label={`내 초대 코드 ${invitation.code}`}>{invitation.code}</span>
                <Button
                  variant="primary"
                  onClick={() => {
                    void handleCopy('code', invitation.code)
                  }}
                >
                  {copiedKey === 'code' ? '복사했어요' : '코드 복사'}
                </Button>
                {invitation.url && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void handleShare()
                    }}
                  >
                    {copiedKey === 'url' ? '링크를 복사했어요' : '초대 링크 공유'}
                  </Button>
                )}
              </div>
              <span role="status" className="sr-only">
                {copyStatus}
              </span>
            </>
          ) : (
            <p className="invite-code-pending">초대 코드를 준비하고 있어요.</p>
          )}
        </section>

        {/* ③ A code I received (for anyone who skipped it while signing up) */}
        <section className="invite-card" aria-labelledby="invite-received-title">
          <h2 id="invite-received-title">초대 코드를 받았나요?</h2>
          {alreadyRegistered ? (
            <p className="invite-registered-note">등록된 초대 코드가 있어요.</p>
          ) : (
            <form
              className="invite-redeem-form"
              onSubmit={(event) => {
                event.preventDefault()
                void redeem()
              }}
            >
              <div className="invite-redeem-row">
                <ReferralCodeField
                  label="받은 초대 코드"
                  showHelp={false}
                  value={code}
                  validation={validation}
                  disabled={!invitation.canRedeem || !redeemInvitation || busy}
                  onChange={(nextVal) => {
                    setCode(nextVal)
                    setValidation({ status: 'idle' })
                  }}
                  onBlurValidate={() => {
                    if (normalizeReferralCode(code)) void validateCode(code)
                  }}
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={!invitation.canRedeem || !redeemInvitation || !code.trim()}
                >
                  받기
                </Button>
              </div>
              <p className="invite-card-note">가입 후 7일 안에 1번만 입력할 수 있어요.</p>
            </form>
          )}
        </section>
      </div>

      {/* ④ Progress: n / 10 friends and the credits they brought */}
      <section className="invite-card invite-progress-card" aria-labelledby="invite-progress-title">
        <h2 id="invite-progress-title">
          초대 현황 · {number(invitation.invitedCount)} / {CREDIT_PRICING.inviteMaxCount}명 · 받은 크레딧{' '}
          {number(invitation.rewardedCredits)}
        </h2>
        <div
          className="invite-capsule-slots"
          role="img"
          aria-label={`초대한 친구 ${filledCapsules}명 / ${CREDIT_PRICING.inviteMaxCount}명`}
        >
          {Array.from({ length: CREDIT_PRICING.inviteMaxCount }, (_, index) => (
            <span
              key={index}
              className="invite-capsule-slot"
              data-filled={index < filledCapsules ? 'true' : 'false'}
              aria-hidden="true"
            />
          ))}
        </div>
        {inviteFull && (
          <p className="invite-progress-complete">
            초대 보상을 모두 받았어요. 친구 초대는 계속할 수 있어요.
          </p>
        )}
      </section>

      {error && (
        <FeedbackMessage tone="error" className="mt-5">
          {error}
        </FeedbackMessage>
      )}
    </CreditsAppWindow>
  )
}
