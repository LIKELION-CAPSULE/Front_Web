import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { useBackend } from '@/features/backend/backend-context'
import { Button } from '@/shared/ui/Button'
import { FormField } from '@/shared/ui/FormField'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { AvatarDial } from './AvatarDial'
import { nicknameError } from '../profile-input'
import { NICKNAME_MAX_INPUT_UNITS } from '@/shared/api/constraints'

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
  const [callName, setCallName] = useState(accountDetails?.callName ?? '')
  const [aboutMe, setAboutMe] = useState(accountDetails?.aboutMe ?? '')
  const [nameError, setNameError] = useState<string>()
  const [picked, setPicked] = useState<{ id: number | undefined }>()
  const avatarId = picked ? picked.id : currentAvatar
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const changed =
    name.trim() !== state.profile.name ||
    avatarId !== currentAvatar ||
    (!!saveBetaProfile &&
      (callName.trim() !== (accountDetails?.callName ?? '') ||
        aboutMe.trim() !== (accountDetails?.aboutMe ?? '')))

  return (
    <section aria-labelledby={headingId} className="profile-editor">
      <div className="profile-editor-scroll">
        <form
          id={formId}
          noValidate
          className="profile-editor-form"
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
            try {
              if (saveBetaProfile) await saveBetaProfile({ nickname: name, avatarId, callName, aboutMe })
              else await saveProfile(name, avatarId)
              setName(name.trim())
              setCallName(callName.trim())
              setAboutMe(aboutMe.trim())
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : '저장하지 못했어요.')
            } finally {
              pending.current = false
              setBusy(false)
              onBusyChange?.(false)
            }
          }}
        >
          <h2 id={headingId} className="account-settings-title">
            프로필
          </h2>

          <div className="profile-editor-grid">
            <div className="profile-editor-dial-col">
              <AvatarDial
                compact
                avatars={choices}
                value={avatarId ?? 0}
                disabled={busy}
                previewActive={active}
                onChange={(value) => setPicked({ id: value === 0 ? undefined : value })}
                fallback={<AvatarIllustration settings={state.profile.avatar} />}
              />
            </div>

            <div className="profile-editor-details">
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
                    <FormField label="호칭">
                      <input
                        className="form-input"
                        name="callName"
                        value={callName}
                        onChange={(event) => setCallName(event.target.value)}
                        readOnly={busy}
                        aria-describedby={`${headingId}-callName-hint`}
                      />
                    </FormField>
                    <p id={`${headingId}-callName-hint`} className="profile-editor-hint">
                      메이트가 나를 부르는 이름
                    </p>
                  </div>
                  <div className="profile-editor-extra">
                    <FormField label="나에 대해">
                      <input
                        className="form-input"
                        name="aboutMe"
                        value={aboutMe}
                        onChange={(event) => setAboutMe(event.target.value)}
                        readOnly={busy}
                        aria-describedby={`${headingId}-aboutMe-hint`}
                      />
                    </FormField>
                    <p id={`${headingId}-aboutMe-hint`} className="profile-editor-hint">
                      하는 일, 요즘 상황
                    </p>
                  </div>
                </>
              )}

              {error && (
                <FeedbackMessage tone="error" className="mt-4">
                  {error}
                </FeedbackMessage>
              )}
            </div>
          </div>
        </form>

        {narrowFooter && <div className="account-settings-mobile-logout">{narrowFooter}</div>}
      </div>

      <div className="profile-editor-footer">
        <Button
          type="submit"
          form={formId}
          size="md"
          loading={busy}
          disabled={busy || !name.trim() || !changed}
        >
          프로필 저장
        </Button>
      </div>
    </section>
  )
}
