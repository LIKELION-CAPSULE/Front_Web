import loginChaerinHero from '@/assets/characters/chaerin-live2d-v1/chaerin-hero.webp'
import symbolColorUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-symbol-color.svg'
import symbolWhiteUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-symbol-white.svg'
import wordmarkColorUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-wordmark-color.svg'
import wordmarkWhiteUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-wordmark-white.svg'
import horizontalColorUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-horizontal-color.svg'
import horizontalWhiteUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-horizontal-white.svg'
import glyphColorUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-glyph-color.svg'
import tubesOnlyDawnUrl from './static-wallpapers/tubes-only/dawn.webp'
import tubesOnlyMorningUrl from './static-wallpapers/tubes-only/morning.webp'
import tubesOnlyDayUrl from './static-wallpapers/tubes-only/day.webp'
import tubesOnlySunsetUrl from './static-wallpapers/tubes-only/sunset.webp'
import tubesOnlyNightUrl from './static-wallpapers/tubes-only/night.webp'
import fallbackDawnUrl from './static-wallpapers/fallback/dawn.webp'
import fallbackMorningUrl from './static-wallpapers/fallback/morning.webp'
import fallbackDayUrl from './static-wallpapers/fallback/day.webp'
import fallbackSunsetUrl from './static-wallpapers/fallback/sunset.webp'
import fallbackNightUrl from './static-wallpapers/fallback/night.webp'
import { LOCAL_MODEL_URL } from '@/features/local-demo/store'
import { chaerinArtwork } from '@/features/mates/artwork'
import type { RoundedPolylineSpec } from './tube-geometry'

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

export const MATE_REACTION_STATES: readonly MateReactionState[] = [
  'idle',
  'greet',
  'emailFocus',
  'passwordFocus',
  'idleLong',
  'error',
  'success',
  'dragged',
  'iconOpen',
  'legalReading',
  'secretFound',
  'shinyFound',
  'photosPeek',
  'photosOpen',
  'onboardingGreet',
  'avatarPicked',
  'nicknameSet',
  'referralValid',
  'onboardingDone',
] as const

export const MATE_REACTION_LABELS: Record<MateReactionState, string> = {
  idle: '기본',
  greet: '인사',
  emailFocus: '이메일 입력',
  passwordFocus: '비밀번호',
  idleLong: '오래 대기',
  error: '오류',
  success: '로그인 성공',
  dragged: '창 드래그',
  iconOpen: '아이콘 열기',
  legalReading: '약관 읽기',
  secretFound: '숨은 글자',
  shinyFound: '이로치 발견',
  photosPeek: '사진 폴더 연타',
  photosOpen: '사진 공개',
  onboardingGreet: '온보딩 인사',
  avatarPicked: '아바타 선택',
  nicknameSet: '닉네임 설정',
  referralValid: '추천인 확인',
  onboardingDone: '온보딩 완료',
}

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

export const TIME_OF_DAY_OPTIONS: ReadonlyArray<{ value: TimeOfDayMode; label: string }> = [
  { value: 'auto', label: '자동' },
  { value: 'dawn', label: '새벽' },
  { value: 'morning', label: '아침' },
  { value: 'day', label: '낮' },
  { value: 'sunset', label: '노을' },
  { value: 'night', label: '밤' },
] as const

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
 * ① First-paint static wallpapers (tubes only, NO capsules) — shown only while 3D loads,
 * then cross-faded out and unmounted from DOM once 3D is ready.
 */
