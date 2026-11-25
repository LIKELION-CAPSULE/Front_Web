import type { UserSettings, UserSettingsPatch } from '../../shared/api/types.ts'
import type { ConnectionSettings, PipSize, TalkFrequency, VoiceSpeed, ConnectionMode } from './connection-preferences.ts'

/**
 * Settings tab T-1…T-10 ↔ API 29 · 30 (docs/API_FRONT_GAP_2026-11-25.md §4). Saved on the server: T-1 talk, T-2 voice,
 * T-3 volume, T-4 speed, T-6 PiP bubble, T-7 mode, T-9 PiP size. Browser only: T-5 devices, T-8 hold-to-talk, T-10 gaze.
 */
const TALK: Record<TalkFrequency, NonNullable<UserSettings['talkFrequency']>> = { quiet: 'QUIET', sometimes: 'SOMETIMES', often: 'OFTEN' }
const SPEED: Record<VoiceSpeed, NonNullable<UserSettings['voiceSpeed']>> = { slow: 'SLOW', normal: 'NORMAL', fast: 'FAST' }
const MODE: Record<ConnectionMode, NonNullable<UserSettings['defaultMode']>> = { basic: 'BASIC', advanced: 'ADVANCED' }
const PIP: Record<PipSize, NonNullable<UserSettings['pipSize']>> = { small: 'S', normal: 'M', large: 'L' }
const reverse = <K extends string, V extends string>(map: Record<K, V>) => Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key])) as Record<V, K>
const TALK_BACK = reverse(TALK), SPEED_BACK = reverse(SPEED), MODE_BACK = reverse(MODE), PIP_BACK = reverse(PIP)

/** The server keys of a local change (30 refuses unknown keys, so front-end names never go out as they are). */
export function toServerSettings(patch: Partial<ConnectionSettings>, pipBubble?: boolean): UserSettingsPatch {
  const body: UserSettingsPatch = {}
  if (patch.talk) body.talkFrequency = TALK[patch.talk]
  if (typeof patch.voice === 'boolean') body.voiceEnabled = patch.voice
  if (typeof patch.volume === 'number') body.voiceVolume = Math.round(Math.min(100, Math.max(0, patch.volume)))
  if (patch.speed) body.voiceSpeed = SPEED[patch.speed]
  if (patch.mode) body.defaultMode = MODE[patch.mode]
  if (patch.pipSize) body.pipSize = PIP[patch.pipSize]
  if (typeof pipBubble === 'boolean') body.pipBubble = pipBubble
  return body
}

/** 29 · 30 · 16 `settings` → the local fields they own; unknown values are skipped (the local value stays). */
export function fromServerSettings(value: UserSettings | null | undefined): { settings: Partial<ConnectionSettings>; pipBubble?: boolean } {
  const settings: Partial<ConnectionSettings> = {}
  if (!value) return { settings }
  if (value.talkFrequency && TALK_BACK[value.talkFrequency]) settings.talk = TALK_BACK[value.talkFrequency]
  if (typeof value.voiceEnabled === 'boolean') settings.voice = value.voiceEnabled
  if (typeof value.voiceVolume === 'number' && Number.isFinite(value.voiceVolume)) settings.volume = value.voiceVolume
  if (value.voiceSpeed && SPEED_BACK[value.voiceSpeed]) settings.speed = SPEED_BACK[value.voiceSpeed]
  if (value.defaultMode && MODE_BACK[value.defaultMode]) settings.mode = MODE_BACK[value.defaultMode]
  if (value.pipSize && PIP_BACK[value.pipSize]) settings.pipSize = PIP_BACK[value.pipSize]
  return { settings, ...(typeof value.pipBubble === 'boolean' ? { pipBubble: value.pipBubble } : {}) }
}
