import { AppFrame } from '@/app/layouts/AppFrame'
import { AppNavigation } from '@/app/components/AppNavigation'
import { MvpGate } from '@/features/mvp/MvpGate'
import { welcomeCopy } from '@/features/rooms/welcome-copy'
import { Button } from './Button'
import { Icon } from './Icon'
import { SearchField } from './SearchField'
import './hover-scratch/scratch.css'

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

export function PageSkeleton({ label = '공부 공간을 불러오고 있어요…' }: { label?: string } = {}) {
  const copy = welcomeCopy.fresh
  return (
    <div role="status" aria-busy="true" className="page-skeleton">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" inert>
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
      </div>
    </div>
  )
}