export const STATIC_FIRST_PAINT_WALLPAPERS: Record<TimeOfDayBand, string> = {
  dawn: tubesOnlyDawnUrl,
  morning: tubesOnlyMorningUrl,
  day: tubesOnlyDayUrl,
  sunset: tubesOnlySunsetUrl,
  night: tubesOnlyNightUrl,
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

/** Shiny (rare) capsule easter egg defaults. */
export const SHINY_CAPSULE_CONFIG = {
  defaultSpawnChancePercent: 25,
  spawnDelayMinMs: 8_000,
  spawnDelayMaxMs: 20_000,
  scaleMultiplier: 1.8,
  sparkleIntervalMinMs: 4_000,
  sparkleIntervalMaxMs: 6_000,
  popDurationMs: 800,
  followUpSmileFile: 'files/010.exp3.json',
  followUpSmileDelayMs: 750,
} as const

/** FPS degradation thresholds (3 consecutive seconds below 30 FPS steps down 1 stage, never reverts). */
export const LOW_FPS_DEGRADATION = {
  thresholdFps: 30,
  windowMs: 3_000,
  stage1ResolutionScale: 0.65,
} as const

/** Exact geometric constants from design/brand/capsule-logo-2026-11-22-v2/geometry.json */
export const CAPSULE_V2_GEOMETRY = {
  length: 364.04,
  height: 159.9,
  radius: 79.95,
  halfStraight: 102.07,
  angleDegrees: -31.12,
  seam: {
    rx: 47.2,
    ry: 78.86,
    angleDegrees: -26.3,
    offsetX: 260.91 - 242.64,
    offsetY: 225.7 - 236.73,
  },
} as const

export interface DesktopIconItem {
  id: string
  label: string
  kind: 'pdf' | 'fig' | 'folder'
  reactionLine: string
}

/**
 * Single source of truth for desktop login prototype assets (v2 logo SVGs),
 * copy drafts, icons, and Live2D expression file mappings.
 */
export const DESKTOP_LOGIN_ASSETS = {
  logo: {
    symbol: symbolColorUrl,
    symbolWhite: symbolWhiteUrl,
    wordmark: wordmarkColorUrl,
    wordmarkWhite: wordmarkWhiteUrl,
    lockup: horizontalColorUrl,
    lockupWhite: horizontalWhiteUrl,
    glyph: glyphColorUrl,
  },
  mateName: '채린',
  modelUrl: LOCAL_MODEL_URL,
  fallbackPortrait: loginChaerinHero,
  backgroundImage: chaerinArtwork.callBackground.portrait,
  modelLayout: {
    scale: 1.54,
    offsetX: 0,
    offsetY: 20,
  },
} as const

export const DESKTOP_ICONS: readonly DesktopIconItem[] = [
  {
    id: 'homework-pdf',
    label: '과제_최종_진짜최종.pdf',
    kind: 'pdf',
    reactionLine: '또 최종이야? ㅋㅋ',
  },
  {
    id: 'spec-fig',
    label: '기획서_v3.fig',
    kind: 'fig',
    reactionLine: '기획서 또 고쳐?',
  },
  {
    id: 'photos-folder',
    label: '사진',
    kind: 'folder',
    reactionLine: '사진은 비밀이야.',
  },
] as const

export const EXPRESSION_FILE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: '기본 (해제)' },
  { value: 'files/004.exp3.json', label: '004 (시무룩/찡그림)' },
  { value: 'files/005.exp3.json', label: '005 (눈 감고 웃음)' },
  { value: 'files/006.exp3.json', label: '006 (곁눈질/놀람)' },
  { value: 'files/007.exp3.json', label: '007 (눈 감고 크게 벌림)' },
  { value: 'files/008.exp3.json', label: '008 (당황/위 보기)' },
  { value: 'files/009.exp3.json', label: '009 (따뜻한 미소)' },
  { value: 'files/010.exp3.json', label: '010 (장난스러운 웃음)' },
  { value: 'files/011.exp3.json', label: '011 (고개 갸웃/아래)' },
] as const

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

/**
 * Layered matte-silk ribbon geometry defaults (macOS wallpaper reference aesthetic):
 * - Broad flat-bevel ribbons stacked in 5–7 parallel layers with a crisp dark crevice between layers
 */
export const TUBE_STYLE_DEFAULTS = {
  radius: 0.095,
  gapRatio: 0.78,
} as const

export const RIBBON_STYLE_DEFAULTS = {
  ribbonWidth: 0.34,
  ribbonDepth: 0.085,
  layerGapRatio: 0.15,
  decoyLayers: 5,
  wordmarkLayers: 3,
} as const

