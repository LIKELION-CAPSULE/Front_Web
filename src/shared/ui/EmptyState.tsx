import type { ReactNode } from 'react'
import { ButtonLink } from '@/shared/ui/Button'

type EmptyStateProps = { title: string; children: ReactNode; action?: boolean; headingLevel?: 'h1' | 'h2' }

export function EmptyState({ title, children, action = true, headingLevel: Heading = 'h2' }: EmptyStateProps) {
  return (
    <section className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-panel border border-dashed border-line px-6 py-12 text-center">
      <Heading className="text-xl font-bold">{title}</Heading>
      <div className="max-w-md text-sm leading-7 text-muted">{children}</div>
      {action && <ButtonLink to="/" variant="secondary" className="mt-2">스터디룸 둘러보기</ButtonLink>}
    </section>
  )
}
