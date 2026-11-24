import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useWindupString } from 'windups'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { AvatarDial } from '@/features/profile/components/AvatarDial'
import { safeReturnPath } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import { enqueueNotification, type NotificationItem } from '@/shared/ui/notification-queue'
import { FormField } from '@/shared/ui/FormField'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { BirthDateField } from '@/features/auth/components/BirthDateField'
import { ReferralCodeField, type ReferralFieldValidationState } from '@/features/auth/components/ReferralCodeField'
import { birthDateError, birthDateErrorField } from '@/features/auth/birth-date'
import {
  clearStoredReferralCode,
  formatNicknameGreeting,
  normalizeReferralCode,
  readStoredReferralCode,
  shouldApplyIncomingReferral,
  subscribeStoredReferralCode,
} from '@/features/auth/referral-code'
import { nicknameError } from '@/features/profile/profile-input'
import { createFinishGate } from '@/features/profile/onboarding-submit'
import { mateAvatar } from '@/features/mates/artwork'
import { speechPace } from '@/features/session/speech-pace'
import { NICKNAME_MAX_INPUT_UNITS } from '@/shared/api/constraints'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { useDesktopShell } from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'
import './onboarding.css'

const NOOP = () => {}

/**
 * Onboarding is two steps on one route (`?step=2`), so the browser's back button returns from step 2 to step 1.
 *
 * Saving: nothing reaches the server until the last step. Then, in this order: the invite code is checked (only when
 * one was entered), and one `completeOnboarding` call saves nickname, avatar, birth date and code together, as before.
 * A failed check or save keeps the user on step 2 with every value. Refreshing or leaving midway keeps the nickname
 * and the avatar for this tab (sessionStorage); the birth date is not kept (personal data), so a refresh on step 2
 * returns to step 1 when it is still needed. A `?ref=` code stays in its own 7-day storage and fills step 2 again.
 */
const DRAFT_KEY = 'capsule-onboarding-draft:v1'
type Draft = { userId?: number; nickname?: string; avatarId?: number }

function readDraft(userId: number | undefined): Draft {
  try {
    const value = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
    if (!value || value.userId !== userId) return {}
    return {
      ...(typeof value.nickname === 'string' ? { nickname: value.nickname } : {}),
      ...(typeof value.avatarId === 'number' ? { avatarId: value.avatarId } : {}),
    }
  } catch {
    return {}
  }
}
function writeDraft(draft: Draft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* The draft is a convenience only. */ }
}
function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* Nothing kept. */ }
}

/** 채린's small still + glass bubble on step 2; the line types out (instantly under reduced motion). */
function MateHello({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const [typed, { isFinished }] = useWindupString(text, { pace: speechPace, skipped: reduced })
  // The bubble is sized by the whole line from the start (hidden measure); the line types into it and wraps freely.
  return <div className="onboarding-hello" data-typing={!isFinished || undefined}>
    <img className="onboarding-hello-avatar" src={mateAvatar('chaerin')} alt="" width={56} height={56} decoding="async" />
    <div className="onboarding-hello-bubble">
      <span className="onboarding-hello-name" aria-hidden="true">채린</span>
      <p className="onboarding-hello-text">
        <span className="sr-only">채린: {text}</span>
        <span className="onboarding-hello-measure" aria-hidden="true">{text}</span>
        <span className="onboarding-hello-typed" aria-hidden="true">{typed}</span>
      </p>
    </div>
  </div>
}

function StepMeter({ step, total }: { step: number; total: number }) {
  if (total < 2) return null
  return <p className="onboarding-steps" aria-label={`${total}단계 중 ${step}단계`}>
    <span className="onboarding-steps-bars" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => <span key={index} data-active={index < step || undefined} />)}
    </span>
    <span aria-hidden="true">{step} / {total}</span>
  </p>
}

