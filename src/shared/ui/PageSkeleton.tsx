import type { CSSProperties } from 'react'
import { AppFrame } from '@/app/layouts/AppFrame'
import { AppNavigation } from '@/app/components/AppNavigation'
import { SiteHeader } from '@/app/components/SiteHeader'
import { MvpGate } from '@/features/mvp/MvpGate'
import { welcomeCopy } from '@/features/rooms/welcome-copy'
import type { SkeletonScreen } from '@/shared/lib/loading-screen'
import { cn } from '@/shared/lib/cn'
import { Button } from './Button'
import { Brand } from './Brand'
import { FormField } from './FormField'
import { Icon } from './Icon'
import { OverlayPage } from './OverlayPage'
import { SearchField } from './SearchField'
import './hover-scratch/scratch.css'
import '@/pages/onboarding.css'
import '@/features/profile/components/avatar-dial.css'
import '@/features/reports/report-completion.css'
import '@/features/rooms/components/room-detail-banner.css'
import '@/features/session/study-grid.css'
import '@/features/session/session-chat.css'
import './page-skeleton.css'

const labels: Record<SkeletonScreen, string> = {
  home: '홈 화면을 불러오고 있어요.', onboarding: '프로필 선택 화면을 불러오고 있어요.',
  room: '스터디룸을 불러오고 있어요.', prepare: '공부 설정을 불러오고 있어요.',
  study: '공부 화면을 불러오고 있어요.', report: '공부 리포트를 불러오고 있어요.', capsule: '캡슐 카드를 불러오고 있어요.',
}

function Line({ className }: { className?: string }) {
  return <div className={cn('skeleton-line skeleton-block rounded-control', className)} />
}

function AccountSkeleton() {
  return <div className="header-account ml-auto flex shrink-0 items-center gap-2 sm:gap-5">
    <MvpGate label="내 크레딧 · 충전" compact inline>
      <span className="credit-chip skeleton-line">
        <Icon name="coin" size={16} className="invisible" />
        <span className="invisible font-sans tabular-nums text-body-compact font-bold text-ink">—</span>
      </span>
    </MvpGate>
    <div className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full">
      <span className="skeleton-line size-9 rounded-full" />
    </div>
  </div>
}

function HomeSkeleton() {
  const copy = welcomeCopy.fresh
  return (
        <AppFrame navigation={<AppNavigation />} account={<AccountSkeleton />}>
          <section className="welcome-hero">
            <div className="scratch-media skeleton-line" />
            <div className="welcome-copy">
              <h1 className="type-hero-title skeleton-line rounded-control"><span className="invisible">{copy.title}<br />{copy.accent}</span></h1>
              <p className="welcome-description skeleton-line rounded-control"><span className="invisible">{copy.description}</span></p>
              <p className="mt-3 text-body-compact text-muted skeleton-line rounded-control"><span className="invisible">오늘 함께 공부한 시간 0분</span></p>
              <div className="welcome-actions">
                <Button className="skeleton-line"><span className="invisible">스터디룸 둘러보기</span><Icon name="arrow" size={18} className="invisible rotate-90" /></Button>
              </div>
            </div>
          </section>
          <section className="rooms-section">
            <div className="section-heading">
              <div>
                <h2 className="type-section-title skeleton-line rounded-control"><span className="invisible">오늘은 어디서 공부할까요?{' '}<span className="ml-1 text-label font-normal text-subtle">3</span></span></h2>
              </div>
              <div className="room-toolbar">
                <div className="room-filters">
                  <button type="button" className="skeleton-line"><Icon name="book" size={15} className="invisible" /><span className="invisible">모든 스터디룸</span></button>
                  <button type="button" className="skeleton-line"><Icon name="bookmark" size={15} className="invisible" /><span className="invisible">저장한 스터디룸</span><span className="filter-count invisible">0</span></button>
                </div>
                <SearchField label="스터디룸 검색" placeholder="스터디룸·친구 이름 검색" value="" onChange={() => undefined} className="room-search skeleton-line" />
              </div>
            </div>
            <div className="rooms-grid">
              {[0, 1, 2].map(index => <article key={index} className="room-card"><div className="room-card-art skeleton-line" /></article>)}
            </div>
          </section>
        </AppFrame>
  )
}

function OnboardingSkeleton() {
  return <div className="onboarding-page avatar-background min-h-dvh">
    <SiteHeader navigation={null} account={null} />
    <main id="main-content" className="page-container onboarding-main">
      <h1 className="onboarding-title type-page-title skeleton-line rounded-control"><span className="invisible">프로필 선택</span></h1>
      <div className="onboarding-form">
        <div className="avatar-dial">
          <div className="avatar-dial-stage">
            <figure className="avatar-dial-preview">
              <div className="avatar-dial-portrait skeleton-line" />
              <figcaption><span className="invisible">기본 아바타</span></figcaption>
            </figure>
            <div className="avatar-dial-orbit" />
            {Array.from({ length: 7 }, (_, index) => <div key={index} className="avatar-dial-hole skeleton-line skeleton-avatar-option" style={{ '--skeleton-index': index } as CSSProperties} />)}
          </div>
        </div>
        <div className="onboarding-details">
          <FormField label="닉네임"><div className="form-input skeleton-line h-[50px]" /></FormField>
          <div className="onboarding-actions">
            <Button className="skeleton-line w-full"><span className="invisible">이 모습으로 시작하기</span></Button>
            <Button variant="ghost" size="sm" className="onboarding-default-action skeleton-line w-full"><span className="invisible">기본 아바타로 시작하기</span></Button>
          </div>
        </div>
      </div>
    </main>
  </div>
}

