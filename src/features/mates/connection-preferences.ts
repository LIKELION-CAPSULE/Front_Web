/** Presentation preference on this browser; never a server voice, credit or account setting. */
export const pipSpeechKey = (userId: number) => `capsule-pip-speech:v1:${userId}`

export class PipSpeechPreference {
  private visible = true
  private readonly listeners = new Set<() => void>()
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
  private readonly userId: number | null
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null, userId: number | null) {
    this.storage = storage
    this.userId = userId
    if (!userId) return
    try {
      const saved: unknown = JSON.parse(storage?.getItem(pipSpeechKey(userId)) ?? 'null')
      if (typeof saved === 'boolean') this.visible = saved
    } catch { /* Keep the original visible bubble if storage is unavailable or invalid. */ }
  }
  getSnapshot = () => this.visible
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  setVisible = (visible: boolean) => {
    if (this.visible === visible) return
    this.visible = visible
    if (this.userId) try { this.storage?.setItem(pipSpeechKey(this.userId), JSON.stringify(visible)) } catch { /* Keep the choice in memory. */ }
    this.listeners.forEach(listener => listener())
  }
}

/*
 * Connection settings (account settings 「설정」 tab, PRD §7.9 T-1…T-10): presentation preferences of this browser,
 * per account, like the PIP bubble above. Nothing here is a server setting; items that need the server say so where
 * they are read. One object under one key; an unreadable or partly invalid value falls back field by field.
 */
export type TalkFrequency = 'quiet' | 'sometimes' | 'often'
export type VoiceSpeed = 'slow' | 'normal' | 'fast'
export type PipSize = 'small' | 'normal' | 'large'
export type ConnectionMode = 'basic' | 'advanced'
export type ConnectionSettings = {
  /** T-1 말 걸기 빈도. */
  talk: TalkFrequency
  /** T-2 메이트 음성 (voice replies; off costs no credits): the server's `voiceEnabled` (default true there). */
  voice: boolean
  /**
   * The user turned 메이트 음성 on themselves (this browser, this account). The server's `voiceEnabled` starts true, so
   * voice is on only with both (`mateVoiceOn`): nothing asks for voice (20 credits a reply) before the user chose it.
   */
  voiceOptIn: boolean
  /** T-3 음성 볼륨, 0–100. */
  volume: number
  /** T-4 음성 속도. */
  speed: VoiceSpeed
  /** T-7 the conversation mode a connection starts in. */
  mode: ConnectionMode
  /** T-8 hold Space to talk. */
  holdToTalk: boolean
  /** T-9 PIP window size. */
  pipSize: PipSize
  /** T-10 the mate's gaze follows the mouse during a connection. */
  gaze: boolean
}

export const DEFAULT_CONNECTION_SETTINGS: Readonly<ConnectionSettings> = {
  talk: 'sometimes',
  voice: true,
  voiceOptIn: false,
  volume: 70,
  speed: 'normal',
  mode: 'basic',
  holdToTalk: true,
  pipSize: 'normal',
  gaze: true,
}

export const connectionSettingsKey = (userId: number) => `capsule-connection-settings:v1:${userId}`

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

/** Reads a stored value field by field; anything missing or invalid keeps its default. */
export function parseConnectionSettings(raw: unknown): ConnectionSettings {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const base = DEFAULT_CONNECTION_SETTINGS
  const volume = typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.round(Math.min(100, Math.max(0, value.volume))) : base.volume
  return {
    talk: oneOf(value.talk, ['quiet', 'sometimes', 'often'], base.talk),
    voice: typeof value.voice === 'boolean' ? value.voice : base.voice,
    voiceOptIn: typeof value.voiceOptIn === 'boolean' ? value.voiceOptIn : base.voiceOptIn,
    volume,
    speed: oneOf(value.speed, ['slow', 'normal', 'fast'], base.speed),
    mode: oneOf(value.mode, ['basic', 'advanced'], base.mode),
    holdToTalk: typeof value.holdToTalk === 'boolean' ? value.holdToTalk : base.holdToTalk,
    pipSize: oneOf(value.pipSize, ['small', 'normal', 'large'], base.pipSize),
    gaze: typeof value.gaze === 'boolean' ? value.gaze : base.gaze,
  }
}

