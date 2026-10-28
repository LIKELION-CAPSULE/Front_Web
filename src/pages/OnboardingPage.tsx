import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PageNavigation } from '@/app/PageNavigation'
import { useDemo } from '@/features/demo/demo-context'
import { safeReturnPath } from '@/shared/lib/format'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Brand } from '@/shared/ui/Brand'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { Icon } from '@/shared/ui/Icon'
import { AvatarCustomizer } from '@/features/profile/components/AvatarCustomizer'
import { avatarShades } from '@/features/profile/avatar-options'
import { FormField } from '@/shared/ui/FormField'

export default function OnboardingPage() {
  const { state, dispatch } = useDemo()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState(state.profile.name)
  const [avatar, setAvatar] = useState(state.profile.avatar)
  function finish() {
    dispatch({ type: 'PROFILE', name, avatar })
    navigate(safeReturnPath(params.get('next'), '/'))
  }
  return (
    <div className="min-h-dvh">
      <PageNavigation />
      <header className="flex h-[65px] items-center gap-5 border-b border-divider px-5 sm:px-8">
        <Link to="/" aria-label="CAPSULE 홈">
          <Brand />
        </Link>
        <span className="text-sm text-subtle">처음 설정 · 1/1</span>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="grid focus:outline-none lg:grid-cols-[minmax(0,620fr)_minmax(0,660fr)]"
      >
        <section
          className="onboarding-preview relative flex min-h-[340px] items-end justify-center overflow-hidden pb-10 lg:min-h-[794px]"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${avatarShades[avatar.background]}55, #111722 80%)`,
          }}
        >
          <span className="absolute top-6 left-6 flex items-center gap-2 rounded-full bg-panel/80 px-3.5 py-2 text-xs text-muted">
            <Icon name="sparkle" size={14} />
            나의 작은 공부 메이트
          </span>
          <div className="onboarding-figure">
            <AvatarIllustration settings={avatar} />
          </div>
          <span className="relative z-10 rounded-full bg-panel px-4 py-2 text-sm">
            내 아바타 · 캠을 끄면 이 모습이 보여요
          </span>
        </section>
        <form
          className="flex flex-col px-5 py-8 [--form-input-border:var(--color-line)] sm:px-12 lg:py-10"
          onSubmit={(event) => {
            event.preventDefault()
            finish()
          }}
        >
          <h1 className="text-[28px] font-bold">내 아바타 만들기</h1>
          <FormField label="이름" className="mt-6 max-w-[520px]">
            <input
              required
              maxLength={20}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="form-input"
            />
          </FormField>
          <div className="mt-5 max-w-[520px]">
            <AvatarCustomizer value={avatar} onChange={setAvatar} />
          </div>
          <p className="mt-3 text-sm text-subtle">
            선택한 파츠와 색을 미리 볼 수 있어요 · 데모 파츠
          </p>
          <div className="mt-6 flex items-center gap-3.5 rounded-[14px] bg-surface p-3.5">
            <Avatar size="lg" settings={avatar} />
            <p className="text-[15px]">이 모습이 프로필 이미지가 돼요</p>
          </div>
          <div className="mt-auto grid max-w-[520px] gap-3 pt-10 sm:grid-cols-[2fr_3fr]">
            <Button variant="secondary" onClick={finish}>
              나중에 바꿀게요
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              이 모습으로 시작
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
