import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { Button } from '@/shared/ui/Button'
import { ScrollMoreHint } from '@/shared/ui/ScrollMoreHint'
import { FormField } from '@/shared/ui/FormField'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { AvatarDial } from './AvatarDial'
import { ABOUT_ME_MAX_LENGTH, nicknameError } from '../profile-input'
import { NICKNAME_MAX_INPUT_UNITS } from '@/shared/api/constraints'

/**
 * The dialog is `min(760px, 90dvh)` tall (account-settings.css): below ~600px (a viewport under 667px) the vertical arc
 * has too little height, so the stills go back to one row under the stage.
 */
const LOW_HEIGHT = '(max-height: 666px)'
function subscribeLowHeight(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(LOW_HEIGHT)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const useLowHeight = () => useSyncExternalStore(
  subscribeLowHeight,
  () => typeof window.matchMedia === 'function' && window.matchMedia(LOW_HEIGHT).matches,
  () => false,
)

/**
 * The account settings profile tab, laid out like onboarding step 1: the avatar arc at the content's left edge
 * (AvatarArcRail), the chosen avatar's Live2D stage with its name and a greeting, and the fields on the login panel's
 * outlined card at the right. Low dialogs use the row of stills instead of the arc; narrow ones stack.
 */
export function ProfileEditor({
  active = true,
  onBusyChange,
  narrowFooter,
}: {
  active?: boolean
  onBusyChange?: (busy: boolean) => void
  narrowFooter?: ReactNode
} = {}) {
  const headingId = useId()
  const formId = useId()
  const { state } = useDemo()
  const { avatars, saveProfile, ensureAvatars, accountDetails, saveBetaProfile } = useBackend()
  const lowHeight = useLowHeight()

  // Load avatar choices when the editor opens; without them only the current portrait is offered.
  useEffect(() => {
    if (active) void ensureAvatars().catch(() => { /* Keep the current avatar. */ })
  }, [active, ensureAvatars])

  // Prefer server-provided state.profile.avatarId; fall back to matching the thumbnail URL in loaded choices.
  // If still unknown, PATCH /me omits avatarId — UpdateMeRequest allows avatarId?: number (optional) so
  // nickname-only updates never fail or overwrite the user's portrait.
  const currentAvatar =
    state.profile.avatarId ?? avatars.find((avatar) => avatar.thumbnailUrl === state.profile.profileImage)?.id
  const choices =
    currentAvatar === undefined
      ? [{ id: 0, name: '현재 아바타', thumbnailUrl: state.profile.profileImage }, ...avatars]
      : avatars

  const [name, setName] = useState(state.profile.name)
  const [aboutMe, setAboutMe] = useState(accountDetails?.aboutMe ?? '')
  const [nameError, setNameError] = useState<string>()
  const [picked, setPicked] = useState<{ id: number | undefined }>()
  const avatarId = picked ? picked.id : currentAvatar
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  /** 「저장했어요」 after a successful save; any later edit clears it. */
  const [saved, setSaved] = useState(false)
  const changed =
    name.trim() !== state.profile.name ||
    avatarId !== currentAvatar ||
    (!!saveBetaProfile &&
      aboutMe.trim() !== (accountDetails?.aboutMe ?? ''))

  // Under the avatar's name, as onboarding greets the nickname being typed.
  const nickname = name.trim()
  const greeting = nickname && !nicknameError(nickname) ? `반가워요, ${nickname}님! 이 모습으로 함께할게요.` : '닉네임을 알려 주면 인사할게요.'

  return (
    <section aria-labelledby={headingId} className="profile-editor" data-rail={lowHeight ? 'row' : 'arc'}>
      <div ref={scroller} className="profile-editor-scroll">
        <form
          id={formId}
          noValidate
          className="profile-editor-form"
          onChange={() => setSaved(false)}
          onSubmit={async (event) => {
            event.preventDefault()
            if (pending.current || !changed) return
            const invalid = nicknameError(name)
            setNameError(invalid)
            if (invalid) {
              event.currentTarget.querySelector<HTMLInputElement>('[name="nickname"]')?.focus()
              return
            }
            pending.current = true
            setBusy(true)
            onBusyChange?.(true)
            setError('')
            setSaved(false)
            try {
              if (saveBetaProfile) await saveBetaProfile({ nickname: name, avatarId, aboutMe })
              else await saveProfile(name, avatarId)
              setName(name.trim())
              setAboutMe(aboutMe.trim())
              setSaved(true)
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : '저장하지 못했어요.')
            } finally {
              pending.current = false
              setBusy(false)
              onBusyChange?.(false)
            }
          }}
        >
          <div className="profile-editor-stage" data-tour="account-avatar">
            <AvatarDial
              size="compact"
              layout={lowHeight ? 'row' : 'arc'}
              avatars={choices}
              value={avatarId ?? 0}
              disabled={busy}
              previewActive={active}
              onChange={(value) => {
                setPicked({ id: value === 0 ? undefined : value })
                setSaved(false)
              }}
              fallback={<AvatarIllustration settings={state.profile.avatar} />}
              greeting={greeting}
            />
          </div>

          <div className="profile-editor-side">
            <div className="profile-editor-panel">
              <div className="profile-editor-panel-scroll">
                <h2 id={headingId} className="profile-editor-title">
                  프로필
                </h2>
                <p className="profile-editor-lead">함께할 모습과 이름을 정해요.</p>
                <FormField label="닉네임" error={nameError} errorId={`${headingId}-nickname-error`}>
                  <input
                    className="form-input"
                    name="nickname"
                    autoComplete="nickname"
                    readOnly={busy}
                    required
                    maxLength={NICKNAME_MAX_INPUT_UNITS}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setNameError(undefined)
                    }}
                    aria-invalid={!!nameError || undefined}
                    aria-describedby={nameError ? `${headingId}-nickname-error` : undefined}
                  />
                </FormField>

                {saveBetaProfile && (
                  <>
                    <div className="profile-editor-extra">
                      <FormField label="나에 대해">
                        <input
                          className="form-input"
                          name="aboutMe"
                          value={aboutMe}
                          maxLength={ABOUT_ME_MAX_LENGTH}
                          placeholder="예: 대학교 3학년, 요즘 졸업 준비로 바빠요"
                          onChange={(event) => setAboutMe(event.target.value)}
                          readOnly={busy}
                          aria-describedby={`${headingId}-aboutMe-hint`}
                        />
                      </FormField>
                      <p id={`${headingId}-aboutMe-hint`} className="profile-editor-hint profile-editor-hint--count">
                        <span>하는 일, 요즘 상황</span>
                        <span className="profile-editor-count">
                          {aboutMe.length}/{ABOUT_ME_MAX_LENGTH}
                          <span className="sr-only">자</span>
                        </span>
                      </p>
                    </div>
                  </>
                )}

                {error && (
                  <FeedbackMessage tone="error" className="profile-editor-feedback">
                    {error}
                  </FeedbackMessage>
                )}
                {saved && !error && (
                  <FeedbackMessage tone="success" className="profile-editor-feedback">
                    프로필을 저장했어요.
                  </FeedbackMessage>
                )}

                <Button
                  type="submit"
                  loading={busy}
                  disabled={busy || !name.trim() || !changed}
                  className="profile-editor-save"
                >
                  프로필 저장
                </Button>
              </div>
            </div>
          </div>
        </form>

        {narrowFooter && <div className="account-settings-mobile-logout">{narrowFooter}</div>}
      </div>
      {/* Stacked (narrow dialog): the nickname and 「프로필 저장」 below the avatar say they are there (UX review 7-2). */}
      <ScrollMoreHint target={scroller} />
    </section>
  )
}