export class ConnectionSettingsStore {
  private value: ConnectionSettings = { ...DEFAULT_CONNECTION_SETTINGS }
  private readonly listeners = new Set<() => void>()
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
  private readonly userId: number | null
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null, userId: number | null) {
    this.storage = storage
    this.userId = userId
    if (!userId) return
    try {
      const saved = storage?.getItem(connectionSettingsKey(userId))
      if (saved) this.value = parseConnectionSettings(JSON.parse(saved))
    } catch { /* Defaults when storage is unavailable or the value is broken. */ }
  }
  getSnapshot = () => this.value
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  update = (patch: Partial<ConnectionSettings>) => {
    const next = parseConnectionSettings({ ...this.value, ...patch })
    if ((Object.keys(next) as (keyof ConnectionSettings)[]).every((key) => next[key] === this.value[key])) return
    this.value = next
    if (this.userId) try { this.storage?.setItem(connectionSettingsKey(this.userId), JSON.stringify(next)) } catch { /* Keep it in memory. */ }
    this.listeners.forEach((listener) => listener())
  }
}

/**
 * T-2 as the user sees and uses it (settings switch, the call dock's button, `tts`): on only when the user turned it on
 * (2026-11-26 decision (a): the server default `voiceEnabled: true` alone never spends credits) and the server copy
 * says on. Why a browser mark and not a server write: the server keeps no "the user chose this" record (30 refuses
 * unknown keys), so resetting its default to false would also turn off a voice the user chose on another device; the
 * mark never spends a credit the user did not choose, at the cost of choosing once per browser.
 */
export function mateVoiceOn(settings: Pick<ConnectionSettings, 'voice' | 'voiceOptIn'>) {
  return settings.voice && settings.voiceOptIn
}

/** Turning 메이트 음성 on or off: the mark and the server's `voiceEnabled` together (only `voice` is saved to 30). */
export function mateVoicePatch(on: boolean): Pick<ConnectionSettings, 'voice' | 'voiceOptIn'> {
  return { voice: on, voiceOptIn: on }
}

/** The one-time 「메이트 목소리로 답해요」 note when 메이트 음성 is first turned on from the call screen. */
export const voiceIntroKey = (userId: number) => `capsule-voice-intro:v1:${userId}`

/** T-4: playback rate per speed step (pitch is preserved by the browser's default `preservesPitch`). */
export const VOICE_RATE: Readonly<Record<VoiceSpeed, number>> = { slow: 0.85, normal: 1, fast: 1.2 }

/**
 * The one place mate voice playback reads its volume and speed (the voice sample now; TTS replies later): HTMLMediaElement
 * `volume` (0–1) and `playbackRate`.
 */
export function mateVoicePlayback(settings: Pick<ConnectionSettings, 'volume' | 'speed'>) {
  return { volume: Math.min(1, Math.max(0, settings.volume / 100)), playbackRate: VOICE_RATE[settings.speed] }
}

/** T-9: Document PiP window size per step (보통 = the previous fixed 360 × 520; 작게 0.85×, 크게 1.2×). */
export const PIP_WINDOW_SIZE: Readonly<Record<PipSize, { width: number; height: number }>> = {
  small: { width: 306, height: 442 },
  normal: { width: 360, height: 520 },
  large: { width: 432, height: 624 },
}

/** T-1: the short label (the stage's segment) and what it means (settings row, the stage's tooltip and brief note). */
export const TALK_OPTIONS: readonly { value: TalkFrequency; label: string; description: string }[] = [
  { value: 'quiet', label: '조용히', description: '내가 말할 때만 답해요' },
  { value: 'sometimes', label: '가끔', description: '가끔 먼저 말을 걸어요' },
  { value: 'often', label: '자주', description: '자주 먼저 말을 걸어요' },
]
