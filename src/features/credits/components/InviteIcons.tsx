import type { CSSProperties, ReactNode } from 'react'

/**
 * Line icons the shared Icon set does not have (Lucide shapes, same 2px stroke), sized like `Icon`. Outline only: the
 * shared icon styles let `fill` inherit, so it is set to none here or the shapes come out filled.
 */
function LineIcon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <span className="app-icon" aria-hidden="true" style={{ '--icon-size': `${size}px` } as CSSProperties}>
      <svg viewBox="0 0 24 24" fill="none" style={{ fill: 'none' }} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  )
}

export function CopyIcon({ size = 20 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </LineIcon>
  )
}

export function LinkIcon({ size = 20 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </LineIcon>
  )
}

export function UsersIcon({ size = 20 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </LineIcon>
  )
}
