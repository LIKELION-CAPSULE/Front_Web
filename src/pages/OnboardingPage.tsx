import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { AvatarDial } from '@/features/profile/components/AvatarDial'
import { safeReturnPath } from '@/shared/lib/format'
import { Button } from '@/shared/ui/Button'
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
import { NICKNAME_MAX_INPUT_UNITS } from '@/shared/api/constraints'
import { useDesktopShell } from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'

const NOOP = () => {}

export default function OnboardingPage() {
  const { state } = useDemo()
  const backend = useBackend()
  const desktopShell = useDesktopShell()
  const [name, setName] = useState(state.profile.name)
  const [avatarId, setAvatarId] = useState(backend.avatars[0]?.id)
  const selectedAvatarId =
    avatarId !== undefined && backend.avatars.some((avatar) => avatar.id === avatarId)
      ? avatarId
      : backend.avatars.find((avatar) => avatar.id !== undefined)?.id
  const [busy, setBusy] = useState<'default' | 'selected' | null>(null)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const referralInputRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const [birthDate, setBirthDate] = useState('')
  const [errors, setErrors] = useState<{ nickname?: string; birthDate?: string }>({})
  const needsBirthDate = !backend.accountDetails?.birthDate
  const needsReferral = !backend.accountDetails?.referralRegistered
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [params] = useSearchParams()
  const navigate = useNavigate()

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

  useEffect(() => {
    referralCodeRef.current = referralCode
  }, [referralCode])

  useEffect(() => {
    return subscribeStoredReferralCode((incoming) => {
      setStoredRef(incoming)
      if (shouldApplyIncomingReferral(referralCodeRef.current, userEditedReferralRef.current)) {
        setReferralCode(incoming.code)
        lastValidatedRef.current = ''
      }
    })
  }, [])

  // Mate reaction refs
  const greetFiredRef = useRef(false)
  const avatarTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastReactedNicknameRef = useRef(state.profile.name.trim())

  // Configure shared DesktopAuthLayout window
  useEffect(() => {
    document.title = 'CAPSULE · 프로필 설정'
    headingRef.current?.focus({ preventScroll: true })
  }, [])

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

  async function finish(selected?: number) {
    if (pending.current) return
    const next = {
      nickname: nicknameError(name),
      birthDate: needsBirthDate ? birthDateError(birthDate) : undefined,
    }
    setErrors(next)
    const invalid = next.nickname ? 'nickname' : next.birthDate ? birthDateErrorField(birthDate) : null
    if (invalid) {
      form.current?.querySelector<HTMLInputElement>(`[name="${invalid}"]`)?.focus()
      return
    }

    const normalizedRef = needsReferral ? normalizeReferralCode(referralCode) : ''
    if (needsReferral && normalizedRef && backend.validateReferralCode) {
      const ok = await validateReferral(normalizedRef, true)
      if (!ok) {
        referralInputRef.current?.focus()
        return
      }
    }

    pending.current = true
    setBusy(selected === undefined ? 'default' : 'selected')
    setNotifications([])
    try {
      if (!backend.completeOnboarding) throw new Error('요청을 처리하지 못했어요.')
      await backend.completeOnboarding({
        nickname: name,
        avatarId: selected,
        ...(needsBirthDate ? { birthDate } : {}),
        ...(normalizedRef ? { referralCode: normalizedRef } : {}),
      })
      if (normalizedRef) clearStoredReferralCode()
      desktopShell?.triggerReaction('onboardingDone', { force: true, clearQueue: true })
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reduced) await new Promise((resolve) => setTimeout(resolve, 1200))
      desktopShell?.setWindowClosing?.(true)
      if (!reduced) await new Promise((resolve) => setTimeout(resolve, 180))
      await backend.reload()
      navigate(safeReturnPath(params.get('next'), '/'), { replace: true })
    } catch (reason) {
      const item: NotificationItem = {
        id: crypto.randomUUID(),
        tone: 'error',
        title: '프로필 저장 실패',
        text: reason instanceof Error ? reason.message : '프로필을 저장하지 못했어요.',
      }
      setNotifications((current) => enqueueNotification(current, item))
      desktopShell?.triggerReaction('error', { revertAfterMs: 4500 })
    } finally {
      pending.current = false
      setBusy(null)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="focus:outline-none">
      <h1 ref={headingRef} tabIndex={-1} className="text-[22px] leading-[30px] font-semibold tracking-tight text-ink focus:outline-none">
        프로필 설정
      </h1>
      <form
        ref={form}
        noValidate
        className="onboarding-compact-form mt-2.5 space-y-3 [--form-input-border:var(--color-input-border)]"
        onSubmit={(event) => {
          event.preventDefault()
          if (selectedAvatarId !== undefined) void finish(selectedAvatarId)
        }}
      >
        <AvatarDial
          compact
          avatars={backend.avatars}
          value={selectedAvatarId}
          onChange={handleAvatarChange}
          disabled={!!busy}
          fallback={<AvatarIllustration settings={state.profile.avatar} />}
        />

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

        {needsReferral && (
          <ReferralCodeField
            inputRef={referralInputRef}
            value={referralCode}
            fromInviteLink={Boolean(storedRef && normalizeReferralCode(referralCode) === storedRef.code)}
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
        )}

        <div className="flex flex-col gap-1.5 pt-1">
          <Button
            type="submit"
            loading={busy === 'selected'}
            disabled={!!busy || !name.trim() || selectedAvatarId === undefined}
            className="w-full"
          >
            이 모습으로 시작하기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={busy === 'default'}
            disabled={!!busy || !name.trim()}
            onClick={() => {
              void finish()
            }}
            className="w-full"
          >
            기본 아바타로 시작하기
          </Button>
        </div>
      </form>
      <NotificationStack
        items={notifications}
        onDismiss={(id) => setNotifications((current) => current.filter((item) => item.id !== id))}
      />
    </main>
  )
}
