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
import { sceneArtwork, type SceneId } from '@/features/rooms/artwork'
import { roomPosters } from '@/features/rooms/posters'

export type CharacterPose = 'study' | 'reaction' | 'affection'
export type CharacterCrop = { x: number; y: number; width: number; height: number }
type Artwork = Record<CharacterPose, string> & {
  position: string
  quote: string
  color: string
  sceneId?: SceneId
  crop?: CharacterCrop
  avatarCrop?: CharacterCrop
  portraitSource?: string
  sourceSize?: { width: number; height: number }
  cardPortrait?: {
    source: string
    sourceSize: { width: number; height: number }
    crop: CharacterCrop
  }
}

function sceneCharacter(
  sceneId: SceneId,
  quote: string,
  color: string,
  crop?: CharacterCrop,
  avatarCrop?: CharacterCrop,
): Artwork {
  const source = sceneArtwork[sceneId].subject
  const posterSizes: Partial<Record<SceneId, { width: number; height: number }>> = {
    lantern: { width: 1096, height: 1436 },
    fantasy: { width: 1093, height: 1438 },
    lab: { width: 1086, height: 1448 },
    joseon: { width: 1093, height: 1439 },
  }
  return {
    study: source,
    reaction: source,
    affection: source,
    sceneId,
    position: 'center',
    quote,
    color,
    crop,
    avatarCrop,
    portraitSource: crop ? roomPosters[sceneId] : undefined,
    sourceSize: (crop && posterSizes[sceneId]) || {
      width: sceneArtwork[sceneId].subjectSize[0],
      height: sceneArtwork[sceneId].subjectSize[1],
    },
  }
}
const crop = (x: number, y: number, width: number, height: number): CharacterCrop => ({
  x,
  y,
  width,
  height,
})

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
    sceneId: 'night',
    study: night,
    reaction: night,
    affection: night,
    position: '50% 27%',
    quote: '아직 안 끝났지? 나도 조금 더 할게.',
    color: '#a39bd1',
    cardPortrait: {
      source: night,
      sourceSize: { width: 1095, height: 1437 },
      crop: crop(200, 180, 760, 600),
    },
  },
  moru: {
    sceneId: 'cat',
    study: cat,
    reaction: cat,
    affection: cat,
    position: '50% 52%',
    quote: '냐옹. 네 옆자리는 내 자리야.',
    color: '#d8bb82',
    cardPortrait: {
      source: roomPosters.cat!,
      sourceSize: { width: 1097, height: 1434 },
      crop: crop(260, 600, 760, 600),
    },
  },
  'kim-sergeant': sceneCharacter(
    'lantern',
    '마지막 한 장까지, 같이 해 보자.',
    '#c1ba93',
    crop(350, 0, 410, 460),
  ),
  'yoon-private': sceneCharacter(
    'lantern',
    '오늘 정리한 노트, 같이 볼래요?',
    '#b9c49c',
    crop(0, 190, 410, 460),
  ),
  'lee-medic': sceneCharacter(
    'lantern',
    '무리하지 말고, 잠깐씩 쉬어 가요.',
    '#d2bd9d',
    crop(700, 220, 396, 460),
  ),
  aiden: sceneCharacter(
    'fantasy',
    '오늘의 도전, 내가 옆에서 지켜볼게.',
    '#cc9888',
    crop(180, 0, 913, 395),
    crop(470, 0, 395, 395),
  ),
  elia: sceneCharacter(
    'fantasy',
    '한 줄씩 읽으면, 어려운 주문도 풀려요.',
    '#8fc4bb',
    crop(0, 400, 1093, 360),
    crop(400, 400, 360, 360),
  ),
  leon: sceneCharacter(
    'fantasy',
    '서두르지 않아도 좋아. 같이 끝내 보자.',
    '#d7c59e',
    crop(0, 790, 1093, 340),
    crop(330, 790, 400, 400),
  ),
  hajun: {
    ...sceneCharacter(
      'iljin',
      '뭐, 같이 풀면 되잖아. 여기 앉아.',
      '#c3b19e',
      undefined,
      crop(400, 110, 470, 470),
    ),
    cardPortrait: {
      source: roomPosters.iljin!,
      sourceSize: { width: 1093, height: 1438 },
      crop: crop(200, 180, 720, 760),
    },
  },
  yuri: {
    ...sceneCharacter(
      'jurassic',
      '공룡 친구들도 기다렸어. 한 장만 더 해 볼까?',
      '#b8c59b',
      undefined,
      crop(640, 270, 430, 430),
    ),
    cardPortrait: {
      source: roomPosters.jurassic!,
      sourceSize: { width: 1097, height: 1434 },
      crop: crop(400, 650, 430, 500),
    },
  },
  pinky: sceneCharacter(
    'lab',
    '집중 실험 시작! 오늘도 하나씩 만들어 보자.',
    '#e3abd0',
    crop(200, 760, 700, 440),
    crop(200, 700, 700, 700),
  ),
  cotton: sceneCharacter(
    'lab',
    '차근차근 적어 두면 다음에 더 쉬워져.',
    '#d8c4b3',
    crop(0, 430, 390, 450),
  ),
  lime: sceneCharacter(
    'lab',
    '좋은 생각이 떠올랐어! 조금만 더 해 볼까?',
    '#c4cf88',
    crop(650, 420, 436, 580),
    crop(650, 470, 436, 436),
  ),
  yeonhwa: sceneCharacter(
    'joseon',
    '등불이 꺼지기 전에, 함께 한 장 더 읽어요.',
    '#d3a19b',
    crop(350, 20, 440, 550),
  ),
  seola: sceneCharacter(
    'joseon',
    '옆자리를 비워 두었어요. 천천히 시작해요.',
    '#c2bdcf',
    crop(0, 280, 450, 500),
  ),
  bomi: sceneCharacter(
    'joseon',
    '오늘 배운 이야기도 들려주세요.',
    '#dfb3c8',
    crop(650, 280, 443, 550),
  ),
}

export function getCharacterArtwork(id = 'chaerin') {
  return characterArtwork[id] ?? characterArtwork.chaerin!
}
