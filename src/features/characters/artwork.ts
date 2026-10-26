import kangStudy from '@/assets/characters/kang-study.webp'
import kangReaction from '@/assets/characters/kang-reaction.webp'
import kangAffection from '@/assets/characters/kang-affection.webp'
import hanStudy from '@/assets/characters/han-study.webp'
import hanReaction from '@/assets/characters/han-reaction.webp'
import hanAffection from '@/assets/characters/han-affection.webp'
import ryuStudy from '@/assets/characters/ryu-study.webp'
import ryuReaction from '@/assets/characters/ryu-reaction.webp'
import ryuAffection from '@/assets/characters/ryu-affection.webp'
import night from '@/assets/rooms/night-study.webp'
import cat from '@/assets/rooms/cat-library.webp'

export type CharacterPose = 'study' | 'reaction' | 'affection'
type Artwork = Record<CharacterPose, string> & { position: string; quote: string; color: string }

export const characterArtwork: Record<string, Artwork> = {
  chaerin: {
    study: kangStudy,
    reaction: kangReaction,
    affection: kangAffection,
    position: '50% 38%',
    quote: '네 자리, 비워 뒀어. 얼른 와.',
    color: '#d5a16f',
  },
  sua: {
    study: hanStudy,
    reaction: hanReaction,
    affection: hanAffection,
    position: '50% 35%',
    quote: '조금씩 해도 괜찮아. 같이 하자.',
    color: '#a3b3d9',
  },
  dahee: {
    study: ryuStudy,
    reaction: ryuReaction,
    affection: ryuAffection,
    position: '50% 36%',
    quote: '오늘도 한 장씩, 같이 넘겨 볼까?',
    color: '#b6cbb1',
  },
  doyun: {
    study: night,
    reaction: night,
    affection: night,
    position: '50% 27%',
    quote: '아직 안 끝났지? 나도 조금 더 할게.',
    color: '#a39bd1',
  },
  moru: {
    study: cat,
    reaction: cat,
    affection: cat,
    position: '50% 52%',
    quote: '냐옹. 네 옆자리는 내 자리야.',
    color: '#d8bb82',
  },
}

export function getCharacterArtwork(id = 'chaerin') {
  return characterArtwork[id] ?? characterArtwork.chaerin!
}
