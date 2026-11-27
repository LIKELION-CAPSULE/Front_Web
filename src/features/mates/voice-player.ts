import type { MessageStreamAudio, MessageStreamAudioEnd } from '../../shared/api/types.ts'
import { decodeVoiceData, startsMp3File, VoiceChunkQueue } from './voice-reply.ts'

/*
 * Plays the mate's voice replies (28 `audio` pieces, 19 `audioBase64`) with Web Audio.
 *
 * Why Web Audio and not MediaSource: MSE `audio/mpeg` is not available in every Safari we support (and not at all on
 * iPhone Safari before ManagedMediaSource), while `AudioContext.decodeAudioData` decodes mp3 in Chrome, Edge and
 * Safari alike. Web Audio also gives the level for the mouth (AnalyserNode) and starts every piece on one sample
 * clock, so pieces join without a gap.
 *
 * Pieces may be whole mp3 files (one per sentence) or cuts of one mp3 stream (a cut can end mid-frame, and the next
 * one then starts without a header). The player handles both: pieces of one file form a segment that is decoded again
 * from its start as it grows (a cut alone would lose the frame it splits and the bit reservoir), and only the part
 * that can no longer change is scheduled — everything but the last ~80 ms until the segment is final. A piece that
 * starts a new file starts a new segment, right where the previous one ends.
 */

export type VoiceBuffer = { readonly length: number; readonly sampleRate: number; readonly duration: number }
type VoiceNode = { connect(target: never): unknown; disconnect(): void }
export type VoiceSource = VoiceNode & {
  buffer: VoiceBuffer | null
  onended: (() => void) | null
  start(when?: number, offset?: number, duration?: number): void
  stop(when?: number): void
}
export type VoiceContext = {
  readonly currentTime: number
  readonly state: string
  readonly destination: unknown
  resume(): Promise<void>
  close(): Promise<void>
  createGain(): VoiceNode & { gain: { value: number } }
  createAnalyser(): VoiceNode & { fftSize: number; getByteTimeDomainData(array: Uint8Array): void }
  createBufferSource(): VoiceSource
  decodeAudioData(data: ArrayBuffer, success?: (buffer: VoiceBuffer) => void, failure?: (error: unknown) => void): Promise<VoiceBuffer> | void
  addEventListener?(type: 'statechange', listener: () => void): void
  removeEventListener?(type: 'statechange', listener: () => void): void
}

/** `idle`: nothing to play · `playing`: a voice is playing (or decoding) · `blocked`: the browser holds it until a user gesture. */
export type VoicePlaybackStatus = 'idle' | 'playing' | 'blocked'

/**
 * Whether this browser can play the voice, from really preparing it (`prepare()`): the audio context made and its graph
 * (analyser → gain → speakers) connected. `pending` until tried; voice (`tts: true`, paid) is asked only when `ready`.
 */
export type VoiceAvailability = 'pending' | 'ready' | 'unavailable'

export type VoiceTurn = {
  /** A 28 `audio` piece (`seq`, base64 `data`). */
  push(audio: MessageStreamAudio): void
  /** 28 `audio_end`, or `null` when the stream closed without it. What arrived plays; the rest is let go quietly. */
  end(info: MessageStreamAudioEnd | null): void
}

/** The first piece starts this far ahead, so it never starts in the past. */
const LEAD_S = 0.06
/** The end of a segment still growing is held back this long (the frame a cut splits; decoder tails). */
const TAIL_GUARD_S = 0.08
/** A voice the browser held for longer than this is dropped when sound is allowed (the moment has passed). */
const BLOCKED_STALE_MS = 10_000

