import { Icon } from '@/shared/ui/Icon'
import { NumberCounter } from '@/shared/ui/number-counter/NumberCounter'
import '../affection-status.css'

export function AffectionStatus({ name, score, current = false, animate = false }: { name: string; score: number | null; current?: boolean; animate?: boolean }) {
  const label = current ? '현재 호감도' : '호감도'
  return (
    <section className="affection-status" aria-label={`${name}의 ${label}`}>
      <div className="affection-status-heading">
        <p><Icon name="heart" size={18} loop={current} className="text-affection" />{label}</p>
        <strong>{score === null ? '—' : animate ? <NumberCounter value={score} /> : score}<span className="affection-status-scale"> / 100</span></strong>
      </div>
      {score !== null && (
        <div className="affection-status-track" role="meter" aria-label={`${name}의 ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
          <span style={{ width: `${score}%` }} />
        </div>
      )}
    </section>
  )
}
