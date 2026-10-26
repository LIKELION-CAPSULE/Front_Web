import type { ReactNode } from 'react'

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] leading-10 font-bold">{title}</h1>
      {children && <p className="mt-2 text-sm leading-6 text-muted">{children}</p>}
    </div>
  )
}
