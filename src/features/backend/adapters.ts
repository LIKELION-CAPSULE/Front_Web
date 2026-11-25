import type { ActiveSession, DemoState, StudyRecord } from '../demo/types.ts'
import type { MateRoom } from '../mates/mate-rooms.ts'
import type { IntimacyView, MateCard, MateRelation, MeResponse, ReportResponse, ResumeResponse, StartResponse, StudySettlement } from '../../shared/api/types.ts'
import { ApiError } from '../../shared/api/client.ts'
import { mateProfileByName } from '../mates/catalog.ts'

export function id(value: unknown): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new ApiError('서버 식별자를 확인하지 못했어요.', 502)
  return String(value)
}
export function numericId(value: string): number {
  if (!/^\d+$/.test(value)) throw new ApiError('잘못된 식별자예요.', 400)
  const result = Number(value)
  id(result)
  return result
}
export function timestamp(value: string | undefined): number {
  const result = value ? Date.parse(value) : NaN
  if (!Number.isFinite(result)) throw new ApiError('서버 시간을 확인하지 못했어요.', 502)
  return result
}
export function seconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new ApiError('서버의 연결 시간을 확인하지 못했어요.', 502)
  return value
}
const optionalSeconds = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
export function emptyState(): DemoState {
  return {
    version: 1, profile: { name: '', loggedIn: false, onboarded: false, avatar: { hair: 0, outfit: 0, appearance: 0, background: 0 } },
    firstVisit: true, affection: {}, credits: 0, ledger: [], pass: null,
    cameraChecked: false, cameraEnabled: false, examPromptedRooms: [], records: [], activeSession: null,
    latestRecordId: null, memories: [], messages: [], gifts: [], chatUsage: { day: '', used: 0 }, savedRooms: [],
  }
}
export function profile(me: MeResponse, previous = emptyState().profile) {
  id(me.userId)
  if (!me.nickname || typeof me.onboardingRequired !== 'boolean') throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
  // 11-25 /me has no avatarId (backend request pending); keep the one this browser chose.
  const avatarId = typeof me.avatarId === 'number' && Number.isSafeInteger(me.avatarId) && me.avatarId > 0
    ? me.avatarId
    : previous.avatarId
  return { ...previous, userId: me.userId, name: me.nickname, avatarId, loggedIn: true, onboarded: !me.onboardingRequired, profileImage: me.profileImage ?? undefined }
}

/** The display name of a server mate (front-end catalogue name when mapped, e.g. 서진 → 서도현). */
export function mateName(name: string | undefined) {
  return mateProfileByName(name)?.name ?? name ?? ''
}

/**
 * 11 `mates[]` card as the app's one-mate room. The app keys rooms and characters by id; since 11-25 both are the
 * mate id (mate id = character id), so `room.id === characters[0].id === String(mate.id)`.
 */
export function mateRoom(card: MateCard): MateRoom {
  const mateId = id(card.id)
  if (!card.name) throw new ApiError('메이트 정보를 확인하지 못했어요.', 502)
  const name = mateName(card.name)
  return {
    id: mateId, serverRoom: true, name, coverUrl: card.cardImageUrl ?? undefined,
    description: card.oneLiner ?? '', introduction: '', contentStatus: card.comingSoon ? 'coming-soon' : 'preview',
    characters: [{
      id: mateId, name, avatarUrl: card.cardImageUrl ?? undefined, artworkId: mateProfileByName(card.name)?.id,
      description: (card.hashtags ?? []).join(' · '), serverCharacter: true,
    }],
  }
}

/**
 * 17's last heartbeat totals. The server always sends all four (0 before any heartbeat), so a missing, non-numeric or
 * negative value, or totals that break `present ≤ cameraOn ≤ connected` / `pip ≤ connected`, is a malformed response
 * (502), never silently repaired: continuing from wrong totals would make the next heartbeat or end fail (400).
 */
