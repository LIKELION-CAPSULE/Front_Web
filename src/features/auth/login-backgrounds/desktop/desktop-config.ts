import { capsuleLogo } from '@/shared/design/brand-logo'
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