function RoomSkeleton() {
  return <div className="min-h-dvh bg-canvas">
    <SiteHeader navigation={<div className="detail-breadcrumb"><Line className="h-5 w-40" /></div>} account={<AccountSkeleton />} />
    <main id="main-content" className="room-detail-page">
      <section className="room-detail-hero">
        <div className="room-detail-backdrop skeleton-line" />
        <div className="page-container room-detail-hero-content">
          <div className="room-detail-heading"><Line className="h-14 w-full" /><Line className="mt-3 h-14 w-3/4" /></div>
          <div className="room-detail-hero-footer"><Line className="h-12 w-[216px] max-w-full room-detail-start" /><Line className="h-12 w-28 room-detail-save" /></div>
        </div>
      </section>
      <div className="page-container room-detail-content">
        <aside className="room-detail-sidebar"><div className="room-detail-poster skeleton-line" /></aside>
        <div className="room-detail-main">
          <section className="room-detail-introduction"><Line className="mb-4 h-[18px] w-16" /><Line className="h-7 w-4/5" /></section>
          <section className="room-detail-friends"><Line className="mb-5 h-7 w-48" /><div className="room-detail-characters">{[0, 1, 2].map(index => <Line key={index} className="h-48 rounded-control" />)}</div></section>
        </div>
      </div>
    </main>
  </div>
}

function PrepareSkeleton() {
  return <OverlayPage backTo="/" className="sm:py-9" headerClassName="mb-0" headerAside={<Line className="h-12 w-36" />}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><Line className="h-10 w-60 max-w-full" /><Line className="ml-auto h-4 w-52 max-w-full" /></div>
    <div className="mt-5 rounded-card bg-panel p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col items-center gap-2 sm:col-start-2"><Line className="h-5 w-28 max-w-full" /><Line className="h-10 w-16 max-w-full" /></div>
        <Line className="col-start-2 row-start-1 h-10 w-28 justify-self-end sm:col-start-3" />
      </div>
      <Line className="mt-5 h-11" />
    </div>
    <Line className="mt-6 h-7 w-32" /><Line className="mt-3 h-52" /><Line className="mt-5 h-12" />
  </OverlayPage>
}

function StudySkeleton() {
  return <main id="main-content" className="study-shell">
    <header className="study-topbar">
      <a><Brand /></a><div className="study-room-heading"><Line className="w-40 max-w-full" /></div><div className="study-header-actions"><Line className="size-9" /></div><div className="study-session-stats"><Line className="h-8 w-48 max-w-full" /></div>
    </header>
    <div className="study-workspace"><div className="study-stage"><div className="study-grid is-one-to-one is-focus" style={{ '--study-thumbnail-count': 1 } as CSSProperties}><div className="character-tile focus-tile skeleton-line" /><div className="self-tile skeleton-line" /></div></div></div>
  </main>
}

function ReportSkeleton() {
  return <main id="main-content" className="report-scene">
    <div className="report-layout">
      <div className="report-companion"><Line className="skeleton-report-portrait mx-auto w-4/5 rounded-panel" /><section className="report-dialogue report-glass"><Line className="w-24" /><Line className="mt-4 w-full" /><Line className="mt-2 w-3/4" /></section></div>
      <section className="report-content report-glass">
        <header className="report-overview"><div className="report-summary"><Line className="h-10 w-4/5" /><Line className="mt-6 h-8" /><Line className="mt-3 w-2/3" /></div><div className="report-context"><Line className="h-5 w-24" /><Line className="size-20 rounded-full" /></div></header>
        <div className="report-stats">{[0, 1, 2].map(index => <div key={index}><Line className="w-16" /><Line className="mt-2 h-9 w-20" /></div>)}</div>
        <div className="report-levels"><Line className="h-24" /></div><div className="report-actions"><Line className="h-12" /><Line className="h-12" /></div>
      </section>
    </div>
  </main>
}

function CapsuleSkeleton() {
  return <main id="main-content" className="capsule-share-page">
    <Line className="skeleton-capsule-card rounded-3xl" />
    <section className="w-full max-w-[440px] rounded-3xl bg-panel p-7"><Line className="h-10 w-40" /><Line className="mt-6 h-8 w-40" /><Line className="mt-6 h-12" /><Line className="mt-3 h-12" /><Line className="mt-6 h-36" /></section>
  </main>
}

function SkeletonContent({ screen }: { screen: SkeletonScreen }) {
  switch (screen) {
    case 'home': return <HomeSkeleton />
    case 'onboarding': return <OnboardingSkeleton />
    case 'room': return <RoomSkeleton />
    case 'prepare': return <PrepareSkeleton />
    case 'study': return <StudySkeleton />
    case 'report': return <ReportSkeleton />
    case 'capsule': return <CapsuleSkeleton />
  }
}

export function PageSkeleton({ screen, label = labels[screen] }: { screen: SkeletonScreen; label?: string }) {
  return <div role="status" aria-busy="true" data-loading-screen={screen} className="page-skeleton">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" inert>
      <SkeletonContent screen={screen} />
    </div>
  </div>
}
