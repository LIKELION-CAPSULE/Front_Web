import { useEffect, useState } from 'react'
import { CreditsAppWindow } from '@/features/credits/components/CreditsAppWindow'
import { CreditHeroArt } from '@/features/credits/components/CreditArt'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'
import { CREDIT_FILTERS, type CreditEntry, type CreditKind } from '@/features/credits/credits-data'
import { useCreditActivity, useCreditSummary } from '@/features/credits/use-credits'
import type { CreditTransactionFilter } from '@/shared/api/types'
import { useCreditDisplay } from '@/features/attendance/use-credit-display'
import { useNow } from '@/features/session/use-now'
import { Button } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { Tabs } from '@/shared/ui/Tabs'
import { clock, number } from '@/shared/lib/format'

/** Each ledger kind's icon in the activity list. */
const KIND_ICON: Record<CreditKind, IconName> = { attendance: 'calendar', use: 'coin', invite: 'gift', expiration: 'clock', other: 'coin' }
/** A use names what it paid for (「메이트 음성 · 채린」); the voice gets its own icon. */
const entryIcon = (entry: CreditEntry): IconName => (entry.kind === 'use' && entry.title.includes('음성') ? 'headphones' : KIND_ICON[entry.kind])

const DAY_LABEL = new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
const TIME_LABEL = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** The list as the timeline draws it: one group per local day, in the server's order (newest first). */
function groupByDay(entries: readonly CreditEntry[]) {
  const days: { key: string; at: number; entries: CreditEntry[] }[] = []
  for (const entry of entries) {
    const key = new Date(entry.at).toDateString()
    const last = days.at(-1)
    if (last?.key === key) last.entries.push(entry)
    else days.push({ key, at: entry.at, entries: [entry] })
  }
  return days
}

/**
 * 내 크레딧 (SCR-30), from the server: the balance card from 33 (what is left, split into today's attendance part and
 * the invite part, and what was used today) and the activity list from 34 by day (the server's filters, 20 at a time
 * with 「더 많은 활동 기록 보기」).
 */
