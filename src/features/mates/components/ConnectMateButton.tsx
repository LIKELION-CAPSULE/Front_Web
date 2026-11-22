import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useBackend } from '@/features/backend/backend-context'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { Icon } from '@/shared/ui/Icon'
import type { AvailableMate } from '../catalog'
import { EndedConnectionError } from '@/features/backend/ended-connection'

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
  const { connectMate } = useBackend()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function connect() {
    if (busy || disabled) return
    setBusy(true)
    setError('')
    try {
      await connectMate(mate.id)
      if (mounted.current) navigate(`/connect/${mate.id}`)
    } catch (reason) {
      if (!mounted.current) return
      if (reason instanceof EndedConnectionError) navigate(`/connections/${reason.sessionId}`, { replace: true })
      else setError(reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.')
    }
    finally { if (mounted.current) setBusy(false) }
  }
  return <div className="mate-connect-action">
    {error && errorPlacement === 'above' && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
    <Button onClick={() => { void connect() }} loading={busy} disabled={disabled}><Icon name="play" size={18} />{label}</Button>
    {error && errorPlacement === 'below' && <FeedbackMessage tone="error">{error}</FeedbackMessage>}
  </div>
}
