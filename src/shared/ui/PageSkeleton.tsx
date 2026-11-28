import { Link } from 'react-router'
import type { SkeletonScreen } from '@/shared/lib/loading-screen'
import { AppFrame } from '@/app/layouts/AppFrame'
import { AppNavigation } from '@/app/components/AppNavigation'
import { SiteHeader } from '@/app/components/SiteHeader'
import { SiteFooter } from '@/app/components/SiteFooter'
import { CreditsAppWindow } from '@/features/credits/components/CreditsAppWindow'
import { CreditsSkeletonBody, InviteSkeletonBody } from '@/features/credits/components/CreditsSkeleton'
import { MyMatesSkeletonBody } from '@/features/mates/components/MyMatesSkeleton'
import { RecordsSkeletonBody } from '@/features/reports/components/RecordsSkeleton'
import { ConnectionRecordSkeletonBody } from '@/features/reports/components/ConnectionRecordSkeleton'
import { AppPanel } from './AppPanel'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { SkeletonLine } from './SkeletonLine'
import '@/features/auth/login-backgrounds/desktop/desktop.css'
import '@/features/home/home.css'
import '@/features/mates/mates.css'
import '@/features/mates/mate-detail.css'
import '@/features/mates/connections.css'
import '@/pages/onboarding.css'
import '@/features/profile/components/avatar-dial.css'
import './page-skeleton.css'

/**
 * The loading screen of each app route (RouteLoading: while start-up reads the account, and while a route's code
 * loads). Every screen is drawn on the real screen's own containers and classes (header, page grid, blocks), so the
 * placeholders sit where the content will, and a later redesign of a screen moves its skeleton with it. 내 메이트 ·
 * 내 기록 · 내 크레딧 · 친구 초대 · 연결 기록 share their body with the page's own loading state (one component each), so
 * the route's skeleton and the page's skeleton are the same picture.
 */
const labels: Record<SkeletonScreen, string> = {
  home: '홈 화면을 불러오고 있어요.',
  'my-mates': '내 메이트를 불러오고 있어요.',
  records: '함께한 기록을 불러오고 있어요.',
  credits: '크레딧 정보를 불러오고 있어요.',
  invite: '초대 정보를 불러오고 있어요.',
  onboarding: '프로필 선택 화면을 불러오고 있어요.',
  mate: '메이트를 불러오고 있어요.',
  connection: '연결 화면을 불러오고 있어요.',
  'connection-record': '연결 기록을 불러오고 있어요.',
}

/**
 * The header's right side as it is now (HeaderAccount): the credit chip with its coin, the bell, the avatar. Built on
 * their own classes, so their size and spacing follow the header's.
 */
function Account() {
  return (
    <div className="header-account ml-auto flex shrink-0 items-center gap-2 sm:gap-3.5">
      <span className="credit-chip">
        <span className="credit-coin inline-flex"><Icon name="coin" size={17} /></span>
        <SkeletonLine className="h-4 w-11" />
      </span>
      <span className="notification-bell"><span className="notification-bell-button"><SkeletonLine className="size-5 rounded-full" /></span></span>
      <span className="header-avatar-btn flex items-center justify-center rounded-full"><SkeletonLine className="size-7 rounded-full" /></span>
    </div>
  )
}

/** 메이트 상세 · 연결 기록: 「홈 › …」 with the page's name still to come. */
function DetailHeader() {
  return (
    <SiteHeader
      sticky
      navigation={<nav aria-label="현재 위치" className="detail-breadcrumb"><Link to="/">홈</Link><Icon name="chevron" size={14} /><SkeletonLine className="h-5 w-24" /></nav>}
      account={<Account />}
    />
  )
}

function Home() {
  return (
    <AppFrame navigation={<AppNavigation />} account={<Account />}>
      <section className="home-hero">
        <div className="home-hero-figure"><div className="page-skeleton-path"><SkeletonLine /></div></div>
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <div className="home-hero-title page-skeleton-title">
              <span><SkeletonLine className="w-[4.9em]" /></span>
              <span><SkeletonLine className="w-[3.6em]" /></span>
            </div>
            <div className="home-hero-sub"><span data-active><SkeletonLine className="mt-[0.35em] h-[0.9em] w-[19em] max-w-full" /></span></div>
            <SkeletonLine className="home-hero-cta home-hero-cta-pending min-h-14" />
          </div>
        </div>
      </section>
      <section className="home-mates">
        <div className="home-section-heading"><SkeletonLine className="h-7 w-56" /></div>
        <div className="home-mate-grid">
          <SkeletonLine className="page-skeleton-mate-card" />
          <SkeletonLine className="page-skeleton-mate-card" />
          {/* Like the 「?」 cards, these two give way first when the row is narrower. */}
          <span className="home-mate-slot" data-slot="2"><SkeletonLine className="page-skeleton-mate-card" /></span>
          <span className="home-mate-slot" data-slot="3"><SkeletonLine className="page-skeleton-mate-card" /></span>
        </div>
      </section>
    </AppFrame>
  )
}

function MyMates() {
  return (
    <AppFrame navigation={<AppNavigation />} account={<Account />}>
      <AppPanel title="내 메이트" hideTitle className="my-mates-window" bodyClassName="my-mates-window-body"><MyMatesSkeletonBody /></AppPanel>
    </AppFrame>
  )
}

