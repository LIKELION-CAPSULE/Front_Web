import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { SampleAudioPlayer } from '../sample-audio'

export type VoiceSampleStatus = 'idle' | 'loading' | 'playing' | 'error'

export function VoiceSampleButton({
  url,
  disabled,
  onStatusChange,
}: {
  url?: string
  disabled: boolean
  onStatusChange?: (status: VoiceSampleStatus) => void
}) {
  const [player] = useState(() => new SampleAudioPlayer())
  const status = useSyncExternalStore(player.subscribe, player.getSnapshot, () => 'idle') as VoiceSampleStatus
  const active = status === 'playing' || status === 'loading'
  useEffect(() => () => player.stop(), [player, url])
  useEffect(() => { if (disabled) player.stop() }, [player, disabled])
  useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  return (
    <div className="mate-voice-sample">
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
          <Icon name={active ? 'pause' : 'play'} size={15} />
          {active ? '목소리 샘플 멈추기' : '목소리 샘플 듣기'}
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
