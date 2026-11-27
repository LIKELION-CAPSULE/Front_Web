import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { enterReferral } from '@/features/backend/server-api'
import { CreditsAppWindow } from '@/features/credits/components/CreditsAppWindow'
import { CAPSULE_STAGGER_MS, InviteHeroArt } from '@/features/credits/components/InviteHeroArt'
import { CopyIcon, LinkIcon, UsersIcon } from '@/features/credits/components/InviteIcons'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'
import { referralRefusal, type ReferralFriendView } from '@/features/credits/credits-data'
import { useReferralStatus } from '@/features/credits/use-credits'
import capsuleFilled from '@/assets/capsule/capsule-filled.webp'
import capsuleEmpty from '@/assets/capsule/capsule-empty.webp'
import { api } from '@/shared/api/client'
import { deviceHash } from '@/shared/api/device-hash'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { dateLabel, number } from '@/shared/lib/format'
import {
  ReferralCodeField,
  type ReferralFieldValidationState,
} from '@/features/auth/components/ReferralCodeField'
import { clearStoredReferralCode, normalizeReferralCode, readStoredReferralCode } from '@/features/auth/referral-code'
import '@/features/credits/invite.css'

/** 35 `friends[].status` as the list says it. */
function friendStatus(friend: ReferralFriendView) {
  if (friend.status === 'qualified') return friend.rewarded ? '보상 받음' : '첫 연결 완료'
  return '첫 연결 전'
}

/** 35 `codeInputDeadline` as 「11. 30.까지」. */
const deadlineLabel = (at: number) => `${dateLabel(at)}까지`

/**
 * What the capsules show: how many are filled, the first one that should drop in (all of them on the first load, only
 * the new ones after that) and a count of friends who joined while the page was open, for the mascots' cheer.
 */
type CapsuleFill = { filled: number; enterFrom: number; ready: boolean; joined: number }

/**
 * 친구 초대 (SCR-31), from the server: my code, link, rewards and friends from 35 (the capsules fill with
 * `rewardedCount`), a received code checked with 39 and entered with 36 (its refusals on the field). A code from an
 * invite link (`/i/<code>`, `?ref=`) is put in the field and checked (39) when the code can still be entered.
 */
