import { Icon } from '@/shared/ui/Icon'
import { tiers } from '@/features/demo/catalog'
import type { TierId } from '@/features/demo/types'
import { cn } from '@/shared/lib/cn'
import { number } from '@/shared/lib/format'

export function TierSelector({
  value,
  onChange,
}: {
  value: TierId
  onChange: (value: TierId) => void
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <legend className="sr-only">이번 세트 등급</legend>
      {tiers.map((tier, index) => (
        <label
          key={tier.id}
          className={cn(
            'relative min-h-[212px] cursor-pointer rounded-[14px] border-2 p-3 text-left',
            value === tier.id ? 'border-brand' : 'border-transparent',
            ['bg-surface-soft', 'bg-brand-soft', 'bg-[#2c253f]', 'bg-[#3c2b59] text-white'][index],
          )}
        >
          <input
            type="radio"
            name="tier"
            value={tier.id}
            checked={value === tier.id}
            onChange={() => onChange(tier.id)}
            className="peer sr-only"
          />
          <span className="pointer-events-none absolute inset-0 rounded-[14px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
          <span className="block text-[15px] font-bold">{tier.name}</span>
          <span className="mt-0.5 block text-[26px] leading-9 font-black">
            {number(tier.price)}
          </span>
          <span
            className={cn(
              'mt-1 block text-[11px]',
              tier.id === 'special' ? 'text-white/80' : 'text-muted',
            )}
          >
            {tier.price ? '크레딧 / 1세트' : '무료 · 무제한'}
          </span>
          <span className="my-3 block h-px bg-line/70" />
          {tier.features.map((feature) => (
            <span className="block text-[11px] leading-4" key={feature}>
              {feature}
            </span>
          ))}
          {value === tier.id && (
            <span aria-label="선택됨" className="absolute top-2.5 right-2 text-brand">
              <Icon name="check" size={16} />
            </span>
          )}
        </label>
      ))}
    </fieldset>
  )
}
