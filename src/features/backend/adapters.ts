import type { ActiveSession, DemoState, Memory, StudyRecord } from '../demo/types.ts'
import type { StudyRoom } from '../rooms/types.ts'
import type { HomeRoom, MemoryResponse, RoomDetail, StartResponse, ResumeResponse, ReportResponse, MeResponse } from '../../shared/api/types.ts'
import { ApiError } from '../../shared/api/client.ts'
import { studyRooms } from '../rooms/data/rooms.ts'

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
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new ApiError('서버의 공부 시간을 확인하지 못했어요.', 502)
  return value
}
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
  return { ...previous, userId: me.userId, name: me.nickname, loggedIn: true, onboarded: !me.onboardingRequired, profileImage: me.profileImage }
}
export function room(dto: HomeRoom | RoomDetail): StudyRoom {
  if (!dto.name || !Array.isArray(dto.characters)) throw new ApiError('스터디룸 정보를 확인하지 못했어요.', 502)
  return {
    id: id(dto.id), serverRoom: true, name: dto.name, coverUrl: dto.thumbnailUrl,
    artworkId: studyRooms.find(value => value.name === dto.name)?.id,
    description: 'description' in dto ? dto.description ?? '' : '', introduction: '', contentStatus: 'preview',
    characters: dto.characters.map(character => ({
      id: id(character.id), name: character.name ?? '', avatarUrl: character.profileImageUrl,
      artworkId: studyRooms.flatMap(value => value.characters).find(value => value.name === character.name)?.id,
      description: 'personality' in character ? character.personality?.join(' · ') ?? '' : '',
      relation: 'relation' in character ? character.relation : undefined, serverCharacter: true,
    })),
  }
}
export function memory(dto: MemoryResponse): Memory {
  const kind = { EXAM: '시험', GOAL: '목표', PROMISE: '약속' } as const
  if (!dto.type || !dto.title || (dto.type !== 'GOAL' && !dto.dueDate)) throw new ApiError('일정 응답을 확인하지 못했어요.', 502)
  return { id: id(dto.memoryId), kind: kind[dto.type], title: dto.title, date: dto.dueDate ?? '', time: dto.dueTime?.slice(0, 5) ?? '' }
}
export function session(dto: StartResponse | ResumeResponse, now = Date.now()): ActiveSession {
  if (!dto.room || !dto.character || typeof dto.targetMinutes !== 'number' || !Number.isFinite(dto.targetMinutes) || dto.targetMinutes <= 0) throw new ApiError('공부 시작 응답을 확인하지 못했어요.', 502)
  const offset = timestamp(dto.serverTime) - now
  const start = 'startedAt' in dto ? timestamp(dto.startedAt) - offset : undefined
  const study = start === undefined ? seconds((dto as ResumeResponse).studySeconds) : Math.max(0, (now - start) / 1000)
  return {
    id: id(dto.sessionId), roomId: id(dto.room.id), characterIds: [id(dto.character.id)], serverSession: true, serverOffsetMs: offset,
    tier: 'basic', paidCredits: 0, phase: 'study', elapsedMs: study * 1000, runningSince: now,
    studySeconds: study, targetSeconds: dto.targetMinutes * 60,
    startedAt: start ?? now - study * 1000,
    camera: false, focus: { observedMs: 0, focusedMs: 0, returns: 0 },
  }
}
export function report(dto: ReportResponse, roomId: string, targetSeconds?: number): StudyRecord {
  if (!dto.character) throw new ApiError('리포트의 친구 정보를 확인하지 못했어요.', 502)
  return {
    id: id(dto.sessionId), roomId, characterIds: [id(dto.character.id)], tier: 'basic',
    roomName: dto.roomName, characterName: dto.character.name, serverReport: dto,
    targetSeconds, startedAt: timestamp(dto.startedAt), endedAt: timestamp(dto.endedAt),
    studySeconds: seconds(dto.studySeconds), focusSeconds: seconds(dto.presentSeconds), awaySeconds: seconds(dto.awaySeconds),
    observedSeconds: undefined, returns: seconds(dto.returnCount),
    completed: targetSeconds !== undefined && seconds(dto.studySeconds) >= targetSeconds, automatic: false,
  }
}