export function resumeTotals(dto: ResumeResponse, connected: number) {
  const value = (input: unknown) => {
    if (typeof input !== 'number' || !Number.isFinite(input) || input < 0) throw new ApiError('연결 응답을 확인하지 못했어요.', 502)
    return input
  }
  const presentSeconds = value(dto.presentSeconds)
  const cameraOnSeconds = value(dto.cameraOnSeconds)
  const pipSeconds = value(dto.pipSeconds)
  if (presentSeconds > cameraOnSeconds || cameraOnSeconds > connected || pipSeconds > connected) {
    throw new ApiError('연결 응답의 시간 기록을 확인하지 못했어요.', 502)
  }
  return { presentSeconds, cameraOnSeconds, pipSeconds }
}

/** 16 start / 17 resume → the running connection. `id` is the connection id; room and character are the mate id. */
export function session(dto: StartResponse | ResumeResponse, now = Date.now()): ActiveSession {
  if (!dto.mate) throw new ApiError('연결 응답을 확인하지 못했어요.', 502)
  const mateId = id(dto.mate.id)
  const offset = timestamp(dto.serverTime) - now
  const start = 'startedAt' in dto && dto.startedAt !== undefined ? timestamp(dto.startedAt) - offset : undefined
  // 17: time while disconnected does not count, so the connection continues from the last heartbeat total.
  const connected = start === undefined ? seconds((dto as ResumeResponse).connectedSeconds) : Math.max(0, (now - start) / 1000)
  const active: ActiveSession = {
    id: id(dto.connectionId), roomId: mateId, characterIds: [mateId], serverSession: true, serverOffsetMs: offset,
    tier: 'basic', paidCredits: 0, phase: 'study', elapsedMs: connected * 1000, runningSince: now,
    studySeconds: connected,
    startedAt: start ?? now - connected * 1000,
    camera: false, focus: { observedMs: 0, focusedMs: 0, returns: 0 },
    presenceKnown: true,
  }
  if (start === undefined) active.initialTotals = resumeTotals(dto as ResumeResponse, connected)
  return active
}

/** 22 · 23 → a connection record. */
export function report(dto: ReportResponse): StudyRecord {
  if (!dto.mate) throw new ApiError('연결 기록의 메이트 정보를 확인하지 못했어요.', 502)
  const mateId = id(dto.mate.id)
  const name = mateName(dto.mate.name)
  return {
    id: id(dto.connectionId), roomId: mateId, characterIds: [mateId], tier: 'basic',
    roomName: name, characterName: name, serverReport: dto,
    startedAt: timestamp(dto.startedAt), endedAt: timestamp(dto.endedAt),
    studySeconds: seconds(dto.connectedSeconds), focusSeconds: seconds(dto.presentSeconds), awaySeconds: optionalSeconds(dto.awaySeconds),
    observedSeconds: undefined, returns: optionalSeconds(dto.returnCount),
    completed: false, automatic: dto.endType !== undefined && dto.endType !== 'NORMAL',
  }
}

/** The current background image of a connection (16 · 17 `background` code among `backgrounds`). */
export function connectionBackground(dto: StartResponse | ResumeResponse | null | undefined) {
  if (!dto?.background) return undefined
  return dto.backgrounds?.find(value => value.code === dto.background)?.imageUrl
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * The record screens' settlement view of 22 · 23 `relation` (IntimacyView) or 37 `relation`. `stageProgress` comes as
 * 0–100 and is returned as 0–1.
 */
export function settlement(relation: IntimacyView | MateRelation | null | undefined): StudySettlement | undefined {
  if (!relation) return undefined
  const intimacy = relation as IntimacyView
  const stage = 'stageAfter' in relation ? intimacy.stageAfter : (relation as MateRelation).stage
  const view: StudySettlement = {}
  if (finite(stage)) view.stage = stage
  if (relation.stageName) view.stageName = relation.stageName
  if ('nextStageName' in relation && relation.nextStageName) view.nextStageName = relation.nextStageName
  if (finite(relation.nextStageSeconds)) view.nextLevelSeconds = relation.nextStageSeconds
  if (finite(relation.stageProgress)) view.stageProgress = Math.max(0, Math.min(1, relation.stageProgress / 100))
  if (typeof intimacy.stageUp === 'boolean') view.levelUp = intimacy.stageUp
  return view
}
export function reportSettlement(dto: ReportResponse | undefined) {
  return settlement(dto?.relation)
}
