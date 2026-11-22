import { useEffect, useState } from 'react'
import type { SkeletonScreen } from '@/shared/lib/loading-screen'
import { AppFrame } from '@/app/layouts/AppFrame'
import { AppNavigation } from '@/app/components/AppNavigation'
import { SiteHeader } from '@/app/components/SiteHeader'
import { MenuBar } from '@/features/auth/login-backgrounds/desktop/MenuBar'
import {
  ONBOARDING_WINDOW_WIDTH,
  STATIC_FIRST_PAINT_WALLPAPERS,
  TIME_OF_DAY_PALETTES,
  getOnboardingWindowRect,
  resolveTimeBand,
  type TimeOfDayBand,
  type TimeOfDayMode,
} from '@/features/auth/login-backgrounds/desktop/desktop-config'
import { useDesktopShell } from '@/features/auth/login-backgrounds/desktop/desktop-shell-context'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import { Brand } from './Brand'
import { cn } from '@/shared/lib/cn'
import '@/features/mates/mates.css'
import '@/features/mates/connections.css'
import '@/pages/onboarding.css'
import '@/features/profile/components/avatar-dial.css'
import './page-skeleton.css'

const NOOP = () => {}
const VALID_TIME_MODES = new Set<TimeOfDayMode>(['auto', 'dawn', 'morning', 'day', 'sunset', 'night'])

function getSkeletonTimeBand(): TimeOfDayBand {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    try {
      const raw = new URLSearchParams(window.location.search).get('dTime') as TimeOfDayMode | null
      if (raw && VALID_TIME_MODES.has(raw)) return resolveTimeBand(raw)
    } catch {
      // ignore URL errors
    }
  }
  return resolveTimeBand('auto')
}

const labels: Record<SkeletonScreen, string> = {
  home: '홈 화면을 불러오고 있어요.',
  onboarding: '프로필 선택 화면을 불러오고 있어요.',
  mate: '메이트를 불러오고 있어요.',
  connection: '연결 화면을 불러오고 있어요.',
  'connection-record': '연결 기록을 불러오고 있어요.',
  room: '메이트를 불러오고 있어요.',
  prepare: '연결 화면을 불러오고 있어요.',
  study: '연결 화면을 불러오고 있어요.',
  report: '연결 기록을 불러오고 있어요.',
  capsule: '연결 기록을 불러오고 있어요.',
}

function Line({ className }: { className?: string }) {
  return <div className={cn('skeleton-line skeleton-block rounded-control', className)} />
}

function Account() {
  return (
    <div className="ml-auto flex items-center gap-5">
      <Line className="h-6 w-20" />
      <Line className="size-9 rounded-full" />
    </div>
  )
}

function Home() {
  return (
    <AppFrame navigation={<AppNavigation />} account={<Account />}>
      <section className="mate-welcome desktop-window desktop-window--active">
        <div className="desktop-window-titlebar mate-window-titlebar-static">
          <div className="desktop-window-title-left">
            <Line className="h-3.5 w-32" />
          </div>
          <div className="desktop-window-title-right">
            <div className="desktop-window-controls" aria-hidden="true">
              <span className="desktop-window-dot" />
              <span className="desktop-window-dot" />
              <span className="desktop-window-dot" />
            </div>
          </div>
        </div>
        <div className="desktop-window-body mate-welcome-body">
          <div className="mate-welcome-copy">
            <Line className="h-11 w-4/5" />
            <Line className="mt-4 h-11 w-full" />
            <Line className="mt-8 h-11 w-40" />
          </div>
          <div className="mate-welcome-stage p-6">
            <Line className="h-full w-full rounded-panel" />
          </div>
        </div>
      </section>
      <section className="mate-section">
        <Line className="h-7 w-64" />
        <div className="mate-grid">
          {[0, 1].map((id) => (
            <div key={id} className="mate-card desktop-window">
              <div className="desktop-window-titlebar mate-card-titlebar">
                <Line className="h-3.5 w-20" />
              </div>
              <Line className="mate-card-image" />
              <Line className="m-5 h-12" />
            </div>
          ))}
        </div>
      </section>
    </AppFrame>
  )
}

