import { Icon } from '@/shared/ui/Icon'
import { tiers } from '@/features/demo/catalog'
import type { TierId } from '@/features/demo/types'
import { cn } from '@/shared/lib/cn'
import { number } from '@/shared/lib/format'
import { useId } from 'react'

export function TierSelector({
  value,
  onChange,
}: {
  value: TierId
  onChange: (value: TierId) => void
}) {
  const detailsId = useId()
  const selected = tiers.find(tier => tier.id === value) ?? tiers[0]!
  return (
    <div>
      <fieldset className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <legend className="sr-only">대화 옵션</legend>
        {tiers.map((tier) => (
          <label
            key={tier.id}
            className={cn(
              'relative min-h-[132px] cursor-pointer rounded-[14px] border-2 p-3 text-left break-keep sm:min-h-[212px]',
              value === tier.id ? 'border-focus-ring bg-selected text-selected-text' : 'border-transparent bg-panel text-ink',
            )}
          >
            <input
              type="radio"
              name="tier"
              value={tier.id}
              checked={value === tier.id}
              onChange={() => onChange(tier.id)}
              className="peer sr-only"
              aria-controls={detailsId}
            />
            <span className="pointer-events-none absolute inset-0 rounded-[14px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-focus-ring" />
            <span className="block type-card-title">{tier.name}</span>
            <span className="mt-0.5 block type-stat">
              {number(tier.price)}
            </span>
            <span
              className="mt-1 block text-caption text-muted sm:text-label"
            >
              {tier.price ? '크레딧 / 1회' : '크레딧 차감 없음'}
            </span>
            <span className="my-3 hidden h-px bg-divider/70 sm:block" />
            {tier.features.map((feature) => (
              <span className="hidden type-body-compact sm:block" key={feature}>
                {feature}
              </span>
            ))}
            {value === tier.id && (
              <span aria-label="선택됨" className="absolute top-2.5 right-2 text-text-accent">
                <Icon name="check" size={16} />
              </span>
            )}
          </label>
        ))}
      </fieldset>
      <section id={detailsId} aria-label={`${selected.name} 포함 사항`} aria-live="polite" aria-atomic="true" className="mt-3 rounded-control bg-panel p-4 sm:hidden">
        <h3 className="type-label font-semibold">{selected.name} 포함 사항</h3>
        <ul className="mt-2 space-y-1.5 type-body-compact text-muted">
          {selected.features.map(feature => <li key={feature} className="flex items-start gap-2"><Icon name="check" size={15} className="mt-1 shrink-0 text-text-accent" /><span>{feature}</span></li>)}
        </ul>
      </section>
    </div>
  )
}