/**
 * Looser, sweeping rounded ribbon paths spelling "CAPSULE" subtly across 2 rows (CAP / SULE).
 * Very quiet in the dark background so it never clutters windows and is discovered only on close inspection.
 */
export const HIDDEN_WORDMARK_SPECS: readonly RoundedPolylineSpec[] = [
  // C
  {
    points: [
      [-1.42, 0.82],
      [-1.98, 0.82],
      [-1.98, 0.12],
      [-1.42, 0.12],
    ],
    cornerRadius: 0.34,
    tracks: 3,
    zBias: -0.18,
  },
  // A
  {
    points: [
      [-1.14, 0.12],
      [-1.14, 0.84],
      [-0.56, 0.84],
      [-0.56, 0.12],
    ],
    cornerRadius: 0.32,
    tracks: 3,
    zBias: -0.18,
  },
  {
    points: [
      [-1.1, 0.44],
      [-0.6, 0.44],
    ],
    cornerRadius: 0.14,
    tracks: 2,
    zBias: -0.2,
  },
  // P
  {
    points: [
      [-0.26, 0.12],
      [-0.26, 0.84],
      [0.36, 0.84],
      [0.36, 0.44],
      [-0.24, 0.44],
    ],
    cornerRadius: 0.24,
    tracks: 3,
    zBias: -0.18,
  },
  // S
  {
    points: [
      [-1.38, -0.14],
      [-1.96, -0.14],
      [-1.96, -0.49],
      [-1.38, -0.49],
      [-1.38, -0.84],
      [-1.96, -0.84],
    ],
    cornerRadius: 0.22,
    tracks: 3,
    zBias: -0.18,
  },
  // U
  {
    points: [
      [-1.08, -0.14],
      [-1.08, -0.84],
      [-0.52, -0.84],
      [-0.52, -0.14],
    ],
    cornerRadius: 0.32,
    tracks: 3,
    zBias: -0.18,
  },
  // L
  {
    points: [
      [-0.22, -0.14],
      [-0.22, -0.84],
      [0.34, -0.84],
    ],
    cornerRadius: 0.28,
    tracks: 3,
    zBias: -0.18,
  },
  // E
  {
    points: [
      [1.22, -0.14],
      [0.64, -0.14],
      [0.64, -0.84],
      [1.22, -0.84],
    ],
    cornerRadius: 0.26,
    tracks: 3,
    zBias: -0.18,
  },
  {
    points: [
      [0.66, -0.49],
      [1.14, -0.49],
    ],
    cornerRadius: 0.14,
    tracks: 2,
    zBias: -0.2,
  },
]

/**
 * 4 large, sweeping edge-framing flat matte-silk ribbon bundles (4–5 parallel layers each).
 * Wide single arcs (curvature radius > 35–50% of viewport height) entering & exiting screen edges,
 * intentionally leaving >45% of the viewport (especially behind Login, Mate, and central app windows)
 * as calm open dark space.
 */
export const HIDDEN_DECOY_BUNDLES: readonly RoundedPolylineSpec[] = [
  // 1. Top-left grand sweeping arch entering left edge and exiting upper edge
  {
    points: [
      [-2.85, 0.24],
      [-1.55, 0.96],
      [-0.22, 1.18],
      [1.35, 1.66],
    ],
    cornerRadius: 0.85,
    tracks: 5,
    offsetSign: 1,
    zBias: 0.14,
    smooth: true,
  },
  // 2. Bottom-left grand sweeping curve framing the lower-left edge
  {
    points: [
      [-2.85, -0.44],
      [-1.62, -0.92],
      [-0.26, -1.16],
      [1.15, -1.62],
    ],
    cornerRadius: 0.85,
    tracks: 5,
    offsetSign: -1,
    zBias: 0.16,
    smooth: true,
  },
  // 3. Right-edge grand sweeping curve framing the right margin
  {
    points: [
      [2.45, 1.62],
      [1.62, 0.42],
      [1.48, -0.56],
      [2.38, -1.62],
    ],
    cornerRadius: 0.85,
    tracks: 5,
    offsetSign: 1,
    zBias: 0.18,
    smooth: true,
  },
  // 4. Far top-right subtle fold adding depth to the upper-right corner
  {
    points: [
      [0.82, 1.62],
      [1.76, 1.02],
      [2.85, 0.52],
    ],
    cornerRadius: 0.85,
    tracks: 4,
    offsetSign: 1,
    zBias: 0.08,
    smooth: true,
  },
]

