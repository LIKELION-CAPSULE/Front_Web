import type { HomeResponse } from '../../shared/api/types.ts'

/** `all`: 전연령. `15`: 15세 이용가. The login screen shows `all` mates only. */
export type MateAgeRating = 'all' | '15'

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
}

export const AGE_RATING_LABELS: Readonly<Record<MateAgeRating, string>> = { all: '전연령', 15: '15세 이용가' }
export function ageRatingLabel(rating: MateAgeRating | undefined): string {
  return AGE_RATING_LABELS[rating ?? 'all'] ?? AGE_RATING_LABELS.all
}

/**
 * Only approved launch characters belong here (user decisions: 채린 2026-11-22, 서도현 2026-11-25). The system prompt,
 * world and keyword book of each persona live on the server; only display copy is kept here.
 */
export const launchMates: readonly MateProfile[] = [{
  id: 'chaerin',
  name: '채린',
  introduction: '시험기간에 같이 있는 귀여운 여고생',
  description: '',
  role: '당신은 채린의 같은 반 친구예요',
  intro: '',
  tags: [],
  ageRating: 'all',
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
  ageRating: '15',
}]

/** The launch profile of a mate id (unknown ids: undefined). */
export function mateProfile(id: string | undefined): MateProfile | undefined {
  return id ? launchMates.find(profile => profile.id === id) : undefined
}

export type AvailableMate = MateProfile & {
  /** Compatibility with the currently published room/session API; never invented locally. */
  roomId: string
  characterId: string
  image?: string
}

// Temporary display mapping explicitly requested by the user on 2026-11-22.
// Server IDs, model URLs and source responses keep their original identity.
const sourceNames: Readonly<Record<string, readonly string[]>> = {
  chaerin: ['채린', '말포이 TS', '말포이'],
  dohyun: ['서도현', '도현'],
}
const normalizedName = (name: string | undefined) => name?.replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
export function mateProfileByName(name: string | undefined) {
  const normalized = normalizedName(name)
  return normalized ? launchMates.find(profile => (sourceNames[profile.id] ?? [profile.name]).some(value => normalizedName(value) === normalized)) : undefined
}

const validId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/** Do not supplement the server catalogue with the old nine-room demo catalogue. */
export function availableMates(home: HomeResponse | null): AvailableMate[] {
  const result: AvailableMate[] = []
  for (const profile of launchMates) {
    // Prefer a real Chaerin entry when both the new and temporary source exist.
    for (const sourceName of sourceNames[profile.id] ?? [profile.name]) {
      for (const room of home?.rooms ?? []) {
        if (!validId(room.id)) continue
        const character = room.characters?.find(value => normalizedName(value.name) === normalizedName(sourceName) && validId(value.id))
        if (!character || !validId(character.id)) continue
        const farewellLine =
          typeof (character as { farewellLine?: unknown }).farewellLine === 'string' &&
          (character as { farewellLine: string }).farewellLine.trim()
            ? (character as { farewellLine: string }).farewellLine.trim()
            : profile.farewellLine
        result.push({
          ...profile,
          ...(farewellLine ? { farewellLine } : {}),
          roomId: String(room.id),
          characterId: String(character.id),
          image: character.profileImageUrl,
        })
        break
      }
      if (result.some(value => value.id === profile.id)) break
    }
  }
  return result
}

export function mateByName(name: string | undefined, mates: readonly AvailableMate[]) {
  const profile = mateProfileByName(name)
  return profile ? mates.find(mate => mate.id === profile.id) : undefined
}