export default function InvitePage() {
  const referral = useReferralStatus()
  const { validateReferralCode } = useBackend()
  const invitation = referral.status === 'ready' ? referral.data : null
  const [code, setCode] = useState('')
  const [validation, setValidation] = useState<ReferralFieldValidationState>({ status: 'idle' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedKey, setCopiedKey] = useState<'code' | 'url' | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const [redeemed, setRedeemed] = useState(0)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const GOAL = invitation?.maxRewards ?? CREDIT_PRICING.inviteMaxCount

  // Follow the rewarded count as it changes (render-time update, so the new capsules animate on the same paint).
  const filled = invitation ? Math.max(0, Math.min(GOAL, invitation.rewardedCount)) : 0
  const [fill, setFill] = useState<CapsuleFill>({ filled: 0, enterFrom: 0, ready: false, joined: 0 })
  // A code from an invite link goes into the field once, while a received code can still be entered.
  if (invitation?.canEnterCode && linkCode === null) {
    const stored = readStoredReferralCode()
    setLinkCode(stored?.code ?? '')
    if (stored?.code && !code) setCode(stored.code)
  }
  if (invitation && (!fill.ready || fill.filled !== filled)) {
    setFill({
      filled,
      enterFrom: Math.min(fill.filled, filled),
      ready: true,
      joined: fill.ready && filled > fill.filled ? fill.joined + 1 : fill.joined,
    })
  }

  useEffect(() => {
    void import('@/pages/CreditsPage')
    return () => clearTimeout(copyTimerRef.current)
  }, [])

  // The link's code is checked (39) as soon as it is in the field.
  const linkChecked = useRef(false)
  useEffect(() => {
    if (!linkCode || linkChecked.current) return
    linkChecked.current = true
    void validateCode(linkCode)
    // validateCode reads only stable state setters and the context's checker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode])

  const loading = referral.status === 'loading'
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  if (loading) {
    return (
      <CreditsAppWindow page="invite" loadingScreen="invite" dashboard>
        <div className="credits-skeleton-stack" aria-busy="true">
          <span className="sr-only" role="status">
            초대 정보를 불러오고 있어요.
          </span>
          <span className="skeleton-line credits-skeleton-hero" aria-hidden="true" />
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" aria-hidden="true" />
          <div className="credits-skeleton-row" aria-hidden="true">
            <span className="skeleton-line credits-skeleton-card" />
            <span className="skeleton-line credits-skeleton-card" />
          </div>
        </div>
      </CreditsAppWindow>
    )
  }

  if (!invitation) {
    return (
      <CreditsAppWindow page="invite">
        <div className="credits-state-box" role="alert">
          <p className="credits-state-title">초대 정보를 불러오지 못했어요.</p>
          <Button onClick={referral.reload}>다시 시도</Button>
        </div>
      </CreditsAppWindow>
    )
  }

  // 35 `canEnterCode` false: entered already, or the 7 days after signup are over.
  const alreadyRegistered = !invitation.canEnterCode
  const remaining = Math.max(0, GOAL - invitation.rewardedCount)

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

  /** 「초대 링크 공유하기」: the share sheet where the browser has one, otherwise the link is copied. */
  async function handleShare() {
    if (!invitation?.link) return
    if (!canNativeShare) {
      await handleCopy('url', invitation.link)
      return
    }
    setError('')
    try {
      await navigator.share({
        title: 'CAPSULE 초대',
        text: `초대 코드 ${invitation.code}로 함께해요.`,
        url: invitation.link,
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

  /** 36. A refusal (REFERRAL_*) goes on the field; the form closes when the code can no longer be entered at all. */
  async function redeem() {
    const norm = normalizeReferralCode(code)
    if (alreadyRegistered || busy || !norm) return
    if (validateReferralCode) {
      const ok = await validateCode(norm)
      if (!ok) return
    }
    setBusy(true)
    setError('')
    try {
      await enterReferral(api, { code: norm, deviceHash: await deviceHash() })
      clearStoredReferralCode()
      setCode('')
      setValidation({ status: 'idle' })
      setRedeemed((value) => value + 1)
      referral.reload()
    } catch (reason) {
      const refusal = referralRefusal(reason)
      if (refusal) {
        setValidation({ status: 'invalid', message: refusal.message })
        if (refusal.closesForm) referral.reload()
      } else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CreditsAppWindow page="invite" dashboard>
      {/* ① The event: the pitch on the left, the capsule dome filling with friends on the right */}
      <section className="invite-hero" aria-labelledby="invite-hero-title">
        <div className="invite-hero-copy">
          <h2 id="invite-hero-title" className="invite-hero-title">
            친구와 함께,
            <br />더 많은 <span>캡슐을</span>!
          </h2>
          <p className="invite-hero-sub">
            친구를 초대하고 둘 다 <strong>{number(CREDIT_PRICING.inviteReward)} 크레딧</strong>을 받아보세요.
          </p>
        </div>
        <InviteHeroArt filled={filled} enterFrom={fill.enterFrom} cheer={fill.joined + redeemed} />
      </section>

      {/* ② Progress: n / 10 friends as capsules */}
      <section className="invite-progress" aria-labelledby="invite-progress-title">
        <h2 id="invite-progress-title" className="sr-only">초대 현황</h2>
        <p className="invite-progress-count">
          <strong>{number(invitation.rewardedCount)}</strong>
          <span className="invite-progress-goal-count"> / {GOAL}</span>
          <span className="invite-progress-unit">명</span>
        </p>
        <ol className="invite-progress-capsules" aria-label={`초대한 친구 ${filled}명 / ${GOAL}명`}>
          {Array.from({ length: GOAL }, (_, index) => {
            const on = index < filled
            return (
              <li
                key={index}
                data-filled={on || undefined}
                data-enter={(on && index >= fill.enterFrom) || undefined}
                style={{ '--enter-delay': `${(index - fill.enterFrom) * CAPSULE_STAGGER_MS}ms` } as CSSProperties}
              >
                <img src={on ? capsuleFilled : capsuleEmpty} width={224} height={224} alt="" draggable={false} />
                <span className="sr-only">{on ? `${index + 1}번째 친구 초대 완료` : `${index + 1}번째 자리 비어 있음`}</span>
              </li>
            )
          })}
        </ol>
        {/* What the invites have brought so far (the server's total). */}
        <p className="invite-progress-goal">
          <Icon name="coin" size={18} />
          <span>
            {remaining > 0 ? '지금까지 ' : '목표 달성! '}
            <strong>{number(invitation.rewardedCredits)} 크레딧</strong> 받았어요
          </span>
        </p>
      </section>

      {/* ③ My code: copy it, or share the invite link */}
      <section className="invite-panel invite-code-panel" aria-labelledby="invite-mine-title">
        <h2 id="invite-mine-title" className="invite-panel-title">
          <Icon name="coin" size={18} />
          나의 초대 코드
        </h2>
        {invitation.code ? (
          <div className="invite-code-row">
            {/* The code with its copy button inside the box, on the right. */}
            <div className="invite-code-box">
              <span className="invite-code-text" aria-label={`내 초대 코드 ${invitation.code}`}>{invitation.code}</span>
              <button
                type="button"
                className="invite-code-copy"
                data-copied={copiedKey === 'code' || undefined}
                aria-label={copiedKey === 'code' ? '초대 코드를 복사했어요' : '초대 코드 복사'}
                title={copiedKey === 'code' ? '복사했어요' : '복사하기'}
                onClick={() => {
                  void handleCopy('code', invitation.code)
                }}
              >
                {copiedKey === 'code' ? <Icon name="check" size={22} /> : <CopyIcon size={22} />}
              </button>
            </div>
            {invitation.link && (
              <Button
                className="invite-code-share"
                onClick={() => {
                  void handleShare()
                }}
              >
                <LinkIcon />
                {copiedKey === 'url' ? '링크를 복사했어요' : '초대 링크 공유하기'}
              </Button>
            )}
            <span role="status" className="sr-only">
              {copyStatus}
            </span>
          </div>
        ) : (
          <p className="invite-panel-note">초대 코드를 준비하고 있어요.</p>
        )}
        <p className="invite-panel-note">친구가 첫 연결을 마치면 들어와요. 초대 크레딧은 사라지지 않아요.</p>
      </section>

      {/* ③-2 Friends who used my code (35 `friends`, newest first). */}
      {invitation.friends.length > 0 && (
        <section className="invite-panel invite-friends" aria-labelledby="invite-friends-title">
          <h2 id="invite-friends-title" className="invite-panel-title">
            <UsersIcon size={18} />
            초대한 친구
          </h2>
          <ul className="invite-friends-list">
            {invitation.friends.map((friend) => (
              <li key={friend.key} className="invite-friend" data-status={friend.status} data-rewarded={friend.rewarded || undefined}>
                <span className="invite-friend-name">{friend.nickname ? `${friend.nickname}님` : '탈퇴한 친구'}</span>
                {friend.joinedAt !== null && <time className="invite-friend-date" dateTime={new Date(friend.joinedAt).toISOString()}>{dateLabel(friend.joinedAt)} 가입</time>}
                <span className="invite-friend-status">{friendStatus(friend)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ④ A code I received (for anyone who skipped it while signing up) */}
      <section className="invite-panel invite-redeem" aria-labelledby="invite-received-title">
        <span className="invite-redeem-icon" aria-hidden="true"><UsersIcon size={26} /></span>
        <div className="invite-redeem-copy">
          <h2 id="invite-received-title">초대 코드 입력하기</h2>
          <p>
            {alreadyRegistered
              ? redeemed > 0 ? '등록된 초대 코드가 있어요. 첫 연결을 마치면 크레딧이 들어와요.' : '초대 코드를 이미 입력했거나, 입력할 수 있는 기간(가입 후 7일)이 지났어요.'
              : `친구가 공유한 초대 코드를 입력하고 크레딧을 받아보세요! 가입 후 7일 안에 1번만 입력할 수 있어요.${invitation.codeInputDeadline !== null ? ` (${deadlineLabel(invitation.codeInputDeadline)})` : ''}`}
          </p>
        </div>
        {!alreadyRegistered && (
          <form
            className="invite-redeem-form"
            onSubmit={(event) => {
              event.preventDefault()
              void redeem()
            }}
          >
            <ReferralCodeField
              label="받은 초대 코드"
              showHelp={false}
              value={code}
              validation={validation}
              fromInviteLink={Boolean(linkCode) && code === linkCode}
              disabled={busy}
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
              variant="secondary"
              loading={busy}
              disabled={!code.trim()}
            >
              받기
            </Button>
          </form>
        )}
      </section>

      {error && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
    </CreditsAppWindow>
  )
}
