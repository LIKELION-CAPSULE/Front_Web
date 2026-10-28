import { useRef } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon } from './Icon'
import './search-field.css'

export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  clearLabel = '검색어 지우기',
  className,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  clearLabel?: string
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className={cn('search-field', className)}>
      <Icon name="search" size={17} />
      <input ref={input} type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      {value && (
        <button type="button" aria-label={clearLabel} onClick={() => {
          onChange('')
          input.current?.focus({ preventScroll: true })
        }}>
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  )
}
