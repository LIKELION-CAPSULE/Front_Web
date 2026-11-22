import { useEffect, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { CreditsAppWindow } from '@/features/credits/components/CreditsAppWindow'
import {
  CREDIT_PRICING,
  attendanceBarRatio,
  formatSeoulTime,
  groupCreditEntriesByDate,
} from '@/features/credits/credit-utils'
import { useNow } from '@/features/session/use-now'
import { Button } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { clock, number } from '@/shared/lib/format'

function isReviewCreditsLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'credits-loading'
  )
}

export default function CreditsPage() {
  const { wallet, status, reload } = useBackend()
  const now = useNow()
  const [filter, setFilter] = useState('all')
  const loading = status === 'loading' || isReviewCreditsLoading()

  useEffect(() => {
    void import('@/pages/InvitePage')
  }, [])

  if (loading) {
    return (
      <CreditsAppWindow activeTab="credits" loadingScreen="credits">
        <div className="credits-skeleton-stack" aria-busy="true">
          <span className="sr-only" role="status">
            크레딧 정보를 불러오고 있어요.
          </span>
          <div className="credits-skeleton-row" aria-hidden="true">
            <span className="skeleton-line credits-skeleton-card" />
            <span className="skeleton-line credits-skeleton-card" />
            <span className="skeleton-line credits-skeleton-card" />
          </div>
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" aria-hidden="true" />
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--mid" aria-hidden="true" />
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" aria-hidden="true" />
        </div>
      </CreditsAppWindow>
    )
  }

  if (!wallet) {
    return (
      <CreditsAppWindow activeTab="credits">
        <div className="credits-state-box" role="alert">
          <p className="credits-state-title">크레딧 정보를 불러오지 못했어요.</p>
          <Button
            onClick={() => {
              void reload()
            }}
          >
            다시 시도
          </Button>
        </div>
      </CreditsAppWindow>
    )
  }

  const totalRemaining = wallet.attendance + wallet.invitation
  const attendancePct = Math.round(attendanceBarRatio(wallet.attendance) * 100)
  const remainingSeconds = Math.max(0, (wallet.attendanceExpiresAt - now) / 1000)

  const filteredEntries = wallet.entries.filter(
    (entry) =>
      filter === 'all' ||
      entry.kind === filter ||
      (filter === 'attendance' && entry.kind === 'expiration'),
  )
  const groupedEntries = groupCreditEntriesByDate(filteredEntries)

  return (
    <CreditsAppWindow activeTab="credits">
      <div className="credits-summary-grid">
        <section className="credits-stat-card credits-stat-card--primary" aria-label="오늘 남은 크레딧">
          <div className="credits-stat-head">
            <h2>오늘 남은 크레딧</h2>
          </div>
          <p className="credits-stat-value">{number(totalRemaining)}</p>
          <div className="credits-attendance-track" aria-hidden="true">
            <div className="credits-attendance-fill" style={{ width: `${attendancePct}%` }} />
          </div>
          <p className="credits-attendance-meta">
            출석분 {number(wallet.attendance)} · 오전 5시까지 {clock(remainingSeconds)}
          </p>
        </section>

        <section className="credits-stat-card" aria-label="초대 크레딧">
          <div className="credits-stat-head">
            <h2>초대 크레딧</h2>
            <span className="credits-stat-tag">쌓임</span>
          </div>
          <p className="credits-stat-value">{number(wallet.invitation)}</p>
        </section>

        <section className="credits-stat-card" aria-label="오늘 쓴 크레딧">
          <div className="credits-stat-head">
            <h2>오늘 쓴 크레딧</h2>
          </div>
          <p className="credits-stat-value">{number(wallet.usedToday)}</p>
        </section>
      </div>

      <div className="credits-pricing-strip" aria-label="크레딧 사용 안내">
        <span className="credits-pricing-label">어디에 쓰이나요</span>
        <div className="credits-pricing-chips">
          <span className="credits-pricing-chip">기본 채팅 {CREDIT_PRICING.basicChat}</span>
          <span className="credits-pricing-chip">보이스 {CREDIT_PRICING.voice}</span>
          <span className="credits-pricing-chip">고급 {CREDIT_PRICING.advanced}</span>
          <span className="credits-pricing-chip">보이스+고급 {CREDIT_PRICING.voiceAndAdvanced}</span>
        </div>
      </div>

      <section className="credits-history" aria-label="크레딧 내역">
        <Tabs
          label="크레딧 내역 필터"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: '전체' },
            { id: 'attendance', label: '출석' },
            { id: 'invite', label: '초대' },
            { id: 'use', label: '사용' },
          ]}
        />

        {wallet.entries.length === 0 ? (
          <p className="credits-empty-box">
            아직 내역이 없어요. 매일 오전 5시에 출석 크레딧 {number(CREDIT_PRICING.dailyAttendance)}이 들어와요.
          </p>
        ) : filteredEntries.length === 0 ? (
          <p className="credits-empty-box">선택한 항목의 내역이 없어요.</p>
        ) : (
          <div className="credits-history-list">
            {groupedEntries.map((group) => (
              <div key={group.dateKey} className="credits-date-group">
                <h3 className="credits-date-heading">{group.dateHeading}</h3>
                <ul className="credits-entry-list">
                  {group.entries.map((entry) => {
                    const positive = entry.change > 0
                    return (
                      <li key={entry.id} className="credits-entry-row">
                        <div className="credits-entry-left">
                          <span className="credits-entry-desc">{entry.description}</span>
                          <time className="credits-entry-time" dateTime={new Date(entry.at).toISOString()}>
                            {formatSeoulTime(entry.at)}
                          </time>
                        </div>
                        <div className="credits-entry-right">
                          <span className="credits-entry-change" data-positive={positive || undefined}>
                            {positive ? '+' : '−'}
                            {number(Math.abs(entry.change))}
                          </span>
                          <span className="credits-entry-balance">잔액 {number(entry.balance)}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </CreditsAppWindow>
  )
}
