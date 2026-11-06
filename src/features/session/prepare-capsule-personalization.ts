import { dayKey } from '../../shared/lib/format.ts'

export type PrepareCapsuleInput = {
  nickname: string
  targetMinutes: number
  characterName: string
  createdAt: number
  posterUrl?: string
}
export type CapsuleInscription = { nickname: string; detail: string; date: string; summary: string }

function shortName(value: string, limit: number) {
  const characters = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('ko-KR', { granularity: 'grapheme' }).segment(value)].map(part => part.segment)
    : Array.from(value)
  return characters.length > limit ? characters.slice(0, limit).join('') + '…' : value
}

/** Freeze the actual start request's identity and goal; the demo slider is deliberately not an input. */
export function capsuleInscription(input: PrepareCapsuleInput): CapsuleInscription {
  const nickname = input.nickname.replace(/\s+/gu, ' ').trim() || '나'
  const character = input.characterName.replace(/\s+/gu, ' ').trim() || '친구'
  const goal = Number.isFinite(input.targetMinutes) && input.targetMinutes > 0
    ? `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(input.targetMinutes)}분` : '공부'
  const date = dayKey(Number.isFinite(input.createdAt) ? input.createdAt : Date.now()).replaceAll('-', '.')
  return {
    nickname: shortName(nickname, 9), detail: `${goal} · ${shortName(character, 8)}`, date,
    summary: `${nickname}의 공부 캡슐. 목표 ${goal}, 함께할 친구 ${character}. ${date}.`,
  }
}
