import type { PixelArt } from '@/shared/ui/pixel/pixel-art'

/**
 * Pixel pictures of the mobile access screen's three feature cards (illustrations in the pixel-frame family, 2 CSS px
 * per art pixel). All three share one 12 × 12 grid so they sit the same size in the same 40px tile. Palette: the ink
 * white and the info sky of docs/DESIGN_TOKENS.json on the canvas tone; no violet (user note 2026-11-27: the drafts'
 * dim lilac icons floated off the titles).
 */
const INK = '#FAFAFD'
const SKY = '#8AD0F4'
const DARK = '#0F0E17'
const DIM = '#5E5C69'

/** A screen with someone in it on a stand: the video-call feeling. */
const CALL: PixelArt = {
  rows: [
    'aaaaaaaaaaaa',
    'abbbbbbbbbba',
    'abbbbccbbbba',
    'abbbccccbbba',
    'abbbccccbbba',
    'abbbbccbbbba',
    'abbccccccbba',
    'abccccccccba',
    'aaaaaaaaaaaa',
    '.....aa.....',
    '...aaaaaa...',
    '............',
  ],
  palette: { a: INK, b: DARK, c: SKY },
}

/** A speech bubble with a voice wave. */
const VOICE: PixelArt = {
  rows: [
    '.aaaaaaaaaa.',
    'aaaaaaaaaaaa',
    'aaaaabbaaaaa',
    'aaababbabaaa',
    'abababbababa',
    'abababbababa',
    'aaababbabaaa',
    'aaaaabbaaaaa',
    'aaaaaaaaaaaa',
    '.aaaaaaaaaa.',
    '..aa........',
    '..a.........',
  ],
  palette: { a: INK, b: DARK },
}

/** A calendar whose days fill up: time spent together, kept. */
const RECORD: PixelArt = {
  rows: [
    '..a......a..',
    'aaaaaaaaaaaa',
    'aaaaaaaaaaaa',
    'abbbbbbbbbba',
    'abccbccbddba',
    'abccbccbddba',
    'abbbbbbbbbba',
    'abddbccbccba',
    'abddbccbccba',
    'abbbbbbbbbba',
    'aaaaaaaaaaaa',
    '............',
  ],
  palette: { a: INK, b: DARK, c: SKY, d: DIM },
}

export const MOBILE_GATE_FEATURES = [
  { art: CALL, title: '영상통화처럼 곁에', body: '노트북 화면 너머에 메이트가 함께 앉아 있어요. 혼자 보내던 시간이 둘이 보내는 시간이 돼요.' },
  { art: VOICE, title: '목소리로 대화', body: '말을 걸면 메이트가 목소리로 대답해요. 채팅으로 이야기해도 좋아요.' },
  { art: RECORD, title: '함께한 시간 · 세계관', body: '함께한 시간이 캡슐로 쌓여 기록돼요. 친해질수록 메이트의 새 세계관이 열려요.' },
] as const
