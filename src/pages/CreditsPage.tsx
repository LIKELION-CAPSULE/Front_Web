import { useEffect, useState } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { CreditsAppWindow, INVITE_PATH } from '@/features/credits/components/CreditsAppWindow'
import { CreditAttendanceArt, CreditHeroArt, CreditInviteArt } from '@/features/credits/components/CreditArt'
import { CREDIT_PRICING, attendanceBarRatio } from '@/features/credits/credit-utils'
import type { BetaCreditEntry } from '@/features/credits/beta-types'
import { useAttendance } from '@/features/attendance/use-attendance'
import { useCreditDisplay } from '@/features/attendance/use-credit-display'
import { useNow } from '@/features/session/use-now'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { Tabs } from '@/shared/ui/Tabs'
import { clock, dateLabel, number } from '@/shared/lib/format'

/** Each ledger kind's icon in the activity list. */
const KIND_ICON: Record<BetaCreditEntry['kind'], IconName> = { attendance: 'calendar', use: 'coin', invite: 'gift', expiration: 'clock' }

/** The activity filters: 적립 is everything that came in (attendance and invites). */
const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'earn', label: '적립' },
  { id: 'use', label: '사용' },
  { id: 'expiration', label: '만료' },
] as const
type FilterId = (typeof FILTERS)[number]['id']

function matches(entry: BetaCreditEntry, filter: FilterId): boolean {
  if (filter === 'all') return true
  if (filter === 'earn') return entry.kind === 'attendance' || entry.kind === 'invite'
  return entry.kind === filter
}

/** Rows shown before 「전체 보기」. */
const PREVIEW_ROWS = 5

function isReviewCreditsLoading(): boolean {
  return (
    import.meta.env.DEV &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reviewScenario === 'credits-loading'
  )
}

