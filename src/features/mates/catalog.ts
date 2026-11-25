import type { HomeResponse } from '../../shared/api/types.ts'

/**
 * `all`: 전연령. `adult`: 성인(server `ADULT`). `15`: 15세 이용가 (front-end only, no server value). Both launch mates are
 * `all` (서도현 moved from 15 to 전연령, user decision 2026-11-25); the server's value (11 · 31 `ageRating`) is shown when
 * it sends one. The login screen shows `all` mates only.
 */
export type MateAgeRating = 'all' | 'adult' | '15'

export type MateProfile = {
  id: string
  name: string
  /** One-line introduction (home card, detail tagline). */
  introduction: string
  description: string
  /** The user's role in the mate's world (detail 「내 역할」). */
  role: string
  /** Starting situation (detail). */
  intro: string
  /** The mate's first line (detail; the local mock's connection greeting). Front-end copy only; the persona's prompt stays on the server. */
  firstLine?: string
  farewellLine?: string
  tags: readonly string[]
  ageRating: MateAgeRating
  /** Home card: relationship style and a one-line introduction (no tagline: the introduction). */
  relationTag?: string
  tagline?: string
}

export const AGE_RATING_LABELS: Readonly<Record<MateAgeRating, string>> = { all: '전연령', adult: '성인', 15: '15세 이용가' }
/** 11 · 31 · 48 `ageRating` → the front-end rating; unknown values are left out (the catalogue's stays). */
export function serverAgeRating(value: unknown): MateAgeRating | undefined {
  return value === 'ALL' ? 'all' : value === 'ADULT' ? 'adult' : undefined
}
export function ageRatingLabel(rating: MateAgeRating | undefined): string {
  return AGE_RATING_LABELS[rating ?? 'all'] ?? AGE_RATING_LABELS.all
}

/**
 * Only approved launch characters belong here (user decisions: 채린 2026-11-22, 서도현 2026-11-25). The system prompt,
 * world and keyword book of each persona live on the server; only display copy is kept here.
 */
export const launchMates: readonly MateProfile[] = [{
  // Persona 2026-11-25 (team template; name tag 강채린). 전연령 by user decision (the template says 15+). No romance:
  // a classmate and after-school study partner.
  id: 'chaerin',
  name: '채린',
  introduction: '남들한텐 차갑지만 너한테만 따뜻한 갸루 짝꿍',
  description: '',
  role: '함께 공부하는 학생',
  intro: '모든 수업이 끝나고 교실에 남아서 자습을 하는 상황',
  firstLine: '내가 어쩌다가 너랑 단둘이 공부를 하게 됐지… 야! 책이나 봐!',
  farewellLine: '내일도 늦으면 딸기우유 쏘는 거다. …조심히 가.',
  tags: [],
  ageRating: 'all',
  relationTag: '짝꿍형',
}, {
  // Model bundle `seojin` (local-assets/seojin, src/assets/characters/seojin); the persona's name is 서도현.
  id: 'dohyun',
  name: '서도현',
  introduction: '말은 퉁명스러워도 늘 곁에 있는 무뚝뚝한 소꿉친구',
  description: '',
  role: '어릴 때부터 함께 자란 소꿉친구이자 공부 메이트',
  intro: '시험을 앞둔 주말 오후, 늘 함께 공부하던 동네 독서실에서 마주 앉은 상황',
  firstLine: '왔냐. 네 자리 맡아놨으니까 앉아. …뭐 해, 공부 안 하고.',
  farewellLine: '벌써 가냐. …그래, 내일 보자. 조심히 가고.',
  tags: [],
  ageRating: 'all',
  relationTag: '소꿉친구형',
}]

/** The launch profile of a mate id (unknown ids: undefined). */
export function mateProfile(id: string | undefined): MateProfile | undefined {
  return id ? launchMates.find(profile => profile.id === id) : undefined
}

export type AvailableMate = MateProfile & {
  /**
   * The server mate id (11 `mates[].id` = character id = 16 `mateId`). The app still keys rooms and characters
   * separately, so both carry the same value since 11-25.
   */
  roomId: string
  characterId: string
  image?: string
  /** 11 `comingSoon`: shown, but 16 refuses it (409 `MATE_COMING_SOON`). */
  comingSoon?: boolean
}

// Display mapping of server names to the front-end catalogue (user decisions 2026-11-22 · 2026-11-25).
// Server IDs, model URLs and source responses keep their original identity. 서진 is the server name of the boy mate
// whose persona is 서도현 here (name to be settled with the backend/PM; docs/API_FRONT_GAP_2026-11-25.md §17).
const sourceNames: Readonly<Record<string, readonly string[]>> = {
  chaerin: ['채린', '말포이 TS', '말포이'],
  dohyun: ['서도현', '도현', '서진'],
}
const normalizedName = (name: string | undefined) => name?.replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
export function mateProfileByName(name: string | undefined) {
  const normalized = normalizedName(name)
  return normalized ? launchMates.find(profile => (sourceNames[profile.id] ?? [profile.name]).some(value => normalizedName(value) === normalized)) : undefined
}

const validId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/**
 * The launch mates found in 11 `/home` `mates[]`, in catalogue order. Each profile takes the first server mate under its
 * preferred source name (채린 before the old 말포이 entry); among several with that name an open one wins over a coming-soon
 * one, then the server order (서진 id 2 before id 3). Never supplemented with the old demo catalogue.
 */
export function availableMates(home: HomeResponse | null): AvailableMate[] {
  const result: AvailableMate[] = []
  const cards = (home?.mates ?? []).filter(card => validId(card.id) && card.name)
  for (const profile of launchMates) {
    for (const sourceName of sourceNames[profile.id] ?? [profile.name]) {
      const matches = cards.filter(card => normalizedName(card.name) === normalizedName(sourceName))
      const card = matches.find(value => !value.comingSoon) ?? matches[0]
      if (!card) continue
      result.push({
        ...profile,
        roomId: String(card.id),
        characterId: String(card.id),
        ...(card.cardImageUrl ? { image: card.cardImageUrl } : {}),
        ...(card.comingSoon ? { comingSoon: true } : {}),
        ...(serverAgeRating(card.ageRating) ? { ageRating: serverAgeRating(card.ageRating)! } : {}),
      })
      break
    }
  }
  return result
}

export function mateByName(name: string | undefined, mates: readonly AvailableMate[]) {
  const profile = mateProfileByName(name)
  return profile ? mates.find(mate => mate.id === profile.id) : undefined
}
