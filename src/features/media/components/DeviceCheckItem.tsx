import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { DeviceCheckStatus, type DeviceCheckState } from './DeviceCheckStatus'

export function DeviceCheckItem({
  title, state, statusLabel, action, children, details, className,
}: {
  title: string
  state: DeviceCheckState
  statusLabel: string
  action?: ReactNode
  children?: ReactNode
  details?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('device-check-item', className)} aria-label={`${title} 확인`}>
      <div className="device-check-item-header">
        <h2>{title}</h2>
        <DeviceCheckStatus state={state} label={statusLabel} />
        {children && <div className="device-check-item-content">{children}</div>}
        {action}
      </div>
      {details && <div className="device-check-item-details">{details}</div>}
    </section>
  )
}