/**
 * Auth-only lower-center ribbon sweep passing gently beneath the Mate & Login windows
 * to reduce bottom-center emptiness on Login/Signup while keeping calm app screens unchanged.
 */
export const AUTH_LOWER_RIBBON_SPECS: readonly RoundedPolylineSpec[] = [
  {
    points: [
      [-1.75, -1.32],
      [-0.55, -0.88],
      [0.68, -0.92],
      [2.05, -1.34],
    ],
    cornerRadius: 0.95,
    tracks: 4,
    offsetSign: -1,
    zBias: 0.1,
    smooth: true,
  },
]

export const SECRET_HOVER_TRIGGER_MS = 2_500
export const SECRET_MAX_REACTIONS_PER_VISIT = 2

export interface DesktopControls {
  capsuleCount: number
  capsuleSpeed: number
  purpleAccentRatio: number
  shinySpawnChance: number
  live2dEnabled: boolean
  timeMode: TimeOfDayMode
  hiddenContrast: number
  hiddenScale: number
  hiddenOffsetX: number
  hiddenOffsetY: number
  hiddenLightAngle: number | null
  decoyDensity: number
  eyeGazeScale: number
  headGazeScale: number
  expressions: ExpressionMapping
}

export const DEFAULT_DESKTOP_CONTROLS: DesktopControls = {
  capsuleCount: 24,
  capsuleSpeed: 20,
  purpleAccentRatio: 20,
  shinySpawnChance: SHINY_CAPSULE_CONFIG.defaultSpawnChancePercent,
  live2dEnabled: true,
  timeMode: 'auto',
  hiddenContrast: 10,
  hiddenScale: 1.4,
  hiddenOffsetX: 4,
  hiddenOffsetY: 0,
  hiddenLightAngle: null,
  decoyDensity: 2.5,
  eyeGazeScale: 1.4,
  headGazeScale: 0.4,
  expressions: { ...DEFAULT_EXPRESSION_MAPPING },
}

export const MENU_BAR_HEIGHT = 32

export interface WindowRect {
  x: number
  y: number
  width: number
  height?: number
}

export function getDefaultWindowRects(viewportW: number, viewportH: number): {
  mate: WindowRect
  login: WindowRect
} {
  if (viewportW <= 1040) {
    const mateW = Math.min(340, Math.floor((viewportW - 48) * 0.4))
    const mateH = Math.min(500, Math.max(400, viewportH - MENU_BAR_HEIGHT - 140))
    const loginW = Math.min(460, Math.max(360, viewportW - mateW - 48))
    const gap = 18
    const totalW = mateW + gap + loginW
    const mateX = Math.max(16, Math.round((viewportW - totalW) / 2))
    const loginX = mateX + mateW + gap
    const loginY = MENU_BAR_HEIGHT + 52
    const mateY = Math.min(viewportH - mateH - 24, loginY + 48)
    return {
      mate: { x: mateX, y: Math.max(MENU_BAR_HEIGHT + 36, mateY), width: mateW, height: mateH },
      login: { x: loginX, y: loginY, width: loginW },
    }
  }

  const mateW = 380
  const mateH = Math.min(540, Math.max(440, viewportH - MENU_BAR_HEIGHT - 160))
  const loginW = 460
  const gap = viewportW >= 1400 ? 112 : 44
  const rightPad = viewportW >= 1400 ? 124 : 44

  const loginX = Math.max(mateW + 168, viewportW - loginW - rightPad)
  const mateX = Math.max(148, loginX - gap - mateW)

  const loginY = viewportH >= 860 ? MENU_BAR_HEIGHT + 68 : MENU_BAR_HEIGHT + 60
  const stagger = viewportH >= 860 ? 84 : 68
  const mateY = Math.min(viewportH - mateH - 28, loginY + stagger)

  return {
    mate: { x: mateX, y: Math.max(MENU_BAR_HEIGHT + 40, mateY), width: mateW, height: mateH },
    login: { x: loginX, y: loginY, width: loginW },
  }
}

