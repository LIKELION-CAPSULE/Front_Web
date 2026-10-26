import { cn } from '@/shared/lib/cn'

type Tab = { id: string; label: string }
export function Tabs({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Tab[]
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="segmented-control inline-flex max-w-full flex-wrap gap-1 rounded-control border border-line bg-panel p-1"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'segmented-option rounded-[9px] px-4 py-2 text-sm leading-5 transition-colors',
            value === option.id
              ? 'bg-brand-soft font-bold text-brand-strong'
              : 'text-subtle hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
