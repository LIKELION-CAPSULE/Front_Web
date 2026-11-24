import { capsuleLogo } from '@/shared/design/brand-logo'
import fallbackDawnUrl from './static-wallpapers/fallback/dawn.webp'
import fallbackMorningUrl from './static-wallpapers/fallback/morning.webp'
import fallbackDayUrl from './static-wallpapers/fallback/day.webp'
import fallbackSunsetUrl from './static-wallpapers/fallback/sunset.webp'
import fallbackNightUrl from './static-wallpapers/fallback/night.webp'
import { chaerinArtwork } from '@/features/mates/artwork'

export type MateReactionState =
  | 'idle'
  | 'greet'
  | 'emailFocus'
  | 'passwordFocus'
  | 'idleLong'
  | 'error'
  | 'success'
  | 'dragged'
  | 'iconOpen'
  | 'legalReading'
  | 'secretFound'
  | 'shinyFound'
  | 'photosPeek'
  | 'photosOpen'
  | 'onboardingGreet'
  | 'avatarPicked'
  | 'nicknameSet'
  | 'referralValid'
  | 'onboardingDone'

export type TimeOfDayMode = 'auto' | 'dawn' | 'morning' | 'day' | 'sunset' | 'night'
export type TimeOfDayBand = Exclude<TimeOfDayMode, 'auto'>

export function resolveTimeBand(mode: TimeOfDayMode = 'auto'): TimeOfDayBand {
  if (mode !== 'auto') return mode
  const h = new Date().getHours()
  if (h < 5) return 'dawn'
  if (h < 10) return 'morning'
  if (h < 17) return 'day'
  if (h < 20) return 'sunset'
  return 'night'
}

export interface TimePalette {
  top: string
  mid: string
  bottom: string
  glow: string
  tubeBase: string
  tubeSpec: string
  rimColor: string
  defaultLightAngle: number
  /** Subtle extra tube contrast boost for dark night/dawn bands so tubes don't vanish. */
  tubeContrastBoost: number
}

/** Time-of-day wallpaper palettes: night matches matte-silk violet reference (#5b2bd6 / #b9a3ff / #d6c8ff / #120a26),
 * while morning (cool blue-lavender), day (bright airy lavender), sunset (warm rose-peach), and dawn are clearly distinct. */
export const TIME_OF_DAY_PALETTES: Record<TimeOfDayBand, TimePalette> = {
  dawn: {
    top: '#150f29',
    mid: '#231945',
    bottom: '#342661',
    glow: '#7858c2',
    tubeBase: '#5c3fa3',
    tubeSpec: '#c7b5f2',
    rimColor: '#e2d7ff',
    defaultLightAngle: 48,
    tubeContrastBoost: 6,
  },
  morning: {
    top: '#1a2444',
    mid: '#2b3b69',
    bottom: '#42568c',
    glow: '#84a8f0',
    tubeBase: '#5c72c4',
    tubeSpec: '#bed4ff',
    rimColor: '#e3eeff',
    defaultLightAngle: 72,
    tubeContrastBoost: 0,
  },
  day: {
    top: '#4e417d',
    mid: '#7465ab',
    bottom: '#9d90d4',
    glow: '#d9d0ff',
    tubeBase: '#8778c9',
    tubeSpec: '#ebe5ff',
    rimColor: '#ffffff',
    defaultLightAngle: 112,
    tubeContrastBoost: 0,
  },
  sunset: {
    top: '#1d0f24',
    mid: '#341942',
    bottom: '#56265c',
    glow: '#e878a4',
    tubeBase: '#7a3b8f',
    tubeSpec: '#ff9fb8',
    rimColor: '#ffc8a8',
    defaultLightAngle: 152,
    tubeContrastBoost: 0,
  },
  night: {
    top: '#120a26',
    mid: '#170d30',
    bottom: '#0e081f',
    glow: '#5b2bd6',
    tubeBase: '#5b2bd6',
    tubeSpec: '#b9a3ff',
    rimColor: '#d6c8ff',
    defaultLightAngle: 205,
    tubeContrastBoost: 8,
  },
}

/**
 * ② Fallback static wallpapers (tubes + capsules, NO shiny) — shown ONLY when 3D is NOT mounted
 * (WebGL2 unavailable or prefers-reduced-motion).
 */