export const ONBOARDING_WINDOW_WIDTH = 500
const PAUSE_TOGGLE_CLEAR_Y = 92
const ONBOARDING_IDEAL_HEIGHT = 752

export function getOnboardingWindowRect(
  viewportW: number,
  viewportH: number,
  baseRects = getDefaultWindowRects(viewportW, viewportH),
): { x: number; y: number; width: number; maxHeight: number } {
  if (viewportW <= 1040) {
    const gap = 16
    const width = Math.min(ONBOARDING_WINDOW_WIDTH, Math.max(380, viewportW - baseRects.mate.width - gap - 32))
    const totalW = baseRects.mate.width + gap + width
    const mateX = Math.max(16, Math.round((viewportW - totalW) / 2))
    const x = Math.min(viewportW - width - 16, mateX + baseRects.mate.width + gap)
    const y = Math.max(MENU_BAR_HEIGHT + 44, Math.min(baseRects.login.y, viewportH - ONBOARDING_IDEAL_HEIGHT - 16))
    const maxHeight = Math.max(360, viewportH - y - 14)
    return { x, y, width, maxHeight }
  }

  const width = Math.min(ONBOARDING_WINDOW_WIDTH, Math.max(380, viewportW - 32))
  const clearOfMate = baseRects.mate.x + baseRects.mate.width + 16
  const rightPinned = viewportW - width - (viewportW >= 1400 ? 64 : 20)
  const x = Math.max(
    16,
    Math.min(viewportW - width - 16, Math.max(clearOfMate, Math.min(rightPinned, baseRects.login.x))),
  )
  const y = Math.max(
    PAUSE_TOGGLE_CLEAR_Y,
    Math.min(baseRects.login.y, viewportH - ONBOARDING_IDEAL_HEIGHT - 16),
  )
  const maxHeight = Math.max(360, viewportH - y - 14)
  return { x, y, width, maxHeight }
}

/**
 * Fixed initial legal window placement:
 * - Default: top-left over desktop icon column (x=24, y=MENU_BAR_HEIGHT+24), width ~400..460px
 *   so it never overlaps Login window, Mate's face region (mateCenter ± 70px), or top-right motion button.
 * - If user dragged Login window into the left zone, picks the widest open region that never overlaps Login.
 */
export function getDefaultLegalWindowRect(
  viewportW: number,
  viewportH: number,
  loginRect: WindowRect,
  mateRect: WindowRect,
): { x: number; y: number; width: number; maxHeight: number } {
  const defaultY = MENU_BAR_HEIGHT + 24
  const maxHeight = Math.max(320, viewportH - defaultY - 24)
  const mateFaceLeft = mateRect.x + mateRect.width / 2 - 70
  const preferredX = 24
  const gap = 16

  // Check if preferred left slot avoids Login window cleanly
  const leftAvailBeforeLogin = loginRect.x - gap - preferredX
  const leftAvailBeforeFace = mateFaceLeft - 8 - preferredX

  if (leftAvailBeforeLogin >= 400) {
    const faceSafeMax = leftAvailBeforeFace >= 400 ? leftAvailBeforeFace : leftAvailBeforeLogin
    const width = Math.max(400, Math.min(460, Math.floor(Math.min(leftAvailBeforeLogin, faceSafeMax))))
    return { x: preferredX, y: defaultY, width, maxHeight }
  }

  // Fallback when user dragged Login window to the left: pick widest side (left or right of Login)
  const rightX = loginRect.x + loginRect.width + gap
  const rightAvail = viewportW - 24 - rightX
  if (rightAvail >= leftAvailBeforeLogin && rightAvail >= 360) {
    const width = Math.min(460, Math.floor(rightAvail))
    // Drop below top-right motion toggle button (top: 44px, height: 32px -> bottom ~76px)
    const rightY = MENU_BAR_HEIGHT + 56
    return {
      x: Math.round(rightX),
      y: rightY,
      width,
      maxHeight: Math.max(320, viewportH - rightY - 24),
    }
  }

  const fallbackW = Math.max(360, Math.min(460, Math.floor(Math.max(360, leftAvailBeforeLogin))))
  const fallbackX = Math.max(16, Math.min(viewportW - fallbackW - 16, preferredX))
  return { x: fallbackX, y: defaultY, width: fallbackW, maxHeight }
}

