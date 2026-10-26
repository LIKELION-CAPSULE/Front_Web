import type { ReactNode } from 'react'

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-heading mb-8">
      <p className="eyebrow mb-3">MY CAPSULE</p>
      <h1 className="text-[30px] leading-10 font-bold tracking-tight">{title}</h1>
      {children && <p className="mt-2 text-sm leading-6 text-muted">{children}</p>}
    </div>
  )
}
