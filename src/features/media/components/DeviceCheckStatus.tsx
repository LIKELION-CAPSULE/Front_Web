import { Icon } from '@/shared/ui/Icon'

export type DeviceCheckState = 'idle' | 'pending' | 'success' | 'error' | 'off'

export function DeviceCheckStatus({ state, label }: { state: DeviceCheckState; label: string }) {
  return (
    <span className="device-check-status" data-state={state} role="status">
      <span className="device-check-status-icon" aria-hidden="true">
        {state === 'idle' ? (
          <span className="device-check-status-dash" />
        ) : (
          <Icon name={state === 'success' ? 'check' : state === 'pending' ? 'clock' : 'close'} size={14} />
        )}
      </span>
      <span>{label}</span>
    </span>
  )
}
