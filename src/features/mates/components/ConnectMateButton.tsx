import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import type { AvailableMate } from '../catalog'
import { useConnectMate } from '../use-connect-mate'

export function ConnectMateButton({
  mate,
  label = '연결하기',
  disabled = false,
  errorPlacement = 'below',
}: {
  mate: AvailableMate
  label?: string
  disabled?: boolean
  errorPlacement?: 'below' | 'above'
}) {
  const { connect, busy, error } = useConnectMate(mate)
  return <div className="mate-connect-action">
    {error && errorPlacement === 'above' && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
    <Button onClick={() => { if (!disabled) void connect() }} loading={busy} disabled={disabled}><Icon name="play" size={18} />{label}</Button>
    {error && errorPlacement === 'below' && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
  </div>
}
