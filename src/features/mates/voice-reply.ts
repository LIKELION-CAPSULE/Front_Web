import type { MessageStreamAudioEnd } from '../../shared/api/types.ts'

/*
 * Voice replies (docs/BACKEND_API.md 4.4 · 4.5, 11-25): the rules that decide when a voice is asked for, how its mp3
 * pieces line up, and when a voice that is playing stops. No DOM here (voice-player.ts plays it).
 */

/**
 * Whether a message (20 · 28) or a reaction line (19, `IDLE_TALK` too) asks for voice (`tts: true`). The server turns
 * voice on only when the request asks, the account's `voiceEnabled` is on and the balance covers it (20; 50 with
 * 고급 모드 — the cost is the server's, so the mode never changes the request). Never from the practice call (service
 * tour: no credits), never when this browser cannot play it (the credits would buy nothing).
 */
export function voiceRequested(input: { voiceEnabled: boolean; practice: boolean; playable: boolean; mode?: 'basic' | 'advanced' }) {
  return input.voiceEnabled && !input.practice && input.playable
}

/**
 * Why a voice that is playing stops. A new reply (or reaction line with voice) replaces it; the user starting to talk
 * (누르고 말하기), the connection ending and the screen going out of sight end it. Out of sight is the tab hidden with
 * no PiP window open: with PiP the call goes on in that window, so the voice does too.
 */
export type VoiceStopCause = 'reply' | 'listen' | 'disconnect' | 'hidden'
export function voiceStopsWhenHidden(input: { hidden: boolean; pipOpen: boolean }) {
  return input.hidden && !input.pipOpen
}

/** Push-to-talk states in which the user is talking (the voice gives way the moment a press starts). */
export function voiceStopsForListening(status: string) {
  return status === 'listening' || status === 'finishing'
}

/** `data` (base64) → bytes; null for anything that is not base64. */
export function decodeVoiceData(data: unknown): Uint8Array | null {
  if (typeof data !== 'string' || !data) return null
  try {
    const binary = atob(data.replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes.length ? bytes : null
  } catch {
    return null
  }
}

/**
 * Whether a piece starts a new mp3 file (an ID3 tag, or a first frame carrying a Xing / Info / VBRI header) rather than
 * continuing the stream before it. Files are decoded on their own: a decoder reading two files as one can stop at
 * the first file's frame count (Safari), so the player starts a new segment there.
 */
export function startsMp3File(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  if (bytes.length < 4 || bytes[0] !== 0xff || (bytes[1]! & 0xe0) !== 0xe0) return false
  const limit = Math.min(bytes.length - 4, 48)
  for (let index = 4; index <= limit; index++) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2], d = bytes[index + 3]
    if ((a === 0x58 && b === 0x69 && c === 0x6e && d === 0x67) || (a === 0x49 && b === 0x6e && c === 0x66 && d === 0x6f) || (a === 0x56 && b === 0x42 && c === 0x52 && d === 0x49)) return true
  }
  return false
}

/** Pieces held while one before them is missing; more than this is not a voice reply. */
const MAX_HELD = 256

/**
 * 28 `audio` pieces in `seq` order. Pieces come in order on one stream, but the order is still checked: a piece
 * whose turn has not come is held until the ones before it arrive, a repeated or older piece is ignored. The first
 * piece sets the base (0, or 1 when the first is 1). After `audio_end` (or the stream closing without it) whatever
 * is still missing stays missing: playback ends where the unbroken run ends, quietly.
 */
export class VoiceChunkQueue {
  private next: number | null = null
  private readonly held = new Map<number, Uint8Array>()
  private delivered = 0
  private ended = false
  private incomplete = false

  /** Adds a piece; returns the pieces that can play now, in order. */
  push(seq: unknown, bytes: Uint8Array | null): Uint8Array[] {
    if (this.ended || !bytes || typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0) return []
    if (this.next === null) this.next = seq === 1 ? 1 : 0
    if (seq < this.next || this.held.has(seq) || seq - this.next > MAX_HELD) return []
    this.held.set(seq, bytes)
    const ready: Uint8Array[] = []
    for (let piece = this.held.get(this.next); piece; piece = this.held.get(this.next)) {
      this.held.delete(this.next)
      this.next++
      this.delivered++
      ready.push(piece)
    }
    return ready
  }

  /** `audio_end`, or the stream closing without it (`null`). Later pieces are ignored. */
  end(info: MessageStreamAudioEnd | null): { complete: boolean; delivered: number } {
    if (!this.ended) {
      this.ended = true
      const expected = typeof info?.chunks === 'number' && Number.isSafeInteger(info.chunks) && info.chunks >= 0 ? info.chunks : null
      this.incomplete = !info || info.complete === false || this.held.size > 0 || (expected !== null && this.delivered < expected)
      this.held.clear()
    }
    return { complete: !this.incomplete, delivered: this.delivered }
  }

  get closed() { return this.ended }
  /** Pieces waiting for a missing one. */
  get waiting() { return this.held.size }
}
