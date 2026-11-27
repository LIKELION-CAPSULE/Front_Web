import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { SampleAudioPlayer } from '../sample-audio'
import { useConnectionSettings } from '../connection-preferences-context'
import { mateVoicePlayback } from '../connection-preferences'

export type VoiceSampleStatus = 'idle' | 'loading' | 'playing' | 'error'

export function VoiceSampleButton({
  url,
  disabled,
  onStatusChange,
  idleLabel = '목소리 샘플 듣기',
  idleIcon = 'play',
  idleArt,
  iconSize = 15,
  className,
}: {
  url?: string
  disabled: boolean
  onStatusChange?: (status: VoiceSampleStatus) => void
  /** Button copy and icon while nothing plays (the mate detail page says "목소리 듣기"). */
  idleLabel?: string
  idleIcon?: IconName
  /** Drawn instead of `idleIcon` while nothing plays (the mate detail page's sound-wave mark). */
  idleArt?: ReactNode
  iconSize?: number
  className?: string
}) {
  const [player] = useState(() => new SampleAudioPlayer())
  // The voice volume and speed of the settings (T-3, T-4), from the one place mate voice reads them.
  const settings = useConnectionSettings()
  useEffect(() => { player.setPlayback(mateVoicePlayback(settings)) }, [player, settings])
  const status = useSyncExternalStore(player.subscribe, player.getSnapshot, () => 'idle') as VoiceSampleStatus
  const active = status === 'playing' || status === 'loading'
  useEffect(() => () => player.stop(), [player, url])
  useEffect(() => { if (disabled) player.stop() }, [player, disabled])
  useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  return (
    <div className={className ? `mate-voice-sample ${className}` : 'mate-voice-sample'}>
      <div className="mate-voice-sample-row">
        <Button
          variant="secondary"
          size="sm"
          className="mate-voice-sample-btn"
          disabled={!url || disabled}
          aria-pressed={active}
          aria-busy={status === 'loading' || undefined}
          onClick={() => {
            if (active) player.stop()
            else if (url) void player.play(url)
          }}
        >
          {active || !idleArt ? <Icon name={active ? 'pause' : idleIcon} size={iconSize} /> : idleArt}
          {active ? '목소리 샘플 멈추기' : idleLabel}
        </Button>
        {status === 'playing' && (
          <span className="mate-voice-wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        )}
      </div>
      {status === 'error' && (
        <FeedbackMessage tone="error" className="mate-voice-error mt-2">
          요청을 처리하지 못했어요.
        </FeedbackMessage>
      )}
    </div>
  )
}
