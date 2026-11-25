type SampleAudio = Pick<HTMLAudioElement, 'play' | 'pause' | 'load' | 'removeAttribute' | 'addEventListener' | 'removeEventListener'> &
  Partial<Pick<HTMLAudioElement, 'volume' | 'playbackRate' | 'defaultPlaybackRate'>>
export type SampleAudioStatus = 'idle' | 'loading' | 'playing' | 'error'

/** One explicitly requested sample. A stopped or replaced play promise cannot restart it. */
export class SampleAudioPlayer {
  private audio: SampleAudio | null = null
  private cleanup: (() => void) | null = null
  private status: SampleAudioStatus = 'idle'
  private listeners = new Set<() => void>()
  private create: (url: string) => SampleAudio
  /** Volume (0–1) and speed for every sample (the 「설정」 tab, connection-preferences.ts `mateVoicePlayback`). */
  private playback = { volume: 1, playbackRate: 1 }
  setPlayback(playback: { volume: number; playbackRate: number }) {
    this.playback = playback
    if (this.audio) this.apply(this.audio)
  }
  private apply(audio: SampleAudio) {
    audio.volume = this.playback.volume
    audio.defaultPlaybackRate = this.playback.playbackRate
    audio.playbackRate = this.playback.playbackRate
  }
  constructor(create: (url: string) => SampleAudio = url => { const audio = new Audio(url); audio.preload = 'none'; return audio }) { this.create = create }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.status
  private update(status: SampleAudioStatus) { this.status = status; this.listeners.forEach(listener => listener()) }
  private release() {
    const audio = this.audio
    this.audio = null
    this.cleanup?.(); this.cleanup = null
    audio?.pause(); audio?.removeAttribute('src'); audio?.load()
  }
  async play(url: string) {
    this.release()
    this.update('loading')
    let audio: SampleAudio | undefined
    try {
      audio = this.create(url)
      this.apply(audio)
      this.audio = audio
      const ended = () => { if (this.audio === audio) { this.release(); this.update('idle') } }
      const failed = () => { if (this.audio === audio) { this.release(); this.update('error') } }
      audio.addEventListener('ended', ended); audio.addEventListener('error', failed)
      this.cleanup = () => { audio!.removeEventListener('ended', ended); audio!.removeEventListener('error', failed) }
      await audio.play()
      if (this.audio === audio) this.update('playing')
      else audio.pause()
    } catch {
      if (!audio || this.audio === audio) { this.release(); this.update('error') }
    }
  }
  stop() { this.release(); this.update('idle') }
}
