/**
 * Pixel pictures of the modal / notification frame (design B2 「픽셀 프레임」, applied app-wide 2026-11-26; also used by the
 * review drafts). Rows of characters, `.` = empty, every other character a colour from the picture's palette. Each
 * picture is turned into one SVG data URL once and drawn at 2 CSS px per art pixel, so the browser rasterizes it a single
 * time (no per-pixel DOM). Palettes are illustration colours: status pictures use the status token values
 * (docs/DESIGN_TOKENS.json), the capsule the logo v2 colours, the coin the credit gold (credit display exception).
 */

export type PixelArt = { rows: readonly string[]; palette: Readonly<Record<string, string>> }

/** The CAPSULE logo capsule (tilted pill, two white→lilac halves and the violet seam), redrawn at 20×10. */
const CAPSULE: PixelArt = {
  rows: [
    '.............ccccc..',
    '..........ccccccccc.',
    '.......ahhccccccddd.',
    '....aaaaahhccdddddd.',
    '..aaaaaaahhdddddddd.',
    '.aaaaaabbssdddddd...',
    '.aaabbbbbbssdddd....',
    '.abbbbbbbbssd.......',
    '.bbbbbbbbb..........',
    '..bbbbb.............',
  ],
  // Logo v2 colours: body #FFFFFF → #D4C3FA / #CAB2F9, seam #B397FC → #8053F2.
  palette: { a: '#FFFFFF', b: '#D4C3FA', c: '#FFFFFF', d: '#CAB2F9', h: '#B397FC', s: '#8053F2' },
}

const WARNING_ROWS = [
  '.....a.....',
  '....aaa....',
  '....aba....',
  '...aabaa...',
  '...aabaa...',
  '..aaabaaa..',
  '..aaaaaaa..',
  '.aaaabaaaa.',
  '.aaaaaaaaa.',
  'aaaaaaaaaaa',
]

/** Credit coin. Credit display keeps its gold (user decision 2026-11-26: attendance widget + credit display). */
const COIN: PixelArt = {
  rows: [
    '....aaaa....',
    '..aaabbaaa..',
    '.aawbbbbbaa.',
    '.awbbaabbba.',
    'aabbbaabbbaa',
    'abbbbaabbbba',
    'abbbbaabbbba',
    'aabbbaabbbaa',
    '.abbbaabbba.',
    '.aabbbbbbaa.',
    '..aaabbaaa..',
    '....aaaa....',
  ],
  palette: { a: '#F4B95F', b: '#8A6430', w: '#FFE3B0' },
}

const STAR: PixelArt = {
  rows: [
    '.....a.....',
    '.....a.....',
    '.....b.....',
    '.....b.....',
    '....bwb....',
    'aabbwwwbbaa',
    '....bwb....',
    '.....b.....',
    '.....b.....',
    '.....a.....',
    '.....a.....',
  ],
  palette: { a: '#AC95F8', b: '#C4B9F3', w: '#FFFFFF' },
}

const INFO: PixelArt = {
  rows: [
    '...aaaaa...',
    '.aaaaaaaaa.',
    '.aaaabaaaa.',
    'aaaaaaaaaaa',
    'aaaabbaaaaa',
    'aaaaabaaaaa',
    'aaaaabaaaaa',
    'aaaaabaaaaa',
    '.aaabbbaaa.',
    '.aaaaaaaaa.',
    '...aaaaa...',
  ],
  palette: { a: '#8AD0F4', b: '#172D39' },
}

/** Snow (the same pixel dot and flake as 내 메이트 PixelSnow), white and pale lilac. */
const SNOW_DOT: PixelArt = { rows: ['.a.', 'aaa', '.a.'], palette: { a: '#FFFFFF' } }
const SNOW_DOT_LILAC: PixelArt = { rows: SNOW_DOT.rows, palette: { a: '#E6DEFF' } }
const SNOW_FLAKE: PixelArt = { rows: ['...a...', '.a.a.a.', '..aaa..', 'aaa.aaa', '..aaa..', '.a.a.a.', '...a...'], palette: { a: '#FFFFFF' } }
const SNOW_FLAKE_LILAC: PixelArt = { rows: SNOW_FLAKE.rows, palette: { a: '#E6DEFF' } }

const CHECK: PixelArt = {
  rows: [
    '.......aa',
    '......aa.',
    'a....aa..',
    'aa..aa...',
    '.aaaa....',
    '..aa.....',
  ],
  palette: { a: '#5BE09C' },
}

const SPARK: PixelArt = {
  rows: ['..a..', '..a..', 'aawaa', '..a..', '..a..'],
  palette: { a: '#D9D5F1', w: '#FFFFFF' },
}

/** A pixel heart in the affection pink (the call chat's stage-up line; DESIGN_SYSTEM: 호감도·친밀도 = pink). */
const HEART: PixelArt = {
  rows: ['.aa.aa.', 'awaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  palette: { a: '#F971B3', w: '#F4A9C9' },
}

/** One row of the dotted constellation (B3), tiled horizontally: dots every 4 art px, a small cross star now and then. */
const CONSTELLATION_WIDTH = 80
const CONSTELLATION_STARS = [20, 62]
const CONSTELLATION: PixelArt = {
  rows: [0, 1, 2].map(y => Array.from({ length: CONSTELLATION_WIDTH }, (_, x) => {
    const star = CONSTELLATION_STARS.includes(x)
    if (y !== 1) return star ? 'b' : '.'
    if (star) return 'w'
    if (CONSTELLATION_STARS.some(at => Math.abs(at - x) === 1)) return 'b'
    return x % 4 === 0 ? 'a' : '.'
  }).join('')),
  palette: { a: '#5E4FA0', b: '#AC95F8', w: '#E6DEFF' },
}

export const PIXEL_ART = {
  capsule: CAPSULE,
  warning: { rows: WARNING_ROWS, palette: { a: '#F4AFA8', b: '#3D2028' } },
  warningStatus: { rows: WARNING_ROWS, palette: { a: '#F4B95F', b: '#352A18' } },
  info: INFO,
  coin: COIN,
  snowDot: SNOW_DOT,
  snowDotLilac: SNOW_DOT_LILAC,
  snowFlake: SNOW_FLAKE,
  snowFlakeLilac: SNOW_FLAKE_LILAC,
  star: STAR,
  check: CHECK,
  spark: SPARK,
  heart: HEART,
  constellation: CONSTELLATION,
} satisfies Record<string, PixelArt>

export type PixelArtName = keyof typeof PIXEL_ART

const urls = new Map<PixelArt, string>()
/** `url("data:image/svg+xml,…")` for a picture, built once. */
export function pixelArtUrl(art: PixelArt) {
  const cached = urls.get(art)
  if (cached) return cached
  const rects = art.rows.flatMap((row, y) => [...row].flatMap((cell, x) => {
    const fill = art.palette[cell]
    return cell === '.' || !fill ? [] : [`<rect x='${x}' y='${y}' width='1' height='1' fill='${fill}'/>`]
  }))
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${art.rows[0]!.length} ${art.rows.length}' shape-rendering='crispEdges'>${rects.join('')}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  urls.set(art, url)
  return url
}

export function pixelArtSize(art: PixelArt, scale = 2) {
  return { width: art.rows[0]!.length * scale, height: art.rows.length * scale }
}
