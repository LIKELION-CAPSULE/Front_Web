import { ProgressRing } from '@/shared/ui/ProgressRing'
import './record-summary.css'

export function FocusSummary({ value, label }: { value: number | null; label: string }) {
  return (
    <section className="records-summary-focus" aria-label="기간별 자리 지킴률">
      <h2 className="records-summary-label">자리 지킴률</h2>
      <ProgressRing
        className="records-summary-ring"
        value={value}
        label={`${label} 자리 지킴률`}
        size="var(--records-focus-size)"
      />
    </section>
  )
}
