import { useEffect, useId, useState } from 'react'
import { useMedia } from '@/features/media/media-context'
import { deviceErrorMessage } from '@/features/media/device-controller'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { FormField } from '@/shared/ui/FormField'
import { useConnectionPreferences } from '@/features/mates/connection-preferences-context'

// Flip to true once real mate voice generation & credit billing contract is connected.
const VOICE_BILLING_CONNECTED = false

export function ConnectionSettingsPanel() {
  const { devices, selectedDevices, controller, flushFocus } = useMedia()
  const { showPipSpeech, setShowPipSpeech } = useConnectionPreferences()
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const devicesId = useId()
  const pipSectionId = useId()
  const pipId = useId()
  const voiceId = useId()

  useEffect(() => {
    let current = true
    let revision = 0
    const media = navigator.mediaDevices
    const refresh = async () => {
      const request = ++revision
      try {
        const values = media?.enumerateDevices ? await media.enumerateDevices() : []
        if (current && request === revision) {
          setInputs(values.filter((value) => value.kind === 'videoinput' || value.kind === 'audioinput'))
          setError('')
        }
      } catch (reason) {
        if (current && request === revision) setError(deviceErrorMessage(reason, 'camera'))
      }
    }
    void refresh()
    media?.addEventListener('devicechange', refresh)
    return () => {
      current = false
      media?.removeEventListener('devicechange', refresh)
    }
  }, [attempt, devices.camera.stream, devices.microphone.stream])

  return (
    <>
      <h2 className="account-settings-title">설정</h2>
      <div className="connection-settings-groups">
        <section className="connection-settings-group" aria-labelledby={devicesId}>
          <h3 id={devicesId} className="connection-settings-group-title">
            통화 기기
          </h3>
          <div className="connection-settings-device-list">
            {(['microphone', 'camera'] as const).map((kind) => {
              const label = kind === 'camera' ? '카메라' : '마이크'
              const choices = inputs.filter(
                (value) => value.kind === (kind === 'camera' ? 'videoinput' : 'audioinput'),
              )
              const selected = selectedDevices[kind]
              return (
                <div key={kind}>
                  <FormField label={`${label} 선택`}>
                    <select
                      className="form-input"
                      aria-label={`${label} 선택`}
                      value={selected}
                      onChange={(event) => {
                        if (kind === 'camera') flushFocus()
                        void controller.select(kind, event.target.value)
                      }}
                    >
                      <option value="">기본</option>
                      {selected && !choices.some((value) => value.deviceId === selected) && (
                        <option value={selected} disabled>
                          {label} 선택
                        </option>
                      )}
                      {choices
                        .filter((value) => value.deviceId)
                        .map((value, index) => (
                          <option key={value.deviceId} value={value.deviceId}>
                            {value.label || `${label} ${index + 1}`}
                          </option>
                        ))}
                    </select>
                  </FormField>
                  {devices[kind].error && (
                    <FeedbackMessage tone="error" className="mt-3">
                      {devices[kind].error}
                    </FeedbackMessage>
                  )}
                </div>
              )
            })}
            {error && (
              <div>
                <FeedbackMessage tone="error">{error}</FeedbackMessage>
                <Button
                  className="mt-3"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  다시 시도
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="connection-settings-group" aria-labelledby={pipSectionId}>
          <h3 id={pipSectionId} className="connection-settings-group-title">
            PIP
          </h3>
          <div className="connection-settings-row">
            <span id={pipId} className="field-label">
              PIP 말풍선
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showPipSpeech}
              aria-labelledby={pipId}
              onClick={() => setShowPipSpeech(!showPipSpeech)}
              className="connection-settings-switch"
            >
              <span aria-hidden="true" />
            </button>
          </div>
          {VOICE_BILLING_CONNECTED && (
            <div className="connection-settings-row mt-4">
              <div>
                <span id={`${voiceId}-label`} className="field-label">
                  메이트 음성
                </span>
                <p id={`${voiceId}-hint`} className="mt-1 text-caption text-muted">
                  음성을 끄면 크레딧이 들지 않아요
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={voiceEnabled}
                aria-labelledby={`${voiceId}-label`}
                aria-describedby={`${voiceId}-hint`}
                onClick={() => setVoiceEnabled((v) => !v)}
                className="connection-settings-switch"
              >
                <span aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

      </div>
    </>
  )
}