export default function CreditsPage() {
  const { wallet, invitation, status, reload } = useBackend()
  const { value: displayTotal } = useCreditDisplay()
  const attendance = useAttendance()
  const now = useNow()
  const [filter, setFilter] = useState<FilterId>('all')
  const [expanded, setExpanded] = useState(false)
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
          <span className="skeleton-line credits-skeleton-hero" aria-hidden="true" />
          <div className="credits-skeleton-row" aria-hidden="true">
            <span className="skeleton-line credits-skeleton-card" />
            <span className="skeleton-line credits-skeleton-card" />
          </div>
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--wide" aria-hidden="true" />
          <span className="skeleton-line credits-skeleton-line credits-skeleton-line--mid" aria-hidden="true" />
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

  const total = displayTotal ?? wallet.attendance + wallet.invitation
  const attendancePct = Math.round(attendanceBarRatio(wallet.attendance) * 100)
  const remainingSeconds = Math.max(0, (wallet.attendanceExpiresAt - now) / 1000)

  // 출석 보상: today's reward until checked in, then what today gave.
  const { state: attendanceState, isLoading: attendanceLoading } = attendance
  const rewardIndex = attendanceState.checkedToday ? attendanceState.cycleDay - 1 : attendanceState.cycleDay
  const reward = attendanceState.rewards[Math.max(0, rewardIndex)]
  const invitedCount = invitation?.invitedCount ?? 0

  const filtered = wallet.entries.filter(entry => matches(entry, filter))
  const shown = expanded ? filtered : filtered.slice(0, PREVIEW_ROWS)

  return (
    <CreditsAppWindow page="credits" dashboard>
      <div className="credits-top">
        <div className="credits-intro">
          <p className="credits-intro-title type-page-title" aria-hidden="true">내 크레딧</p>
          <p className="credits-intro-sub">
            지금까지 모은 크레딧을 확인하고,
            <br />더 많은 보상을 받아보세요!
          </p>
        </div>

        {/* Today's balance: attendance credits (gone at 5am) plus invite credits (kept). */}
        <section className="credits-hero" aria-label="내 크레딧 잔액">
          <div className="credits-hero-copy">
            <p className="credits-hero-eyebrow">
              <Icon name="sparkle" size={14} />
              MY CAPSULE CREDIT
            </p>
            <p className="credits-hero-total">
              {number(total)}
              <span className="credits-unit">CR</span>
            </p>
            <p className="credits-hero-expiry">
              <Icon name="clock" size={16} />
              <span>
                오전 5시 만료 예정 <strong>{number(wallet.attendance)} CR</strong>
              </span>
              <span className="credits-hero-countdown">· {clock(remainingSeconds)} 남음</span>
            </p>
            <div className="credits-hero-bar">
              <div
                className="credits-hero-track"
                role="meter"
                aria-label="오늘 남은 출석 크레딧"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={attendancePct}
              >
                <span className="credits-hero-fill" style={{ width: `${attendancePct}%` }} />
              </div>
              <span className="credits-hero-pct" aria-hidden="true">{attendancePct}%</span>
            </div>
          </div>
          <CreditHeroArt />
        </section>
      </div>

      <div className="credits-action-grid">
        <section className="credits-action-card" aria-labelledby="credits-attendance-title">
          <CreditAttendanceArt />
          <div className="credits-action-copy">
            <h2 id="credits-attendance-title">출석 보상{reward && <span> · {reward.day}일차</span>}</h2>
            <p className="credits-action-value">
              {number(reward?.credit ?? 0)}
              <span className="credits-unit">CR</span>
            </p>
            <p className="credits-action-note">
              {attendanceState.checkedToday ? '오늘 출석 보상을 받았어요!' : '오늘 출석하면 받을 수 있어요!'}
            </p>
          </div>
          {attendanceState.checkedToday ? (
            <Button size="md" variant="secondary" disabled className="credits-action-button">
              출석 완료
            </Button>
          ) : (
            <ButtonLink to="/" size="md" className="credits-action-button" loading={attendanceLoading}>
              출석하기
              <Icon name="chevron" size={16} />
            </ButtonLink>
          )}
        </section>

        <section className="credits-action-card" aria-labelledby="credits-invite-title">
          <CreditInviteArt />
          <div className="credits-action-copy">
            <h2 id="credits-invite-title">친구 초대</h2>
            <p className="credits-action-value">
              {number(wallet.invitation)}
              <span className="credits-unit">CR</span>
            </p>
            <p className="credits-action-note">
              {invitedCount > 0
                ? `친구 ${number(invitedCount)}명을 초대해서 받았어요!`
                : `친구를 초대하면 둘 다 ${number(CREDIT_PRICING.inviteReward)} CR을 받아요!`}
            </p>
          </div>
          <ButtonLink to={INVITE_PATH} size="md" className="credits-action-button">
            친구 초대하기
            <Icon name="chevron" size={16} />
          </ButtonLink>
        </section>
      </div>

      {/* Every change, newest first (an attendance expiry included). */}
      <section className="credits-activity" aria-labelledby="credits-activity-title">
        <div className="credits-activity-head">
          <h2 id="credits-activity-title">
            <Icon name="clock" size={18} />
            크레딧 활동 기록
          </h2>
          {filtered.length > PREVIEW_ROWS && (
            <button type="button" className="credits-activity-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
              {expanded ? '접기' : '전체 보기'}
              <Icon name="chevron" size={14} />
            </button>
          )}
        </div>
        <Tabs
          label="크레딧 활동 필터"
          size="sm"
          value={filter}
          onChange={value => {
            setFilter(value as FilterId)
            setExpanded(false)
          }}
          options={FILTERS}
        />

        {wallet.entries.length === 0 ? (
          <p className="credits-empty-box">
            아직 내역이 없어요. 매일 오전 5시에 출석 크레딧 {number(CREDIT_PRICING.dailyAttendance)}이 들어와요.
          </p>
        ) : filtered.length === 0 ? (
          <p className="credits-empty-box">선택한 항목의 내역이 없어요.</p>
        ) : (
          <ol className="credits-timeline">
            {shown.map(entry => {
              const positive = entry.change > 0
              return (
                <li key={entry.id} className="credits-timeline-row" data-kind={entry.kind}>
                  <span className="credits-timeline-dot" aria-hidden="true" />
                  <time className="credits-timeline-time" dateTime={new Date(entry.at).toISOString()}>
                    {dateLabel(entry.at, true)}
                  </time>
                  <span className="credits-timeline-icon" aria-hidden="true">
                    <Icon name={KIND_ICON[entry.kind]} size={18} />
                  </span>
                  <span className="credits-timeline-desc">{entry.description}</span>
                  <span className="credits-timeline-change" data-positive={positive || undefined}>
                    {positive ? '+ ' : '− '}
                    {number(Math.abs(entry.change))}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </CreditsAppWindow>
  )
}
