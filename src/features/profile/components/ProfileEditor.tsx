import { useState } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { Button } from '@/shared/ui/Button'
import { avatarShades } from '../avatar-options'
import { AvatarCustomizer } from './AvatarCustomizer'

export function ProfileEditor() {
  const { state, dispatch } = useDemo()
  const [name, setName] = useState(state.profile.name)
  const [avatar, setAvatar] = useState(state.profile.avatar)
  const [saved, setSaved] = useState(false)
  const changed =
    name !== state.profile.name ||
    Object.keys(avatar).some(
      (key) =>
        avatar[key as keyof typeof avatar] !== state.profile.avatar[key as keyof typeof avatar],
    )
  return (
    <section className="mypage-profile" aria-labelledby="profile-heading">
      <div
        className="mypage-avatar-preview"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${avatarShades[avatar.background]}35, #141923 75%)`,
        }}
      >
        <div className="mypage-avatar-figure">
          <AvatarIllustration settings={avatar} />
        </div>
        <p className="text-xs text-muted">카메라를 끄면 이 모습이 보여요</p>
      </div>
      <form
        className="mypage-profile-form"
        onSubmit={(event) => {
          event.preventDefault()
          dispatch({ type: 'PROFILE', name, avatar })
          setName(name.trim())
          setSaved(true)
        }}
      >
        <h2 id="profile-heading" className="text-lg font-semibold">
          프로필
        </h2>
        <label className="mt-5 block text-sm text-muted">
          닉네임
          <input
            required
            maxLength={20}
            value={name}
            className="form-input mt-2"
            onChange={(event) => {
              setName(event.target.value)
              setSaved(false)
            }}
          />
        </label>
        <div className="mt-5">
          <AvatarCustomizer
            value={avatar}
            onChange={(value) => {
              setAvatar(value)
              setSaved(false)
            }}
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!name.trim() || !changed}>
            프로필 저장
          </Button>
          {changed && (
            <button
              type="button"
              className="px-2 py-2 text-sm text-muted"
              onClick={() => {
                setName(state.profile.name)
                setAvatar(state.profile.avatar)
                setSaved(false)
              }}
            >
              되돌리기
            </button>
          )}
          {saved && (
            <p role="status" className="text-xs text-brand-strong">
              저장했어요.
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
