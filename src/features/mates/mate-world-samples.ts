import type { MateWorldContent } from './mate-worlds.ts'

/**
 * The planning spec's example worlds (2026-11-26) for development and the local mock only: loaded through
 * dev-samples.ts behind `import.meta.env.DEV`, so production bundles carry none of it. 채린 follows the spec's table;
 * 서도현 (and any other mate) uses the same places with temporary lines. Pictures: only what the app already has (the
 * classroom call background and the mate's full still for 학교) — the others show the soft placeholder.
 */
const PLACES = ['학교', '자습실', '도서관', '카페'] as const

const LINES: Readonly<Record<string, readonly string[]>> = {
  chaerin: [
    '오늘 수업 내용 이해했어?',
    '조금만 더 공부하고 쉬자.',
    '여기서는 조용히 해야 돼.',
    '공부 끝나면 디저트 먹고 싶다.',
    '아, 그냥 침대에 눕고 싶다.',
  ],
  // Temporary (no planning copy yet).
  dohyun: [
    '(임시) 수업 끝났으면 같이 가자.',
    '(임시) 집중 좀 해. 나도 할 테니까.',
    '(임시) 쉿, 여기 도서관이야.',
    '(임시) 뭐 마실래? 이번엔 내가 살게.',
    '(임시) 편하게 있어. 우리 집이야.',
  ],
}

export function sampleMateWorlds(
  mateId: string,
  mateName: string,
  art: { background?: string; outfit?: string } = {},
): MateWorldContent[] {
  const lines = LINES[mateId] ?? LINES.dohyun!
  const home = `${mateName}${hasFinalConsonant(mateName) ? '이네' : '네'} 집`
  return [...PLACES, home].map((place, index) => ({
    episode: index + 1,
    place,
    sampleLine: lines[index],
    ...(index === 0 && art.outfit ? { outfitPreviewUrl: art.outfit } : {}),
    ...(index === 0 && art.background ? { backgroundUrl: art.background } : {}),
  }))
}

/** 채린 → 채린이네, 서도현 → 서도현이네 (a final consonant takes 이). */
function hasFinalConsonant(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}
