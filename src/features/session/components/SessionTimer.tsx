import { clock } from '@/shared/lib/format'
import { AnimatedClock } from '@/shared/ui/AnimatedClock'

export function SessionTimer({ elapsed, duration, resting, paused, tier }: {
  elapsed: number
  duration: number
  resting: boolean
  paused: boolean
  tier: string
}) {
  return (
    <div
      className="session-timer"
      role="timer"
      aria-label={resting ? '쉬는 시간 남은 시간' : '공부 경과 시간 / 목표 시간'}
      aria-live="off"
      data-paused={paused || undefined}
      title={resting ? '쉬는 시간 · 10분' : `경과 시간 / 목표 시간 · ${tier}`}
    >
      {resting && <span className="session-timer-label">쉬는 시간</span>}
      <strong><AnimatedClock value={resting ? clock(duration - elapsed).slice(3) : clock(Math.min(elapsed, duration))} direction={resting ? 'down' : 'up'} /></strong>
      {!resting && <>
        <span className="session-timer-divider" aria-hidden="true">/</span>
        <span className="session-timer-goal"><AnimatedClock value={clock(duration)} /></span>
      </>}
    </div>
  )
}
