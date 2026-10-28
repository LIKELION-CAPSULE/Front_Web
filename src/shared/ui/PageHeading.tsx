import type { ReactNode } from 'react'

export function PageHeading({
  title,
  children,
  eyebrow = 'MY CAPSULE',
}: {
  title: string
  children?: ReactNode
  eyebrow?: string | null
}) {
  return (
    <div className="page-heading mb-8">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h1 className="text-page-title font-bold tracking-tight">{title}</h1>
      {children && <p className="mt-2 text-sm leading-6 text-muted">{children}</p>}
    </div>
  )
}