function Records() {
  return (
    <AppFrame navigation={<AppNavigation />} account={<Account />}>
      <AppPanel title="함께한 기록" hideTitle className="records-window" bodyClassName="records-window-body"><RecordsSkeletonBody /></AppPanel>
    </AppFrame>
  )
}

function Credits({ invite }: { invite: boolean }) {
  return (
    <AppFrame navigation={<AppNavigation />} account={<Account />}>
      <CreditsAppWindow page={invite ? 'invite' : 'credits'} dashboard>{invite ? <InviteSkeletonBody /> : <CreditsSkeletonBody />}</CreditsAppWindow>
    </AppFrame>
  )
}

/** Step 1 of onboarding: the avatar arc and stage on the left, the form panel on the right. */
function Onboarding() {
  return (
    <div className="auth-panel-layout" data-app-header>
      <SiteHeader sticky variant="logo-only" />
      <section className="app-panel auth-panel-content">
        <div className="onboarding">
          <div className="onboarding-step-one">
            <div className="avatar-picker" data-layout="arc" data-size="large">
              <div className="avatar-arc page-skeleton-arc">
                <SkeletonLine className="size-14 rounded-full" />
                <SkeletonLine className="size-[88px] rounded-full" />
                <SkeletonLine className="size-14 rounded-full" />
              </div>
              <div className="avatar-picker-main">
                <div className="avatar-picker-stage"><SkeletonLine className="page-skeleton-avatar" /></div>
                <div className="avatar-picker-caption">
                  <SkeletonLine className="h-9 w-36" />
                  <SkeletonLine className="mt-2 h-5 w-64" />
                </div>
              </div>
            </div>
            <div className="onboarding-panel">
              <div className="onboarding-panel-body">
                <SkeletonLine raised className="h-4 w-16" />
                <SkeletonLine raised className="h-11 w-48" />
                <SkeletonLine raised className="h-6 w-56" />
                <SkeletonLine raised className="mt-2 h-4 w-14" />
                <SkeletonLine raised className="h-12 w-full" />
                <SkeletonLine raised className="h-[54px] w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Mate() {
  return (
    <div className="detail-shell min-h-dvh">
      <DetailHeader />
      <main className="mate-hero page-skeleton-mate">
        <div className="mate-hero-figure"><SkeletonLine className="page-skeleton-portrait" /></div>
        <section className="mate-hero-info page-container">
          <div className="mate-hero-copy">
            <SkeletonLine className="h-[0.9em] w-[2.4em] text-[clamp(56px,6vw,92px)]" />
            <SkeletonLine className="mt-5 h-7 w-4/5" />
            <SkeletonLine className="mt-6 h-6 w-3/5" />
            <SkeletonLine className="mt-3 h-6 w-full" />
            <div className="mate-hero-tiles">
              <SkeletonLine className="page-skeleton-tile" />
              <SkeletonLine className="page-skeleton-tile" />
            </div>
            <div className="mate-hero-actions"><SkeletonLine className="h-12 w-full" /></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

/** The call screen: the titlebar (logo · the mate | the info chips · the timer), the stage and the chat column. */
function Connection() {
  return (
    <main className="connection-page">
      <div className="connection-screen">
        <header className="desktop-window-titlebar mate-window-titlebar-static connection-titlebar">
          <div className="connection-titlebar-left">
            <span className="connection-titlebar-brand"><Brand /></span>
            <span className="connection-titlebar-divider" aria-hidden="true" />
            <SkeletonLine className="h-5 w-32" />
          </div>
          <div className="connection-titlebar-right">
            <SkeletonLine className="size-8 rounded-full" />
            <SkeletonLine className="h-8 w-[117px] rounded-full" />
            <SkeletonLine className="h-8 w-[194px] rounded-full" />
            <SkeletonLine className="h-8 w-[103px] rounded-full" />
            <SkeletonLine className="h-8 w-[97px]" />
          </div>
        </header>
        <div className="connection-content" data-chat>
          <div className="connection-stage-wrap">
            <SkeletonLine className="page-skeleton-stage" />
            <SkeletonLine raised className="page-skeleton-dock" />
          </div>
          <div className="page-skeleton-chat">
            <div className="flex items-center gap-3">
              <SkeletonLine raised className="size-10 rounded-full" />
              <div className="grid gap-2"><SkeletonLine raised className="h-4 w-16" /><SkeletonLine raised className="h-3.5 w-24" /></div>
            </div>
            <SkeletonLine raised className="mt-auto h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
    </main>
  )
}

function Record() {
  // Right after hanging up the record screen has no site header (ConnectionRecordPage `bare`); the router keeps the
  // navigation's state in history.state.usr.
  const bare = Boolean((window.history.state as { usr?: { hangup?: boolean } } | null)?.usr?.hangup)
  return (
    <div className="detail-shell min-h-dvh">
      {!bare && <DetailHeader />}
      <main className="connection-record-page" data-bare={bare || undefined}><ConnectionRecordSkeletonBody bare={bare} /></main>
      <SiteFooter />
    </div>
  )
}

function Content({ screen }: { screen: SkeletonScreen }) {
  switch (screen) {
    case 'home': return <Home />
    case 'my-mates': return <MyMates />
    case 'records': return <Records />
    case 'credits': return <Credits invite={false} />
    case 'invite': return <Credits invite />
    case 'onboarding': return <Onboarding />
    case 'mate': return <Mate />
    case 'connection': return <Connection />
    case 'connection-record': return <Record />
  }
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