function OnboardingSkeletonBody() {
  return (
    <div className="onboarding-skeleton-inner">
      <Line className="h-7 w-32" />
      <div className="onboarding-skeleton-dial">
        <Line className="onboarding-skeleton-avatar rounded-full" />
        <Line className="h-4 w-20" />
        <div className="onboarding-skeleton-thumbs">
          {[0, 1, 2, 3, 4].map((idx) => (
            <Line
              key={idx}
              className={idx === 2 ? 'size-11 rounded-full' : 'size-9 rounded-full'}
            />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <Line className="mb-1.5 h-3.5 w-12" />
          <Line className="h-10 w-full" />
        </div>
        <div>
          <Line className="mb-1.5 h-3.5 w-16" />
          <div className="grid grid-cols-3 gap-2">
            <Line className="h-10 w-full" />
            <Line className="h-10 w-full" />
            <Line className="h-10 w-full" />
          </div>
        </div>
        <div>
          <Line className="mb-1.5 h-3.5 w-24" />
          <Line className="h-10 w-full" />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Line className="h-11 w-full rounded-control" />
        <Line className="mx-auto h-8 w-36 rounded-control" />
      </div>
    </div>
  )
}

function Onboarding() {
  const desktopShell = useDesktopShell()
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  }))

  useEffect(() => {
    if (!desktopShell) return
    desktopShell.setWindowConfig({
      windowKey: 'onboarding',
      windowTitle: 'CAPSULE — 프로필 설정',
      windowWidth: ONBOARDING_WINDOW_WIDTH,
      mode: 'onboarding',
      legalDocument: null,
      onCloseLegal: NOOP,
      hasErrorNotification: false,
      scrollResetKey: 'onboarding',
    })
  }, [desktopShell])

  useEffect(() => {
    if (desktopShell) return
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [desktopShell])

  // Inside DesktopAuthLayout, the persistent "CAPSULE — 프로필 설정" window already frames us.
  if (desktopShell) {
    return <OnboardingSkeletonBody />
  }

  // Standalone (e.g. /oauth/kakao while loading onboarding avatars): render matching desktop frame.
  const band = getSkeletonTimeBand()
  const palette = TIME_OF_DAY_PALETTES[band]
  const wallpaperUrl = STATIC_FIRST_PAINT_WALLPAPERS[band]
  const rect = getOnboardingWindowRect(viewport.w, viewport.h)
  const fallbackGradient = {
    background: `radial-gradient(ellipse 75% 58% at 50% 62%, ${palette.glow}38 0%, transparent 72%), linear-gradient(180deg, ${palette.top} 0%, ${palette.mid} 52%, ${palette.bottom} 100%)`,
  }

  return (
    <div className="desktop-login-root">
      <div className="desktop-wallpaper-layer" style={fallbackGradient} aria-hidden="true">
        <img
          src={wallpaperUrl}
          alt=""
          aria-hidden="true"
          className="desktop-wallpaper-static-img"
          draggable={false}
        />
      </div>
      <MenuBar />
      <section
        data-desktop-window="login-app"
        className="desktop-window desktop-window--active"
        style={{
          left: `${rect.x}px`,
          top: `${rect.y}px`,
          width: `${rect.width}px`,
          maxHeight: `${rect.maxHeight}px`,
          zIndex: 12,
        }}
      >
        <div className="desktop-window-titlebar" style={{ cursor: 'default' }}>
          <div className="desktop-window-title-left">CAPSULE — 프로필 설정</div>
          <div className="desktop-window-title-right">
            <div className="desktop-window-controls" aria-hidden="true">
              <span className="desktop-window-dot" />
              <span className="desktop-window-dot" />
              <span className="desktop-window-dot" />
            </div>
          </div>
        </div>
        <div className="desktop-window-body desktop-login-window-body desktop-login-window-body--onboarding">
          <OnboardingSkeletonBody />
        </div>
      </section>
    </div>
  )
}

function Mate() {
  return (
    <>
      <SiteHeader sticky navigation={<Line className="h-6 w-32" />} account={<Account />} />
      <main className="page-container mate-detail">
        <div className="mate-detail-overview">
          <Line className="h-[500px] rounded-panel" />
          <div>
            <Line className="h-14 w-32" />
            <Line className="mt-6 h-6 w-full" />
            <Line className="mt-8 h-12 w-40" />
          </div>
        </div>
      </main>
    </>
  )
}

function Connection() {
  return (
    <main className="connection-page">
      <header className="connection-header">
        <Brand />
        <Line className="h-6 w-32" />
        <Line className="ml-auto h-6 w-60" />
      </header>
      <div className="connection-content" data-chat>
        <div className="connection-stage">
          <Line className="h-full rounded-panel" />
        </div>
        <Line className="h-full rounded-panel" />
      </div>
      <div className="connection-controls">
        {[0, 1, 2, 3, 4].map((id) => (
          <Line key={id} className="h-11 w-24" />
        ))}
      </div>
    </main>
  )
}

function Record() {
  return (
    <main className="page-container connection-record">
      <Line className="h-[60dvh] rounded-panel" />
      <div>
        <Line className="h-12 w-80" />
        <Line className="mt-6 h-6 w-48" />
        <div className="my-8 grid grid-cols-2 gap-8">
          {[0, 1, 2, 3].map((id) => (
            <Line key={id} className="h-20" />
          ))}
        </div>
        <Line className="h-12 w-64" />
      </div>
    </main>
  )
}

function Content({ screen }: { screen: SkeletonScreen }) {
  if (screen === 'home') return <Home />
  if (screen === 'onboarding') return <Onboarding />
  if (screen === 'mate' || screen === 'room') return <Mate />
  if (screen === 'connection' || screen === 'study' || screen === 'prepare') return <Connection />
  return <Record />
}

export function PageSkeleton({
  screen,
  label = labels[screen],
}: {
  screen: SkeletonScreen
  label?: string
}) {
  return (
    <div role="status" aria-busy="true" data-loading-screen={screen} className="page-skeleton">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" inert>
        <Content screen={screen} />
      </div>
    </div>
  )
}
