import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function RadioOption({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center gap-2.5 rounded-control border px-3.5 py-3 text-sm',
        checked ? 'border-brand bg-brand-soft' : 'border-line bg-canvas',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-brand' : 'border-subtle',
        )}
      >
        {checked && <span className="size-2 rounded-full bg-brand-solid" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <span className="pointer-events-none absolute inset-0 rounded-control peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
    </label>
  )
}
