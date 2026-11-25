import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { useMedia } from '@/features/media/media-context'
import { deviceErrorMessage } from '@/features/media/device-controller'
import { Button } from '@/shared/ui/Button'
import { FeedbackMessage } from '@/shared/ui/FeedbackMessage'
import { useConnectionPreferences } from '@/features/mates/connection-preferences-context'
import { mateVoiceOn, mateVoicePatch, TALK_OPTIONS } from '@/features/mates/connection-preferences'
import { speechRecognitionFactory } from '@/features/mates/push-to-talk'
import { CREDIT_PRICING } from '@/features/credits/credit-utils'

/**
 * Account settings 「설정」 tab: every item of PRD §7.9 (T-1…T-10), one row each — label on the left, control on the
 * right — in four sections of related items (user request 2026-11-25): 메이트와 대화 (T-1, T-7, T-10), 메이트 음성
 * (T-2…T-4, on since 2026-11-26), 마이크 · 카메라 (T-5, T-8), PIP (T-6, T-9). Values are per-account preferences (connection-preferences.ts,
 * the server copy for the server-owned ones); the device choice is the media controller's.
 */

type Option<T extends string> = { value: T; label: string }

function Segment<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void }) {
  return (
    <div className="settings-segment" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className="settings-segment-option"
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            const index = options.findIndex((item) => item.value === value)
            const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
            if (!step) return
            event.preventDefault()
            const next = options[(index + step + options.length) % options.length]!
            onChange(next.value)
            const group = event.currentTarget.parentElement
            requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Switch({ labelledBy, describedBy, checked, onChange }: { labelledBy: string; describedBy?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className="connection-settings-switch"
    >
      <span aria-hidden="true" />
    </button>
  )
}

function Row({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <li className="settings-row">
      <div className="settings-row-text">
        <span id={id} className="settings-row-label">
          {label}
        </span>
        {hint && <p id={`${id}-hint`} className="settings-row-hint">{hint}</p>}
      </div>
      <div className="settings-row-control">{children}</div>
    </li>
  )
}

export function ConnectionSettingsPanel() {
  const { devices, selectedDevices, controller, flushFocus } = useMedia()
  const { showPipSpeech, setShowPipSpeech, settings, updateSettings, saveStatus, retrySave } = useConnectionPreferences()
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [speechSupported] = useState(() => typeof window !== 'undefined' && speechRecognitionFactory(window) !== null)
  const id = useId()

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

  const device = (kind: 'microphone' | 'camera') => {
    const label = kind === 'camera' ? '카메라' : '마이크'
    const choices = inputs.filter((value) => value.kind === (kind === 'camera' ? 'videoinput' : 'audioinput'))
    const selected = selectedDevices[kind]
    return (
      <select
        className="form-input settings-select"
        aria-labelledby={`${id}-${kind}`}
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
    )
  }

  // The service tour points at the first section (a target taller than the scroll area would put its line off screen).
  const section = (key: string, title: ReactNode, children: ReactNode) => (
    <section className="connection-settings-section" aria-labelledby={`${id}-section-${key}`} data-tour={key === 'talk' ? 'account-settings' : undefined}>
      <h3 id={`${id}-section-${key}`} className="connection-settings-group-title">{title}</h3>
      {children}
    </section>
  )
  return (
    <div className="connection-settings-sections">
      {/* The server copy could not be saved (API 30): quiet, since this browser keeps the choice; 「다시 저장」 sends it.
          At the top, so it shows without scrolling. */}
      {saveStatus === 'error' && (
        <p className="connection-settings-save-error" role="status">
          설정을 계정에 저장하지 못했어요. 이 브라우저에는 저장돼 있어요.
          {retrySave && <button type="button" className="connection-settings-save-retry" onClick={retrySave}>다시 저장</button>}
        </p>
      )}
      {section('talk', '메이트와 대화', (
        <ul className="settings-rows">
          {/* T-1 */}
          <Row id={`${id}-talk`} label="말 걸기 빈도" hint={TALK_OPTIONS.find((option) => option.value === settings.talk)?.description}>
            <Segment label="말 걸기 빈도" value={settings.talk} onChange={(talk) => updateSettings({ talk })} options={TALK_OPTIONS} />
          </Row>
          {/* T-7 */}
          <Row id={`${id}-mode`} label="대화 모드" hint="연결을 시작할 때의 모드예요. 연결 화면 위에서 바로 바꿀 수 있어요">
            <Segment label="대화 모드" value={settings.mode} onChange={(mode) => updateSettings({ mode })}
              options={[{ value: 'basic', label: '기본 · 크레딧 없음' }, { value: 'advanced', label: `고급 · 1턴 ${CREDIT_PRICING.advanced}` }]} />
          </Row>
          {/* T-10: how the mate looks at you, beside how she talks (one item would not make a section of its own). */}
          <Row id={`${id}-gaze`} label="시선 따라오기" hint="카메라를 꺼도 메이트가 마우스를 따라봐요">
            <Switch labelledBy={`${id}-gaze`} describedBy={`${id}-gaze-hint`} checked={settings.gaze} onChange={(gaze) => updateSettings({ gaze })} />
          </Row>
        </ul>
      ))}
      {/* T-2…T-4: the mate's voice. Off until the user turns it on (here or the call dock's button: the same value,
          connection-preferences.ts `mateVoiceOn`). On: replies and reaction lines come with her voice (20 credits a
          reply; text only when credits are short). The volume is played here; the speed is the server's TTS speed. */}
      {section('voice', '메이트 음성', (
        <ul className="settings-rows">
          {/* T-2 */}
          <Row id={`${id}-voice`} label="메이트 음성"
            hint={mateVoiceOn(settings) ? `답장마다 음성 ${CREDIT_PRICING.voice} 크레딧이 들어요. 크레딧이 모자라면 글로만 답해요` : '켜면 메이트가 목소리로 답해요'}>
            <Switch labelledBy={`${id}-voice`} describedBy={`${id}-voice-hint`} checked={mateVoiceOn(settings)} onChange={(on) => updateSettings(mateVoicePatch(on))} />
          </Row>
          {/* T-3 */}
          <Row id={`${id}-volume`} label="음성 볼륨">
            <div className="settings-slider">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={settings.volume}
                aria-labelledby={`${id}-volume`}
                aria-valuetext={`${settings.volume}`}
                style={{ '--value': `${settings.volume}%` } as CSSProperties}
                onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
              />
              <output className="settings-slider-value" aria-hidden="true">{settings.volume}</output>
            </div>
          </Row>
          {/* T-4 */}
          <Row id={`${id}-speed`} label="음성 속도">
            <Segment label="음성 속도" value={settings.speed} onChange={(speed) => updateSettings({ speed })}
              options={[{ value: 'slow', label: '느리게' }, { value: 'normal', label: '보통' }, { value: 'fast', label: '빠르게' }]} />
          </Row>
        </ul>
      ))}
      {section('devices', '마이크 · 카메라', (
        <ul className="settings-rows">
          {/* T-5 */}
          <Row id={`${id}-microphone`} label="마이크" hint={speechSupported ? '음성 입력(누르고 말하기)은 브라우저 기본 마이크를 써요' : undefined}>
            {device('microphone')}
          </Row>
          <Row id={`${id}-camera`} label="카메라">
            {device('camera')}
          </Row>
          {(devices.microphone.error || devices.camera.error || error) && (
            <li className="settings-row-feedback">
              {devices.microphone.error && <FeedbackMessage tone="error">{devices.microphone.error}</FeedbackMessage>}
              {devices.camera.error && <FeedbackMessage tone="error">{devices.camera.error}</FeedbackMessage>}
              {error && (
                <>
                  <FeedbackMessage tone="error">{error}</FeedbackMessage>
                  <Button className="mt-3" variant="secondary" size="sm" onClick={() => setAttempt((value) => value + 1)}>다시 시도</Button>
                </>
              )}
            </li>
          )}
          {/* T-8 */}
          <Row
            id={`${id}-hold`}
            label="스페이스 누른 채 말하기"
            hint={speechSupported ? '연결 화면이나 PIP 창에서 스페이스를 누르고 있는 동안 말해요' : '이 브라우저는 음성 입력을 지원하지 않아요. Chrome이나 Edge를 써 주세요'}
          >
            <Switch labelledBy={`${id}-hold`} describedBy={`${id}-hold-hint`} checked={settings.holdToTalk} onChange={(holdToTalk) => updateSettings({ holdToTalk })} />
          </Row>
        </ul>
      ))}
      {section('pip', 'PIP', (
        <ul className="settings-rows">
          {/* T-6 */}
          <Row id={`${id}-pip-speech`} label="PIP 말풍선">
            <Switch labelledBy={`${id}-pip-speech`} checked={showPipSpeech} onChange={setShowPipSpeech} />
          </Row>
          {/* T-9 */}
          <Row id={`${id}-pip-size`} label="PIP 창 크기">
            <Segment label="PIP 창 크기" value={settings.pipSize} onChange={(pipSize) => updateSettings({ pipSize })}
              options={[{ value: 'small', label: '작게' }, { value: 'normal', label: '보통' }, { value: 'large', label: '크게' }]} />
          </Row>
        </ul>
      ))}
    </div>
  )
}