export default function CreditsPage() {
  const summary = useCreditSummary()
  const [filter, setFilter] = useState<CreditTransactionFilter>('ALL')
  const activity = useCreditActivity(filter)
  const { value: displayTotal } = useCreditDisplay()
  const now = useNow()
  const loading = summary.status === 'loading'

  useEffect(() => {
    void import('@/pages/InvitePage')
  }, [])

  if (loading) {
    return (
      <CreditsAppWindow page="credits" loadingScreen="credits" dashboard>
        <div className="credits-skeleton-stack" aria-busy="true">
          <span className="sr-only" role="status">
            크레딧 정보를 불러오고 있어요.
          </span>
          <span className="skeleton-line credits-skeleton-hero" aria-hidden="true" />
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" aria-hidden="true" />
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" aria-hidden="true" />
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--mid" aria-hidden="true" />
        </div>
      </CreditsAppWindow>
    )
  }

  if (summary.status === 'error') {
    return (
      <CreditsAppWindow page="credits">
        <div className="credits-state-box" role="alert">
          <p className="credits-state-title">크레딧 정보를 불러오지 못했어요.</p>
          <Button onClick={summary.retry}>다시 시도</Button>
        </div>
      </CreditsAppWindow>
    )
  }

  const wallet = summary.data
  const total = displayTotal ?? wallet.remaining
  const remainingSeconds = wallet.attendanceExpiresAt === null ? null : Math.max(0, (wallet.attendanceExpiresAt - now) / 1000)
  const days = groupByDay(activity.entries)

  return (
    <CreditsAppWindow page="credits" dashboard>
      <div className="credits-top">
        <div className="credits-intro">
          <p className="credits-intro-title type-page-title" aria-hidden="true">내 크레딧</p>
          <p className="credits-intro-sub">CAPSULE에서 모은 크레딧을 확인해 보세요.</p>
        </div>

        {/* What is left: today's attendance part (gone at 5am) plus the invite part (kept), and today's use. */}
        <section className="credits-hero" aria-labelledby="credits-hero-title">
          <div className="credits-hero-copy">
            <h2 id="credits-hero-title" className="credits-hero-eyebrow">
              <span className="credit-coin inline-flex"><Icon name="coin" size={18} /></span>
              남은 크레딧
            </h2>
            <p className="credits-hero-total">
              {number(total)}
              <span className="credits-unit">크레딧</span>
            </p>
            <dl className="credits-hero-stats">
              <div className="credits-stat">
                <span className="credits-stat-icon" aria-hidden="true"><Icon name="calendar" size={20} /></span>
                <dt>출석 크레딧</dt>
                <dd className="credits-stat-value">{number(wallet.attendance)} 크레딧</dd>
                <dd className="credits-stat-note">
                  오전 5시 만료{remainingSeconds !== null && ` · ${clock(remainingSeconds)} 남음`}
                </dd>
              </div>
              <div className="credits-stat">
                <span className="credits-stat-icon" aria-hidden="true"><Icon name="gift" size={20} /></span>
                <dt>초대 크레딧</dt>
                <dd className="credits-stat-value">{number(wallet.invite)} 크레딧</dd>
                <dd className="credits-stat-note">사라지지 않아요</dd>
              </div>
              <div className="credits-stat">
                <span className="credits-stat-icon" aria-hidden="true"><Icon name="coin" size={20} /></span>
                <dt>오늘 사용</dt>
                <dd className="credits-stat-value">{wallet.todayUsed > 0 ? '−' : ''}{number(wallet.todayUsed)} 크레딧</dd>
              </div>
            </dl>
          </div>
          <CreditHeroArt />
        </section>
      </div>

      {/* Every change, newest first and by day (an attendance expiry included), a server page at a time. */}
      <section className="credits-activity" aria-labelledby="credits-activity-title" aria-busy={activity.status === 'loading' || activity.more === 'loading'}>
        <h2 id="credits-activity-title" className="credits-activity-title">
          <Icon name="clock" size={22} />
          크레딧 활동 기록
        </h2>
        <Tabs label="크레딧 활동 필터" size="sm" value={filter} onChange={value => setFilter(value as CreditTransactionFilter)} options={CREDIT_FILTERS} />

        {activity.status === 'loading' ? (
          <div className="credits-activity-skeleton" aria-hidden="true">
            <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" />
            <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" />
            <span className="skeleton-line credits-skeleton-line credits-skeleton-line--mid" />
          </div>
        ) : activity.status === 'error' ? (
          <div className="credits-empty-box credits-activity-error" role="alert">
            <p>크레딧 내역을 불러오지 못했어요.</p>
            <Button size="sm" variant="secondary" onClick={activity.retry}>다시 시도</Button>
          </div>
        ) : activity.entries.length === 0 ? (
          <p className="credits-empty-box">
            {filter === 'ALL'
              ? `아직 내역이 없어요. 매일 출석하면 ${number(CREDIT_PRICING.dailyAttendance)} 크레딧이 들어와요.`
              : '선택한 항목의 내역이 없어요.'}
          </p>
        ) : (
          <>
            <ol className="credits-days">
              {days.map(day => (
                <li key={day.key} className="credits-day">
                  <p className="credits-day-label">{DAY_LABEL.format(day.at)}</p>
                  <ul className="credits-day-entries">
                    {day.entries.map(entry => {
                      const positive = entry.change > 0
                      return (
                        <li key={entry.id} className="credits-entry" data-kind={entry.kind}>
                          <span className="credits-entry-icon" aria-hidden="true">
                            <Icon name={entryIcon(entry)} size={20} />
                          </span>
                          <span className="credits-entry-copy">
                            <span className="credits-entry-title">{entry.title}</span>
                            <span className="credits-entry-meta">
                              <time dateTime={new Date(entry.at).toISOString()}>{TIME_LABEL.format(entry.at)}</time>
                              {entry.balance !== null && ` · 잔액 ${number(entry.balance)} 크레딧`}
                            </span>
                          </span>
                          <span className="credits-entry-change" data-positive={positive || undefined}>
                            {positive ? '+' : '−'}
                            {number(Math.abs(entry.change))}
                            <span className="credits-entry-unit"> 크레딧</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ol>
            {(activity.hasMore || activity.more === 'error') && (
              <div className="credits-activity-foot">
                {activity.more === 'error' && <p className="credits-activity-more-error" role="alert">더 불러오지 못했어요.</p>}
                <Button size="sm" variant="secondary" loading={activity.more === 'loading'} onClick={() => { void activity.loadMore() }}>
                  {activity.more === 'error' ? '다시 시도' : '더 많은 활동 기록 보기'}
                  <Icon name="chevron" size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </CreditsAppWindow>
  )
}
