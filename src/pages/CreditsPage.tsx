import { useEffect, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { CreditsAppWindow } from '@/features/credits/components/CreditsAppWindow'
import { CREDIT_PRICING, attendanceBarRatio } from '@/features/credits/credit-utils'
import type { BetaCreditEntry } from '@/features/credits/beta-types'
import { useNow } from '@/features/session/use-now'
import { Button } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { clock, dateLabel, number } from '@/shared/lib/format'

/** The ledger's 구분 badge for each entry kind. */
const KIND_LABEL: Record<BetaCreditEntry['kind'], string> = { attendance: '출석', use: '사용', invite: '초대', expiration: '소멸' }

function isReviewCreditsLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'credits-loading'
  )
}

export default function CreditsPage() {
  const { wallet, invitation, status, reload } = useBackend()
  const now = useNow()
  const [filter, setFilter] = useState('all')
  const loading = status === 'loading' || isReviewCreditsLoading()

  useEffect(() => {
    void import('@/pages/InvitePage')
  }, [])

  if (loading) {
    return (
      <CreditsAppWindow page="credits" loadingScreen="credits">
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
      <CreditsAppWindow page="credits">
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

  return (
    <CreditsAppWindow page="credits">
      {/* ②③④ Today's balance (attendance + invite), the invite credits that stay, and what today used. */}
      <div className="credits-summary-grid">
        <section className="credits-stat-card credits-stat-card--primary" aria-label="오늘 남은 크레딧">
          <h2>오늘 남은 크레딧 · 오전 5시에 사라져요</h2>
          <p className="credits-stat-value">{number(totalRemaining)}</p>
          <div className="credits-attendance-track" aria-hidden="true">
            <div className="credits-attendance-fill" style={{ width: `${attendancePct}%` }} />
          </div>
          <p className="credits-attendance-meta">
            출석분 {number(wallet.attendance)} · 오전 5시까지 {clock(remainingSeconds)}
          </p>
        </section>

        <section className="credits-stat-card" aria-label="초대 크레딧">
          <h2>초대 크레딧 · 쌓여요</h2>
          <p className="credits-stat-value credits-stat-value--sub">
            {number(wallet.invitation)}
            {invitation && <span> · 친구 {number(invitation.invitedCount)}명 초대</span>}
          </p>
        </section>

        <section className="credits-stat-card" aria-label="오늘 쓴 크레딧">
          <h2>오늘 쓴 크레딧</h2>
          <p className="credits-stat-value">{number(wallet.usedToday)}</p>
        </section>
      </div>

      {/* ⑤⑥⑦ The ledger: filter, then one row per change (an attendance expiry included). */}
      <section className="credits-history" aria-label="크레딧 내역">
        <Tabs
          label="크레딧 내역 필터"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: '전체' },
            { id: 'attendance', label: '출석' },
            { id: 'use', label: '사용' },
            { id: 'invite', label: '초대' },
          ]}
        />

        {wallet.entries.length === 0 ? (
          <p className="credits-empty-box">
            아직 내역이 없어요. 매일 오전 5시에 출석 크레딧 {number(CREDIT_PRICING.dailyAttendance)}이 들어와요.
          </p>
        ) : filteredEntries.length === 0 ? (
          <p className="credits-empty-box">선택한 항목의 내역이 없어요.</p>
        ) : (
          <div className="credits-ledger-wrap">
            <table className="credits-ledger">
              <thead>
                <tr>
                  <th scope="col">일시</th>
                  <th scope="col">내용</th>
                  <th scope="col">구분</th>
                  <th scope="col">변동</th>
                  <th scope="col">잔액</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const positive = entry.change > 0
                  return (
                    <tr key={entry.id}>
                      <td className="credits-ledger-time">
                        <time dateTime={new Date(entry.at).toISOString()}>{dateLabel(entry.at, true)}</time>
                      </td>
                      <td className="credits-ledger-desc">{entry.description}</td>
                      <td>
                        <span className="credits-kind-badge" data-kind={entry.kind}>{KIND_LABEL[entry.kind]}</span>
                      </td>
                      <td className="credits-ledger-change" data-positive={positive || undefined}>
                        {positive ? '+' : '−'}
                        {number(Math.abs(entry.change))}
                      </td>
                      <td className="credits-ledger-balance">{number(entry.balance)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </CreditsAppWindow>
  )
}