type Segment = { parts: Uint8Array[]; final: boolean; start: number | null; scheduled: number; decodedParts: number; decodedFinal: boolean }
type Turn = {
  queue: VoiceChunkQueue
  segments: Segment[]
  sources: Set<VoiceSource>
  /** Decodes run one at a time, in order. */
  work: Promise<void>
  pending: number
  /** Where the next segment may start (context time). */
  cursor: number
  startedAt: number
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

function defaultContext(): VoiceContext | null {
  if (typeof window === 'undefined') return null
  const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return null
  try { return new Context() as unknown as VoiceContext } catch { return null }
}

export class VoicePlayer {
  private context: VoiceContext | null = null
  private analyser: ReturnType<VoiceContext['createAnalyser']> | null = null
  private gain: ReturnType<VoiceContext['createGain']> | null = null
  private turn: Turn | null = null
  private status: VoicePlaybackStatus = 'idle'
  private availability: VoiceAvailability = 'pending'
  /** Bumped by `cut()`: a voice asked for before it (a reaction line on its way) is dropped when it arrives. */
  private generation = 0
  private volume = 1
  private readonly listeners = new Set<() => void>()
  private readonly createContext: () => VoiceContext | null
  private readonly now: () => number
  private readonly samples = new Uint8Array(1024)
  private smoothed = 0
  private levelAt = 0
  readonly supported: boolean

  constructor(options: { createContext?: () => VoiceContext | null; now?: () => number; supported?: boolean } = {}) {
    this.createContext = options.createContext ?? defaultContext
    this.now = options.now ?? (() => performance.now())
    this.supported = options.supported ?? (options.createContext ? true : typeof window !== 'undefined' &&
      Boolean(window.AudioContext ?? (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext))
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.status
  getAvailability = () => this.availability

  /**
   * Prepares the audio context now (it may start suspended until a gesture; `unlock()` resumes it) and reports whether
   * the voice can play here. Called when the call screen opens, so a paid voice is never asked for when it cannot play.
   */
  prepare(): boolean {
    return this.ensureContext() !== null
  }

  /** The current generation, taken when a voice is asked for; `play(data, ticket)` drops it after a `cut()`. */
  ticket(): number {
    return this.generation
  }

  /**
   * Stops the voice because the call no longer wants it (voice turned off, the user talking, the tab hidden without PiP,
   * the call ending): unlike a new reply replacing it, a voice asked for before this moment never plays.
   */
  cut() {
    this.generation++
    this.stop()
  }

  /** 0–1 (T-3 음성 볼륨). The speed (T-4) is the server's TTS speed, so playback always runs at 1×. */
  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1))
    if (this.gain) this.gain.gain.value = this.volume
  }

  private setAvailability(next: VoiceAvailability) {
    if (next === this.availability) return
    this.availability = next
    for (const listener of this.listeners) listener()
  }

  private ensureContext(): VoiceContext | null {
    if (this.context?.state === 'closed') this.dropContext()
    if (this.context) return this.context
    if (!this.supported) { this.setAvailability('unavailable'); return null }
    let context: VoiceContext | null = null
    try { context = this.createContext() } catch { context = null }
    if (!context) { this.setAvailability('unavailable'); return null }
    try {
      const analyser = context.createAnalyser()
      analyser.fftSize = this.samples.length
      const gain = context.createGain()
      gain.gain.value = this.volume
      // The level is read before the volume, so her mouth still moves with the volume turned down.
      analyser.connect(gain as never)
      gain.connect(context.destination as never)
      this.analyser = analyser
      this.gain = gain
    } catch {
      this.analyser = null
      this.gain = null
      void Promise.resolve().then(() => context.close()).catch(() => {})
      this.setAvailability('unavailable')
      return null
    }
    context.addEventListener?.('statechange', this.refresh)
    this.context = context
    this.setAvailability('ready')
    return context
  }

  private dropContext() {
    const context = this.context
    this.context = null
    this.analyser = null
    this.gain = null
    context?.removeEventListener?.('statechange', this.refresh)
    return context
  }

  /**
   * Allows sound after a user gesture (the browser's autoplay rule): call from a pointer or key event. A voice held
   * meanwhile plays from where it was, unless it was held too long.
   */
  unlock = () => {
    const context = this.ensureContext()
    if (!context || context.state === 'running') return
    if (this.turn && this.status === 'blocked' && this.now() - this.turn.startedAt > BLOCKED_STALE_MS) this.stop()
    void context.resume().catch(() => {}).finally(this.refresh)
  }

  /** Starts a new voice (a reply or a reaction line); the one before stops. */
  begin(): VoiceTurn {
    this.stop()
    const turn: Turn = { queue: new VoiceChunkQueue(), segments: [], sources: new Set(), work: Promise.resolve(), pending: 0, cursor: 0, startedAt: this.now() }
    this.turn = turn
    return {
      push: audio => {
        if (this.turn !== turn) return
        for (const piece of turn.queue.push(audio?.seq, decodeVoiceData(audio?.data))) this.addPiece(turn, piece)
      },
      end: info => {
        if (this.turn !== turn || turn.queue.closed) return
        turn.queue.end(info)
        const segment = turn.segments.at(-1)
        if (segment && !segment.final) { segment.final = true; this.decode(turn, segment) }
      },
    }
  }

  /** One whole mp3 (19 `audioBase64`). With `ticket` (taken when it was asked for): dropped if `cut()` came since. */
  play(data: string, ticket?: number) {
    if (ticket !== undefined && ticket !== this.generation) return
    const turn = this.begin()
    turn.push({ seq: 0, data })
    turn.end({ chunks: 1, complete: true })
  }

  /** Stops the voice now (a new reply, the user talking, the call ending, the screen out of sight). */
  stop() {
    const turn = this.turn
    this.turn = null
    if (turn) for (const source of turn.sources) {
      source.onended = null
      try { source.stop() } catch { /* Already stopped. */ }
      try { source.disconnect() } catch { /* Already disconnected. */ }
    }
    this.smoothed = 0
    this.refresh()
  }

  /** Mouth opening 0–1 from the voice playing now; null when no voice plays (the stage leaves the mouth alone). */
  level(): number | null {
    const turn = this.turn
    if (!turn || !turn.sources.size || this.status !== 'playing' || !this.analyser) return null
    this.analyser.getByteTimeDomainData(this.samples)
    let sum = 0
    for (const value of this.samples) { const x = (value - 128) / 128; sum += x * x }
    const rms = Math.sqrt(sum / this.samples.length)
    const target = Math.min(1, Math.max(0, (rms - 0.015) * 7))
    const now = this.now()
    const dt = this.levelAt && now > this.levelAt ? Math.min(0.1, (now - this.levelAt) / 1000) : 1 / 60
    this.levelAt = now
    // Opens fast, closes a little slower: lips, not a meter.
    const rate = target > this.smoothed ? 30 : 14
    this.smoothed += (target - this.smoothed) * (1 - Math.exp(-rate * dt))
    return this.smoothed
  }

  /** Stops and closes the audio context (the call screen going away); a later voice opens a new one. */
  release() {
    this.stop()
    const context = this.dropContext()
    this.setAvailability('pending')
    void context?.close().catch(() => {})
  }

  private addPiece(turn: Turn, bytes: Uint8Array) {
    if (!this.ensureContext()) return
    let segment = turn.segments.at(-1)
    if (segment && !segment.final && segment.parts.length && startsMp3File(bytes)) {
      segment.final = true
      this.decode(turn, segment)
    }
    if (!segment || segment.final) {
      segment = { parts: [], final: false, start: null, scheduled: 0, decodedParts: 0, decodedFinal: false }
      turn.segments.push(segment)
    }
    segment.parts.push(bytes)
    if (this.context?.state === 'suspended') void this.context.resume().catch(() => {}).finally(this.refresh)
    this.decode(turn, segment)
  }

  private decode(turn: Turn, segment: Segment) {
    turn.pending++
    this.refresh()
    turn.work = turn.work
      .then(() => this.decodeInto(turn, segment))
      .catch(() => { /* A cut that cannot be decoded yet waits for more; a final one plays what was scheduled. */ })
      .finally(() => { turn.pending--; this.refresh() })
  }

  private async decodeInto(turn: Turn, segment: Segment) {
    const context = this.context
    if (this.turn !== turn || !context) return
    // Several pieces may have arrived during the last decode: one decode covers them all.
    const count = segment.parts.length, final = segment.final
    if (count === segment.decodedParts && final === segment.decodedFinal) return
    segment.decodedParts = count
    segment.decodedFinal = final
    const bytes = concat(segment.parts.slice(0, count))
    const buffer = await new Promise<VoiceBuffer>((resolve, reject) => {
      try {
        // Callbacks for older Safari; the promise for the rest. A copy, since decoding detaches the buffer.
        const result = context.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer, resolve, reject)
        if (result && typeof result.then === 'function') result.then(resolve, reject)
      } catch (error) { reject(error) }
    })
    if (this.turn !== turn) return
    const rate = buffer.sampleRate
    const usable = final ? buffer.length : Math.max(0, buffer.length - Math.round(TAIL_GUARD_S * rate))
    if (usable > segment.scheduled) {
      const now = context.currentTime
      if (segment.start === null) segment.start = Math.max(turn.cursor, now + LEAD_S)
      let at = segment.start + segment.scheduled / rate
      // Decoding fell behind: the rest of this segment moves later together (a short pause, never an overlap).
      if (at < now + 0.01) { segment.start += now + 0.01 - at; at = now + 0.01 }
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(this.analyser as never)
      source.onended = () => {
        turn.sources.delete(source)
        try { source.disconnect() } catch { /* Already disconnected. */ }
        this.refresh()
      }
      turn.sources.add(source)
      source.start(at, segment.scheduled / rate, (usable - segment.scheduled) / rate)
      segment.scheduled = usable
    }
    if (final && segment.start !== null) turn.cursor = segment.start + usable / rate
  }

  private refresh = () => {
    const turn = this.turn
    const busy = Boolean(turn && (turn.sources.size > 0 || turn.pending > 0))
    const next: VoicePlaybackStatus = !busy ? 'idle' : this.context?.state === 'running' ? 'playing' : 'blocked'
    if (next === this.status) return
    this.status = next
    if (next !== 'playing') this.smoothed = 0
    for (const listener of this.listeners) listener()
  }
}
