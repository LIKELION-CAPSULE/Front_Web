import { ProgressRing } from '@/shared/ui/ProgressRing'
import './record-summary.css'

export function FocusSummary({ value, label }: { value: number; label: string }) {
  return (
    <section className="records-summary-focus" aria-label="기간별 집중률">
      <h2 className="records-summary-label">집중률</h2>
      <ProgressRing
        className="records-summary-ring"
        value={value}
        label={`${label} 집중률`}
        size="var(--records-focus-size)"
      />
    </section>
  )
}
