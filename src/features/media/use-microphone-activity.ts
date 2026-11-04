import { useEffect, useState } from 'react'
import { MicrophoneActivity, microphoneRms } from './microphone-activity'

/** Consumes an already-permitted microphone; never requests, records, transmits or plays audio. */
export function useMicrophoneActivity(stream: MediaStream | null) {
  const [activity, setActivity] = useState<{ stream: MediaStream; speaking: boolean } | null>(null)
  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length || typeof AudioContext === 'undefined') return
    let audio: AudioContext | undefined
    let source: MediaStreamAudioSourceNode | undefined
    let analyser: AnalyserNode | undefined
    let interval: number | undefined
    const gate = new MicrophoneActivity()
    const publish = (speaking: boolean) => setActivity(current =>
      current?.stream === stream && current.speaking === speaking ? current : { stream, speaking })
    const close = () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', visibility)
      source?.disconnect()
      analyser?.disconnect()
      if (audio && audio.state !== 'closed') void audio.close().catch(() => {})
    }
    function visibility() {
      if (document.hidden) { gate.reset(); publish(false) }
    }
    try {
      audio = new AudioContext()
      analyser = audio.createAnalyser()
      analyser.fftSize = 1024
      source = audio.createMediaStreamSource(stream)
      source.connect(analyser)
      // No connection to audio.destination: the user's voice is never played back.
      const samples = new Float32Array(analyser.fftSize)
      interval = window.setInterval(() => {
        if (document.hidden || audio?.state !== 'running' ||
          !stream.getAudioTracks().some(track => track.readyState === 'live' && track.enabled && !track.muted)) {
          gate.reset()
          publish(false)
          return
        }
        analyser!.getFloatTimeDomainData(samples)
        publish(gate.sample(microphoneRms(samples), performance.now()))
      }, 50)
      document.addEventListener('visibilitychange', visibility)
      void audio.resume().catch(() => {})
    } catch { close() }
    return close
  }, [stream])
  return !!stream && activity?.stream === stream && activity.speaking
}