const VALID_EXPRESSION_FILES = new Set(EXPRESSION_FILE_OPTIONS.map((o) => o.value))
const VALID_TIME_MODES = new Set<TimeOfDayMode>(['auto', 'dawn', 'morning', 'day', 'sunset', 'night'])

function clampNum(raw: string | null, fallback: number, min: number, max: number, decimals = 0): number {
  if (raw === null || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  const clamped = Math.min(max, Math.max(min, n))
  return decimals > 0 ? Number(clamped.toFixed(decimals)) : Math.round(clamped)
}

export function parseDesktopParams(params: URLSearchParams): DesktopControls {
  const expressions: ExpressionMapping = { ...DEFAULT_EXPRESSION_MAPPING }
  for (const state of MATE_REACTION_STATES) {
    const raw = params.get(`dExp_${state}`)
    if (raw !== null && VALID_EXPRESSION_FILES.has(raw)) {
      expressions[state] = raw
    }
  }
  const rawTime = params.get('dTime') as TimeOfDayMode | null
  const timeMode: TimeOfDayMode = rawTime && VALID_TIME_MODES.has(rawTime) ? rawTime : 'auto'
  const rawLight = params.get('dLight')
  const hiddenLightAngle =
    rawLight !== null && rawLight.trim() !== '' && Number.isFinite(Number(rawLight))
      ? Math.round(((Number(rawLight) % 360) + 360) % 360)
      : null

  return {
    capsuleCount: clampNum(params.get('dCount'), DEFAULT_DESKTOP_CONTROLS.capsuleCount, 10, 40),
    capsuleSpeed: clampNum(params.get('dSpeed'), DEFAULT_DESKTOP_CONTROLS.capsuleSpeed, 0, 80),
    purpleAccentRatio: clampNum(params.get('dPurp'), DEFAULT_DESKTOP_CONTROLS.purpleAccentRatio, 0, 60),
    shinySpawnChance: clampNum(params.get('dShiny'), DEFAULT_DESKTOP_CONTROLS.shinySpawnChance, 0, 100),
    live2dEnabled: params.get('dLive2d') === '0' ? false : true,
    timeMode,
    hiddenContrast: clampNum(params.get('dHCon'), DEFAULT_DESKTOP_CONTROLS.hiddenContrast, 0, 100),
    hiddenScale: clampNum(params.get('dHScale'), DEFAULT_DESKTOP_CONTROLS.hiddenScale, 0.8, 1.9, 2),
    hiddenOffsetX: clampNum(params.get('dHX'), DEFAULT_DESKTOP_CONTROLS.hiddenOffsetX, -40, 40),
    hiddenOffsetY: clampNum(params.get('dHY'), DEFAULT_DESKTOP_CONTROLS.hiddenOffsetY, -30, 30),
    hiddenLightAngle,
    decoyDensity: clampNum(params.get('dDecoy'), DEFAULT_DESKTOP_CONTROLS.decoyDensity, 0, 3, 1),
    eyeGazeScale: clampNum(params.get('dEye'), DEFAULT_DESKTOP_CONTROLS.eyeGazeScale, 0.5, 2.2, 2),
    headGazeScale: clampNum(params.get('dHead'), DEFAULT_DESKTOP_CONTROLS.headGazeScale, 0, 1.2, 2),
    expressions,
  }
}

export function writeDesktopParams(base: URLSearchParams, controls: DesktopControls): URLSearchParams {
  const next = new URLSearchParams(base)
  for (const key of [...next.keys()]) {
    if (
      key === 'dCount' ||
      key === 'dSpeed' ||
      key === 'dPurp' ||
      key === 'dShiny' ||
      key === 'dLive2d' ||
      key === 'dTime' ||
      key === 'dHCon' ||
      key === 'dHScale' ||
      key === 'dHX' ||
      key === 'dHY' ||
      key === 'dLight' ||
      key === 'dDecoy' ||
      key === 'dEye' ||
      key === 'dHead' ||
      key.startsWith('dExp_')
    ) {
      next.delete(key)
    }
  }
  next.delete('bg')
  const setDiff = (k: string, v: string | number, def: string | number) => {
    if (v !== def) next.set(k, String(v))
  }
  setDiff('dCount', controls.capsuleCount, DEFAULT_DESKTOP_CONTROLS.capsuleCount)
  setDiff('dSpeed', controls.capsuleSpeed, DEFAULT_DESKTOP_CONTROLS.capsuleSpeed)
  setDiff('dPurp', controls.purpleAccentRatio, DEFAULT_DESKTOP_CONTROLS.purpleAccentRatio)
  setDiff('dShiny', controls.shinySpawnChance, DEFAULT_DESKTOP_CONTROLS.shinySpawnChance)
  if (!controls.live2dEnabled) next.set('dLive2d', '0')
  setDiff('dTime', controls.timeMode, DEFAULT_DESKTOP_CONTROLS.timeMode)
  setDiff('dHCon', controls.hiddenContrast, DEFAULT_DESKTOP_CONTROLS.hiddenContrast)
  setDiff('dHScale', controls.hiddenScale, DEFAULT_DESKTOP_CONTROLS.hiddenScale)
  setDiff('dHX', controls.hiddenOffsetX, DEFAULT_DESKTOP_CONTROLS.hiddenOffsetX)
  setDiff('dHY', controls.hiddenOffsetY, DEFAULT_DESKTOP_CONTROLS.hiddenOffsetY)
  if (controls.hiddenLightAngle !== null) next.set('dLight', String(controls.hiddenLightAngle))
  setDiff('dDecoy', controls.decoyDensity, DEFAULT_DESKTOP_CONTROLS.decoyDensity)
  setDiff('dEye', controls.eyeGazeScale, DEFAULT_DESKTOP_CONTROLS.eyeGazeScale)
  setDiff('dHead', controls.headGazeScale, DEFAULT_DESKTOP_CONTROLS.headGazeScale)
  for (const state of MATE_REACTION_STATES) {
    if (controls.expressions[state] !== DEFAULT_EXPRESSION_MAPPING[state]) {
      next.set(`dExp_${state}`, controls.expressions[state])
    }
  }
  return next
}

/**
 * 사진 폴더 이스터에그: 1.2초 안에 이어서 누른 횟수로 단계가 바뀐다.
 * 2번(더블클릭) = 기존 "사진은 비밀이야." / 4번 = 당황 / 6번 = 폴더 열림.
 */
export const PHOTO_UNLOCK_CONFIG = {
  folderId: 'photos-folder',
  tapGapMs: 1200,
  peekAt: 4,
  openAt: 6,
} as const

/** 셀카 순서와 채린의 한마디. 파일은 src/assets/characters/chaerin-live2d-v1/selfies/selfie-01~04.webp */
export const CHAERIN_SELFIES: readonly { id: string; title: string; line: string }[] = [
  { id: 'selfie-01', title: '시험 끝난 날', line: '그거 시험 끝난 날이야. 해방!' },
  { id: 'selfie-02', title: '창가 노을', line: '노을 예쁘길래. 너도 봤어야 했는데.' },
  { id: 'selfie-03', title: '동네 고양이', line: '얘가 먼저 다가왔어. 진짜야.' },
  { id: 'selfie-04', title: '딸기 라테', line: '이건… 그냥 맛있어서 찍은 거야.' },
] as const

export const PHOTO_LOCKED_LINE = '나머지는 더 친해지면.'

