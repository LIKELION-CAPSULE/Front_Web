import { useState } from 'react'
import { mateCallBackground } from '@/features/mates/artwork'
import { launchMates, type AvailableMate } from '@/features/mates/catalog'
import { useAttendanceController } from '@/features/attendance/attendance-controller'
import { AttendanceDevPanel } from '@/features/attendance/components/AttendanceDevPanel'
import { AttendancePath } from '@/features/attendance/components/AttendancePath'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import { HOME_COPY } from '../home-copy'

/** 친구 초대 (SCR-31). */
const INVITE_PATH = '/credits/invite'

/**
 * The home hero: copy and the attendance CTA on the left, the attendance path (채린 walking this week's pads) on the
 * right, over the room. Once today's check-in is done the CTA turns into 친구 초대. Until the attendance is read the
 * line and the CTA are placeholders, so the page never shows 「출석하고 크레딧 받기」 to an account already checked in.
 */
export function HomeHero({ mate }: { mate: AvailableMate | null }) {
  const { state, busy, isLoading, start, devSet } = useAttendanceController()
  const [error, setError] = useState<string | null>(null)
  const title = HOME_COPY.heroTitle
  const done = state.checkedToday && !busy

  async function checkIn() {
    setError(null)
    try {
      await start()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '출석을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-backdrop" aria-hidden="true">
        <img className="home-hero-room" src={mateCallBackground(mate?.id ?? launchMates[0]!.id).landscape} alt="" decoding="async" draggable={false} />
      </div>
      <div className="home-hero-figure" data-tour="home-attendance">
        {/* Placed once attendance has loaded, so the first load is not mistaken for a check-in and walked. */}
        {!isLoading && <AttendancePath streak={state.cycleDay} checkedInToday={state.checkedToday} />}
        {import.meta.env.DEV && <AttendanceDevPanel disabled={busy} cycleDay={state.cycleDay} checkedToday={state.checkedToday} onSet={devSet} />}
      </div>

      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <h1 id="home-hero-title" className="home-hero-title">
            {title.before}
            <span className="home-hero-accent">{title.accent}</span>
            <span className="home-hero-sparkle" aria-hidden="true" />
            <br />
            {title.after}
          </h1>
          {/* Until attendance is read neither line is shown (the box keeps their height): a line saying 「출석하고」 that
              turns into 「출석 완료」 a moment later read as a glitch. The right one fades in once. */}
          <p className="home-hero-sub" aria-live="polite" aria-busy={isLoading || undefined}>
            <span data-active={(!isLoading && !done) || undefined} aria-hidden={isLoading || done}>{HOME_COPY.heroSub}</span>
            <span data-active={(!isLoading && done) || undefined} aria-hidden={isLoading || !done}>{HOME_COPY.heroSubDone}</span>
            <span className="home-hero-sub-pending" data-active={isLoading || undefined} aria-hidden="true"><span className="skeleton-line" /></span>
          </p>
          {isLoading ? (
            // Neither 「출석하고」 nor 「친구 초대하고」 yet: a placeholder of the button's size, not a button.
            <span className="home-hero-cta home-hero-cta-pending skeleton-line rounded-control min-h-14" data-attendance-pending>
              <span className="sr-only" role="status">{HOME_COPY.attendanceLoading}</span>
            </span>
          ) : done ? (
            <ButtonLink to={INVITE_PATH} className="home-hero-cta min-h-14 px-8">
              {HOME_COPY.ctaInvite}
              <Icon name="chevron" size={18} />
            </ButtonLink>
          ) : (
            <Button className="home-hero-cta min-h-14 px-8" onClick={() => void checkIn()} loading={busy}>
              {HOME_COPY.ctaCheckIn}
              <Icon name="chevron" size={18} />
            </Button>
          )}
          {error && <FeedbackMessage tone="error" className="mt-3">{error}</FeedbackMessage>}
        </div>
      </div>
    </section>
  )
}
