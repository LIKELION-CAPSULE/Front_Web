import { Icon } from '@/shared/ui/Icon'

export function SessionAffection({ name, score }: { name: string; score: number | null }) {
  return (
    <div role="status" aria-label={`${name}의 현재 호감도`} aria-live="polite" aria-atomic="true"
      className="study-affection-status study-metric" title={`${name}와의 현재 호감도`}>
      <span>호감도</span>
      <strong><Icon name="heart" size={16} fill="currentColor" />{score ?? '—'}</strong>
    </div>
  )
}
