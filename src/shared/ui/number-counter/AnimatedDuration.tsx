import { NumberCounter } from './NumberCounter'

/** Keep the existing duration/measuredDuration units and rounding while animating digits. */
export function AnimatedDuration({ seconds, measured = false }: { seconds: number; measured?: boolean }) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  if (measured && safe < 60) return <><NumberCounter value={Math.round(safe * 10) / 10} format={{ maximumFractionDigits: 1 }} />초</>
  const minutes = Math.floor(safe / 60)
  if (minutes < 60) return <><NumberCounter value={minutes} />분</>
  return <><NumberCounter value={Math.floor(minutes / 60)} />시간{minutes % 60 > 0 && <> <NumberCounter value={minutes % 60} />분</>}</>
}
