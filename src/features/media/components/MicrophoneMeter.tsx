import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMedia } from '../media-context'
import { DeviceCheckItem } from './DeviceCheckItem'
import type { DeviceCheckState } from './DeviceCheckStatus'

export function MicrophoneMeter({ action, pending = false }: { action?: ReactNode; pending?: boolean }) {
  const { devices } = useMedia()
  const stream = devices.microphone.stream
  const meter = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState<{ stream: MediaStream; status: 'ready' | 'error' } | null>(null)
  useEffect(() => {
    if (!stream) return
    let audio: AudioContext | undefined
    let animation = 0
    let cancelled = false
    const fail = () => { if (!cancelled) setInput({ stream, status: 'error' }) }
    try {
      audio = new AudioContext()
      const source = audio.createMediaStreamSource(stream)
      const analyzer = audio.createAnalyser()
      analyzer.fftSize = 256
      source.connect(analyzer) // No destination: never play the user's microphone back.
      const data = new Float32Array(analyzer.fftSize)
      const render = () => {
        if (cancelled) return
        analyzer.getFloatTimeDomainData(data)
        const rms = Math.sqrt(data.reduce((sum, sample) => sum + sample * sample, 0) / data.length)
        meter.current?.style.setProperty('--mic-level', String(Math.min(1, rms * 5)))
        animation = requestAnimationFrame(render)
      }
      void audio.resume().then(() => {
        if (!cancelled) { setInput({ stream, status: 'ready' }); render() }
      }).catch(fail)
    } catch { queueMicrotask(fail) }
    return () => { cancelled = true; cancelAnimationFrame(animation); void audio?.close().catch(() => {}) }
  }, [stream])
  const inputStatus = input?.stream === stream ? input?.status : null
  const state: DeviceCheckState = devices.microphone.status === 'error' || inputStatus === 'error' ? 'error'
    : pending || devices.microphone.status === 'requesting' || (stream && inputStatus !== 'ready') ? 'pending'
      : stream ? 'success' : 'off'
  const statusLabel = { idle: '연결 대기', pending: '확인 중', success: '연결됨', error: '연결 실패', off: '꺼짐' }[state]
  const error = devices.microphone.error || (inputStatus === 'error' ? '마이크 입력을 확인하지 못했어요. 다시 켜서 확인해 주세요.' : '')
  return (
    <DeviceCheckItem
      title="마이크"
      state={state}
      statusLabel={statusLabel}
      action={action}
      className="microphone-check"
      details={error ? <p role="alert" className="device-check-error">{error}</p> : undefined}
    >
      {stream && !error && <div ref={meter} role="img" aria-label="실시간 마이크 입력 크기" className="microphone-meter"><span /></div>}
    </DeviceCheckItem>
  )
}