export default function OnboardingPage() {
  const { state } = useDemo()
  const backend = useBackend()
  const desktopShell = useDesktopShell()
  const userId = state.profile.userId
  const [draft] = useState(() => readDraft(userId))
  const [name, setName] = useState(draft.nickname ?? state.profile.name)
  const [avatarId, setAvatarId] = useState(draft.avatarId ?? backend.avatars[0]?.id)
  const selectedAvatarId =
    avatarId !== undefined && backend.avatars.some((avatar) => avatar.id === avatarId)
      ? avatarId
      : backend.avatars.find((avatar) => avatar.id !== undefined)?.id
  const [busy, setBusy] = useState<'start' | 'skip' | null>(null)
  const [finishGate] = useState(createFinishGate)
  const mountedRef = useRef(true)
  const currentUserRef = useRef(state.profile.userId)
  const loggedInRef = useRef(state.profile.loggedIn)
  const stepOneForm = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const referralInputRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const [birthDate, setBirthDate] = useState('')
  const [errors, setErrors] = useState<{ nickname?: string; birthDate?: string }>({})
  const needsBirthDate = !backend.accountDetails?.birthDate
  const needsReferral = !backend.accountDetails?.referralRegistered
  const totalSteps = needsReferral ? 2 : 1
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const pushedStep = useRef(false)

  const stepOneReady = !nicknameError(name) && (!needsBirthDate || !birthDateError(birthDate))
  const requestedStep = params.get('step') === '2' && needsReferral ? 2 : 1
  const step = requestedStep === 2 && stepOneReady ? 2 : 1

  // Referral code state (auto-filled from 7-day ?ref= link storage if present)
  const [storedRef, setStoredRef] = useState(() => readStoredReferralCode())
  const [referralCode, setReferralCode] = useState(() => storedRef?.code ?? '')
  const [referralValidation, setReferralValidation] = useState<ReferralFieldValidationState>({
    status: 'idle',
    ...(storedRef?.inviterNickname ? { inviterNickname: storedRef.inviterNickname } : {}),
  })
  const referralCodeRef = useRef(referralCode)
  const userEditedReferralRef = useRef(false)
  const lastValidatedRef = useRef('')
  const fromInviteLink = Boolean(storedRef && normalizeReferralCode(referralCode) === storedRef.code)
  const inviter = fromInviteLink ? referralValidation.inviterNickname ?? storedRef?.inviterNickname : undefined

  useEffect(() => {
    referralCodeRef.current = referralCode
  }, [referralCode])

  useEffect(() => {
    currentUserRef.current = state.profile.userId
    loggedInRef.current = state.profile.loggedIn
  }, [state.profile.userId, state.profile.loggedIn])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    return subscribeStoredReferralCode((incoming) => {
      setStoredRef(incoming)
      if (shouldApplyIncomingReferral(referralCodeRef.current, userEditedReferralRef.current)) {
        setReferralCode(incoming.code)
        lastValidatedRef.current = ''
      }
    })
  }, [])

  // Keep nickname and avatar for this tab until onboarding finishes.
  useEffect(() => {
    writeDraft({ userId, nickname: name, ...(selectedAvatarId === undefined ? {} : { avatarId: selectedAvatarId }) })
  }, [userId, name, selectedAvatarId])

  // A step 2 address that step 1 cannot back (refresh without the birth date) shows step 1 at that address.
  useEffect(() => {
    if (requestedStep !== 2 || step === 2) return
    const next = new URLSearchParams(params)
    next.delete('step')
    setParams(next, { replace: true })
  }, [requestedStep, step, params, setParams])

  // Mate reaction refs
  const greetFiredRef = useRef(false)
  const avatarTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastReactedNicknameRef = useRef(state.profile.name.trim())

  useEffect(() => {
    document.title = step === 2 ? 'CAPSULE · 초대 코드' : 'CAPSULE · 프로필 만들기'
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  useEffect(() => {
    if (!desktopShell) return
    desktopShell.setWindowConfig({
      windowKey: 'onboarding',
      windowTitle: 'CAPSULE — 프로필 설정',
      windowWidth: 500,
      mode: 'onboarding',
      legalDocument: null,
      onCloseLegal: NOOP,
      hasErrorNotification: false,
      scrollResetKey: 'onboarding',
    })
  }, [desktopShell])

  // Mate reaction: clear any previous route bubble/queue and emit onboardingGreet on open
  useEffect(() => {
    if (!desktopShell || greetFiredRef.current) return
    greetFiredRef.current = true
    desktopShell.triggerReaction('onboardingGreet', {
      force: true,
      clearQueue: true,
      revertAfterMs: 5200,
    })
  }, [desktopShell])

  useEffect(() => {
    return () => clearTimeout(avatarTimerRef.current)
  }, [])

  const validateReferral = useCallback(
    async (raw: string, forSubmit = false): Promise<boolean> => {
      const code = normalizeReferralCode(raw)
      if (!code) {
        setReferralValidation({ status: 'idle' })
        lastValidatedRef.current = ''
        return true
      }
      if (!backend.validateReferralCode) {
        return true
      }
      setReferralValidation((prev) => ({ ...prev, status: 'checking' }))
      try {
        const res = await backend.validateReferralCode(code)
        lastValidatedRef.current = code
        if (res.valid) {
          setReferralValidation({
            status: 'valid',
            ...(res.inviterNickname ? { inviterNickname: res.inviterNickname } : {}),
          })
          desktopShell?.triggerReaction('referralValid', { revertAfterMs: 4600 })
          return true
        }
        setReferralValidation({
          status: 'invalid',
          message:
            res.reason === 'self' || res.reason === 'already_registered'
              ? res.message
              : '확인할 수 없는 코드예요. 지우거나 고쳐 주세요',
        })
        return false
      } catch {
        setReferralValidation({
          status: 'invalid',
          message: forSubmit
            ? '확인할 수 없는 코드예요. 지우거나 고쳐 주세요'
            : '초대 코드를 확인하지 못했어요.',
        })
        return false
      }
    },
    [backend, desktopShell],
  )

  // Auto-validate pre-filled ?ref= code on mount (StrictMode safe; queues referralValid after onboardingGreet)
  useEffect(() => {
    if (!needsReferral || !storedRef?.code || !backend.validateReferralCode) {
      return
    }
    if (lastValidatedRef.current === storedRef.code) return
    let active = true
    void backend
      .validateReferralCode(storedRef.code)
      .then((res) => {
        if (!active) return
        lastValidatedRef.current = storedRef.code
        if (res.valid) {
          setReferralValidation({
            status: 'valid',
            ...(res.inviterNickname ? { inviterNickname: res.inviterNickname } : {}),
          })
          desktopShell?.triggerReaction('referralValid', {
            queueAfter: 'onboardingGreet',
            revertAfterMs: 4600,
          })
        } else {
          setReferralValidation({
            status: 'invalid',
            message:
              res.reason === 'self' || res.reason === 'already_registered'
                ? res.message
                : '확인할 수 없는 코드예요. 지우거나 고쳐 주세요',
          })
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [needsReferral, storedRef, backend, desktopShell])

  function handleAvatarChange(nextId: number) {
    setAvatarId(nextId)
    clearTimeout(avatarTimerRef.current)
    avatarTimerRef.current = setTimeout(() => {
      desktopShell?.triggerReaction('avatarPicked', { revertAfterMs: 4200 })
    }, 600)
  }

  function handleNicknameBlur() {
    const trimmed = name.trim()
    if (!trimmed || nicknameError(trimmed)) return
    if (trimmed === lastReactedNicknameRef.current) return
    lastReactedNicknameRef.current = trimmed
    desktopShell?.triggerReaction('nicknameSet', {
      line: formatNicknameGreeting(trimmed),
      revertAfterMs: 4400,
    })
  }

  /** Step 1 checks; focuses the first invalid field. Nothing is sent to the server here. */
  function checkStepOne(): boolean {
    const next = {
      nickname: nicknameError(name),
      birthDate: needsBirthDate ? birthDateError(birthDate) : undefined,
    }
    setErrors(next)
    const invalid = next.nickname ? 'nickname' : next.birthDate ? birthDateErrorField(birthDate) : null
    if (invalid) {
      stepOneForm.current?.querySelector<HTMLInputElement>(`[name="${invalid}"]`)?.focus()
      return false
    }
    return true
  }

  function goToStepTwo() {
    if (!checkStepOne()) return
    const next = new URLSearchParams(params)
    next.set('step', '2')
    pushedStep.current = true
    setParams(next)
  }

  function backToStepOne() {
    if (busy) return
    if (pushedStep.current) {
      pushedStep.current = false
      navigate(-1)
      return
    }
    const next = new URLSearchParams(params)
    next.delete('step')
    setParams(next, { replace: true })
  }

  async function finish(skipReferral: boolean) {
    if (finishGate.isPending()) return
    if (!checkStepOne()) {
      if (step === 2) backToStepOne()
      return
    }
    const normalizedRef = needsReferral && !skipReferral ? normalizeReferralCode(referralCode) : ''
    const owner = userId
    // The lock and the busy state start before the invite check, so nothing else can start a second save meanwhile.
    setBusy(skipReferral ? 'skip' : 'start')
    setNotifications([])
    try {
      const result = await finishGate.run({
        validate: normalizedRef && backend.validateReferralCode ? () => validateReferral(normalizedRef, true) : undefined,
        // Left the screen, or another account is signed in now: do not save the old account's profile.
        isCurrent: () => mountedRef.current && currentUserRef.current === owner && loggedInRef.current,
        save: async () => {
          if (!backend.completeOnboarding) throw new Error('요청을 처리하지 못했어요.')
          await backend.completeOnboarding({
            nickname: name,
            avatarId: selectedAvatarId,
            ...(needsBirthDate ? { birthDate } : {}),
            ...(normalizedRef ? { referralCode: normalizedRef } : {}),
          })
          if (normalizedRef) clearStoredReferralCode()
          clearDraft()
          desktopShell?.triggerReaction('onboardingDone', { force: true, clearQueue: true })
          const reduced =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
          if (desktopShell && !reduced) await new Promise((resolve) => setTimeout(resolve, 1200))
          desktopShell?.setWindowClosing?.(true)
          if (desktopShell && !reduced) await new Promise((resolve) => setTimeout(resolve, 180))
          // reload() shows the route loading screen, which unmounts this page for a moment: navigate regardless.
          await backend.reload()
          navigate(safeReturnPath(params.get('next'), '/'), { replace: true })
        },
      })
      if (result === 'invalid') referralInputRef.current?.focus()
    } catch (reason) {
      if (!mountedRef.current) return
      const item: NotificationItem = {
        id: crypto.randomUUID(),
        tone: 'error',
        title: '프로필 저장 실패',
        text: reason instanceof Error ? reason.message : '프로필을 저장하지 못했어요.',
      }
      setNotifications((current) => enqueueNotification(current, item))
      desktopShell?.triggerReaction('error', { revertAfterMs: 4500 })
    } finally {
      if (mountedRef.current) setBusy(null)
    }
  }

  const nickname = name.trim()
  const greeting = nickname && !nicknameError(nickname) ? `안녕, ${nickname}! 이 모습으로 함께할게요.` : '닉네임을 알려 주면 인사할게요.'
  const helloText = inviter
    ? `${nickname}, 반가워! ${inviter}님이 초대해 줬구나. 코드만 확인하면 바로 시작이야.`
    : `${nickname}, 반가워! 친구한테 받은 초대 코드가 있으면 알려 줘.`

  return (
    <main id="main-content" tabIndex={-1} className="onboarding focus:outline-none" data-step={step}>
      {step === 1 ? (
        <div className="onboarding-step-one">
          <AvatarDial
            avatars={backend.avatars}
            value={selectedAvatarId}
            onChange={handleAvatarChange}
            disabled={!!busy}
            fallback={<AvatarIllustration settings={state.profile.avatar} />}
            greeting={greeting}
          />
          <form
            ref={stepOneForm}
            noValidate
            className="onboarding-panel"
            aria-labelledby={`${fieldId}-title`}
            onSubmit={(event) => {
              event.preventDefault()
              if (needsReferral) goToStepTwo()
              else void finish(true)
            }}
          >
            <StepMeter step={1} total={totalSteps} />
            <h1 ref={headingRef} id={`${fieldId}-title`} tabIndex={-1} className="onboarding-title">
              프로필 만들기
            </h1>
            <p className="onboarding-lead">함께할 모습과 이름을 정해요.</p>

            <FormField label="닉네임" error={errors.nickname} errorId={`${fieldId}-nickname`}>
              <input
                className="form-input"
                name="nickname"
                autoComplete="nickname"
                required
                maxLength={NICKNAME_MAX_INPUT_UNITS}
                placeholder="닉네임을 입력해 주세요"
                readOnly={!!busy}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setErrors((previous) => ({ ...previous, nickname: undefined }))
                }}
                onBlur={handleNicknameBlur}
                aria-invalid={!!errors.nickname || undefined}
                aria-describedby={errors.nickname ? `${fieldId}-nickname` : undefined}
              />
            </FormField>

            {needsBirthDate && (
              <BirthDateField
                value={birthDate}
                onChange={(value) => {
                  setBirthDate(value)
                  setErrors((previous) => ({ ...previous, birthDate: undefined }))
                }}
                error={errors.birthDate}
                errorId={`${fieldId}-birthDate`}
                readOnly={!!busy}
              />
            )}

            <Button type="submit" loading={busy !== null} disabled={!!busy || !nickname} className="onboarding-primary">
              {needsReferral ? '다음' : '시작하기'}
            </Button>
            <p className="onboarding-ai-note">캡슐 메이트는 AI 캐릭터예요.</p>
          </form>
        </div>
      ) : (
        <form
          noValidate
          className="onboarding-panel onboarding-invite"
          aria-labelledby={`${fieldId}-invite-title`}
          onSubmit={(event) => {
            event.preventDefault()
            void finish(false)
          }}
        >
          <div className="onboarding-invite-top">
            <Button variant="ghost" size="sm" className="onboarding-back" disabled={!!busy} onClick={backToStepOne}>
              <Icon name="arrow" size={16} className="rotate-180" />
              이전
            </Button>
            <StepMeter step={2} total={totalSteps} />
          </div>
          <MateHello key={helloText} text={helloText} />
          <h1 ref={headingRef} id={`${fieldId}-invite-title`} tabIndex={-1} className="onboarding-title">
            초대 코드
          </h1>
          <div className="onboarding-benefit">
            <Icon name="gift" size={22} className="onboarding-benefit-icon" />
            <div>
              <p className="onboarding-benefit-title">친구를 초대하면 둘 다 크레딧 1,000</p>
              <p className="onboarding-benefit-text">받은 초대 코드를 넣고 첫 연결을 마치면 나와 친구 모두 받아요.</p>
            </div>
          </div>
          <ReferralCodeField
            inputRef={referralInputRef}
            value={referralCode}
            label="초대 코드 (선택)"
            placeholder="친구에게 받은 코드"
            showHelp={false}
            fromInviteLink={fromInviteLink}
            inviterNickname={storedRef?.inviterNickname}
            validation={referralValidation}
            readOnly={!!busy}
            onChange={(nextVal) => {
              userEditedReferralRef.current = true
              setReferralCode(nextVal)
              if (normalizeReferralCode(nextVal) !== lastValidatedRef.current) {
                setReferralValidation({ status: 'idle' })
              }
            }}
            onBlurValidate={() => {
              const norm = normalizeReferralCode(referralCode)
              if (!norm) {
                setReferralValidation({ status: 'idle' })
                return
              }
              if (norm !== lastValidatedRef.current) {
                void validateReferral(norm, false)
              }
            }}
          />
          <div className="onboarding-invite-actions">
            <Button type="submit" loading={busy === 'start'} disabled={!!busy} className="onboarding-primary">
              {fromInviteLink ? '확인하고 시작하기' : '시작하기'}
            </Button>
            <Button variant="ghost" loading={busy === 'skip'} disabled={!!busy} onClick={() => void finish(true)}>
              건너뛰기
            </Button>
          </div>
        </form>
      )}
      <NotificationStack
        items={notifications}
        onDismiss={(id) => setNotifications((current) => current.filter((item) => item.id !== id))}
      />
    </main>
  )
}
