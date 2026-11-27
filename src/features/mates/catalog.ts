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
  /**
   * The call header's short relation line next to her name (about 10 characters, 2026-11-28). Front-end copy: the
   * server's 31 `oneLiner` is the long introduction, `world` the setting text and `myRole` the user's own role, so
   * none of them says in a few words who she is to the user.
   */
  callTag?: string
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
  callTag: '같은 반 짝꿍',
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
  callTag: '오랜 소꿉친구',
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
// Only these names map: legacy non-launch test mates (such as 「말포이」, production id 1) map to no launch mate.
const sourceNames: Readonly<Record<string, readonly string[]>> = {
  chaerin: ['채린'],
  dohyun: ['서도현', '도현', '서진'],
}
const normalizedName = (name: string | undefined) => name?.replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
const namesOf = (profile: MateProfile) => sourceNames[profile.id] ?? [profile.name]

/** The launch mates a server id is matched against: /home's card id, plus every server id one persona owns (37). */
export type LaunchMateIds = { id: string; characterId: string; serverIds?: readonly number[] }

/**
 * THE mapping of a server mate to a launch catalogue id (every screen goes through it: 내 메이트, 내 기록, 연결 기록,
 * colours). In order: a catalogue id itself ('chaerin'), the server id of a given launch mate (/home card id or one of
 * its 37 server ids), then the server name (`sourceNames`). Anything else — a non-launch server mate such as the legacy
 * test mate 「말포이」 — is undefined: callers drop it and never fall back to 채린.
 */
export function launchMateId(server: { id?: string | number | null; name?: string | null }, mates: readonly LaunchMateIds[] = []): string | undefined {
  const id = server.id === undefined || server.id === null ? '' : String(server.id).trim()
  if (id && mateProfile(id)) return id
  if (id) {
    const byId = mates.find(mate => mate.characterId === id || (mate.serverIds ?? []).some(value => String(value) === id))
    if (byId && mateProfile(byId.id)) return byId.id
  }
  const normalized = normalizedName(server.name ?? undefined)
  if (!normalized) return undefined
  return launchMates.find(profile => namesOf(profile).some(value => normalizedName(value) === normalized))?.id
}

/** The launch profile a server name maps to (`launchMateId`); non-launch names: undefined. */
export function mateProfileByName(name: string | undefined) {
  return mateProfile(launchMateId({ name }))
}

const validId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/**
 * The launch mates found in 11 `/home` `mates[]`, in catalogue order. Each profile takes the server mates that
 * `launchMateId` maps to it, preferring its own name (서도현 before 서진); among those an open one wins over a
 * coming-soon one, then the server order (서진 id 2 before id 3). Non-launch server entries are ignored, and the list is
 * never supplemented with demo mates.
 */
export function availableMates(home: HomeResponse | null): AvailableMate[] {
  const result: AvailableMate[] = []
  const cards = (home?.mates ?? []).filter(card => validId(card.id) && card.name)
  for (const profile of launchMates) {
    const rank = (name: string | undefined) => namesOf(profile).findIndex(value => normalizedName(value) === normalizedName(name))
    const mine = cards.filter(card => launchMateId({ name: card.name }) === profile.id)
    const best = Math.min(...mine.map(card => rank(card.name)))
    const matches = mine.filter(card => rank(card.name) === best)
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
  }
  return result
}

export function mateByName(name: string | undefined, mates: readonly AvailableMate[]) {
  const profile = mateProfileByName(name)
  return profile ? mates.find(mate => mate.id === profile.id) : undefined
}

/** Accept catalogue links and server IDs without falling through to the most recent mate. */
export function selectedCatalogMate(id: string | null, mates: readonly AvailableMate[]) {
  return mates.find(mate => mate.id === id || mate.characterId === id || mate.roomId === id)
    ?? mateByName(id ?? undefined, mates)
}

/** The mate with the coming-soon state a page decided (31 over the /home card), for the connect action. */
export function withComingSoon(mate: AvailableMate, comingSoon: boolean): AvailableMate {
  return Boolean(mate.comingSoon) === comingSoon ? mate : { ...mate, comingSoon }
}

export const MATE_COMING_SOON_MESSAGE = '아직 준비 중인 메이트예요.'
/** Why connecting cannot start (said on screen, not silently ignored), or null. */
export const connectBlockedMessage = (mate: Pick<AvailableMate, 'comingSoon'>) => (mate.comingSoon ? MATE_COMING_SOON_MESSAGE : null)
