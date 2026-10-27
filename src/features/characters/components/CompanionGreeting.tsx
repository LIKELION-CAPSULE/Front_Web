import { cn } from '@/shared/lib/cn'

/** The artwork identifies the speaker; retain their name for assistive technology only. */
export function CompanionGreeting({
  name,
  quote,
  className,
}: {
  name: string
  quote: string
  className?: string
}) {
  return (
    <blockquote className={cn('companion-greeting', className)} aria-label={`${name}의 한마디`}>
      <p>{quote}</p>
    </blockquote>
  )
}