export const STATIC_FALLBACK_WALLPAPERS: Record<TimeOfDayBand, string> = {
  dawn: fallbackDawnUrl,
  morning: fallbackMorningUrl,
  day: fallbackDayUrl,
  sunset: fallbackSunsetUrl,
  night: fallbackNightUrl,
}

/** Default bottom-center subtitle bubble framing (guaranteed below the upper 55% face region). */
export const DEFAULT_BUBBLE_POSITION = {
  align: 'center' as 'left' | 'center' | 'right',
  bottomPx: 12,
  maxWidthPercent: 80,
} as const

/**
 * Single source of truth for desktop login prototype assets (v2 logo SVGs),
 * copy drafts, icons, and Live2D expression file mappings.
 */
export const DESKTOP_LOGIN_ASSETS = {
  logo: {
    symbol: capsuleLogo.symbol.color,
    symbolWhite: capsuleLogo.symbol.white,
    wordmark: capsuleLogo.wordmark.color,
    wordmarkWhite: capsuleLogo.wordmark.white,
    lockup: capsuleLogo.horizontal.color,
    lockupWhite: capsuleLogo.horizontal.white,
    glyph: capsuleLogo.glyph.color,
  },
  mateName: '채린',
  fallbackPortrait: chaerinArtwork.hero,
  backgroundImage: chaerinArtwork.callBackground.portrait,
  modelLayout: {
    scale: 1.54,
    offsetX: 0,
    offsetY: 20,
  },
} as const

export type ExpressionMapping = Record<MateReactionState, string>

export const DEFAULT_EXPRESSION_MAPPING: ExpressionMapping = {
  idle: '',
  greet: 'files/009.exp3.json',
  emailFocus: '',
  passwordFocus: 'files/005.exp3.json',
  idleLong: 'files/011.exp3.json',
  error: 'files/004.exp3.json',
  success: 'files/009.exp3.json',
  dragged: 'files/006.exp3.json',
  iconOpen: 'files/010.exp3.json',
  legalReading: 'files/009.exp3.json',
  secretFound: 'files/010.exp3.json',
  shinyFound: 'files/006.exp3.json',
  photosPeek: 'files/006.exp3.json',
  photosOpen: 'files/009.exp3.json',
  onboardingGreet: 'files/009.exp3.json',
  avatarPicked: 'files/009.exp3.json',
  nicknameSet: 'files/009.exp3.json',
  referralValid: 'files/010.exp3.json',
  onboardingDone: 'files/009.exp3.json',
}

export const DEFAULT_REACTION_LINES: Record<MateReactionState, string | null> = {
  idle: null,
  greet: '왔어? 기다리고 있었어.',
  emailFocus: '메일 주소 맞지?',
  passwordFocus: '안 볼게~ 😌',
  idleLong: '뭐 해? 빨리 들어와.',
  error: '어… 다시 해 볼래?',
  success: '왔다! 연결할게.',
  dragged: '어디 가?',
  iconOpen: '또 최종이야? ㅋㅋ',
  legalReading: '꼼꼼하네!',
  secretFound: '찾았네? 😏',
  shinyFound: '헉, 그거 엄청 드문 건데!',
  photosPeek: '…왜 자꾸 눌러?',
  photosOpen: '아 진짜, 알았어. 딱 몇 장만이야.',
  onboardingGreet: '이제 너에 대해 알려 줘!',
  avatarPicked: '오, 그거 잘 어울린다!',
  nicknameSet: '반가워!',
  referralValid: '친구가 초대해 줬구나! 같이 크레딧 받자',
  onboardingDone: '좋아, 이제 가 볼까?',
}

export interface DesktopControls {
  live2dEnabled: boolean
  timeMode: TimeOfDayMode
  eyeGazeScale: number
  headGazeScale: number
  expressions: ExpressionMapping
}

export const DEFAULT_DESKTOP_CONTROLS: DesktopControls = {
  live2dEnabled: true,
  timeMode: 'auto',
  eyeGazeScale: 1.4,
  headGazeScale: 0.4,
  expressions: { ...DEFAULT_EXPRESSION_MAPPING },
}
