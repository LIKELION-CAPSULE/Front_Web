import { studyRooms } from '@/features/rooms/data/rooms'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { getRoomArtwork } from '@/features/rooms/artwork'
import { roomPosters } from '@/features/rooms/posters'
import { roomDetailBanners } from '@/features/rooms/detail-banners'
import { dayKey } from '@/shared/lib/format'
import terms from '@/features/auth/data/legal/terms.md?raw'
import privacy from '@/features/auth/data/legal/privacy.md?raw'
import malfoyProfile from '@/assets/characters/malfoy-ts-v1/web/malfoy-ts-study-v1.webp'
import hogwartsPoster from '@/assets/characters/malfoy-ts-v1/web/hogwarts-night-poster-v1.webp'
import hogwartsBanner from '@/assets/characters/malfoy-ts-v1/web/hogwarts-night-detail-banner-v1.webp'
import hogwartsBackground from '@/assets/characters/malfoy-ts-v1/web/hogwarts-night-background-v1.webp'
import malfoySubject from '@/assets/characters/malfoy-ts-v1/web/malfoy-ts-completion-character-v3.webp'
import type { ReviewScenario } from './catalog'

export const REVIEW_USER_ID = 990001
export const REVIEW_SESSION_ID = 9001

export function createReviewTransport(scenario: ReviewScenario, original: typeof fetch): typeof fetch {
  const base = studyRooms.find(room => room.id === 'dawn-library')!
  const malfoyDesk = scenario.id === 'study-malfoy-desk'
  const malfoyRoom = scenario.id === 'home-malfoy' || malfoyDesk
  const figure = malfoyDesk ? malfoySubject : getCharacterArtwork('chaerin').study
  const rooms = studyRooms.slice(0, 3).map((room, index) => ({
    id: 101 + index, name: malfoyRoom && index === 0 ? '밤의 호그와트 도서관' : room.name, description: room.description,
    thumbnailUrl: malfoyRoom && index === 0 ? hogwartsPoster : roomPosters[getRoomArtwork(room.id).tone],
    bannerUrl: malfoyRoom && index === 0 ? hogwartsBanner : roomDetailBanners[room.id]!.src,
    characters: [{ id: 201 + index, name: malfoyRoom && index === 0 ? '말포이 TS' : room.characters[0]!.name, profileImageUrl: malfoyRoom && index === 0 ? malfoyProfile : getCharacterArtwork(room.characters[0]!.id).study,
      personality: ['조용한', '다정한', '집중하는'], relation: { level: 3, totalStudySeconds: 7200, points: 62, stage: 2, stageName: '친구' } }],
  }))
  const avatars = ['chaerin', 'sua', 'dahee', 'doyun', 'moru', 'aiden', 'elia', 'leon'].map((character, index) => ({ id: 77 + index, name: `아바타 ${String(index + 1).padStart(2, '0')}`, thumbnailUrl: getCharacterArtwork(character).study }))
  let authenticated = !scenario.guest, onboardingRequired = !!scenario.onboarding, nickname = '검토하는 나', profileImage = figure
  let active = !!scenario.session, eventId = 1, memoryId = 10
  let syncFailures = scenario.fault === 'sync' ? 1 : 0
  let studySeconds = 65, presentSeconds = 55
  const today = dayKey()
  const date = (days: number) => dayKey(Date.now() + days * 86_400_000)
  const memories = scenario.empty ? [] : [
    { memoryId: 1, type: 'EXAM', title: '다음 주 모의고사', dueDate: date(7), dueTime: '09:00', dDay: 7 },
    { memoryId: 2, type: 'GOAL', title: '매일 30분씩 책 읽기', dueDate: today, dueTime: null, dDay: 0 },
    { memoryId: 3, type: 'PROMISE', title: '친구와 같이 공부하기', dueDate: date(2), dueTime: '20:00', dDay: 2 },
    { memoryId: 4, type: 'EXAM', title: '지난 주 영어 시험', dueDate: date(-4), dueTime: '10:00', dDay: -4 },
  ]
  const summary = () => active ? { sessionId: REVIEW_SESSION_ID, roomId: 101, roomName: base.name, characterName: base.characters[0]!.name, startedAt: new Date(Date.now() - 65_000).toISOString() } : null
  const me = () => ({ userId: REVIEW_USER_ID, nickname, onboardingRequired, profileImage, activeSession: summary() })
  const visuals = () => ({ sessionId: REVIEW_SESSION_ID, targetMinutes: 3, room: { id: 101, name: malfoyDesk ? '밤의 호그와트 도서관' : base.name, ...(malfoyDesk ? { backgroundImageUrl: hogwartsBackground } : {}) },
    // The review-only image stage reads this local image URL instead of loading a model.
    character: { id: 201, name: malfoyDesk ? '말포이 TS' : base.characters[0]!.name, profileImageUrl: malfoyDesk ? malfoyProfile : figure, modelJsonUrl: scenario.fault === 'model-missing' ? undefined : figure },
    me: { nickname, profileImageUrl: profileImage }, serverTime: new Date().toISOString() })
  const report = () => ({ sessionId: REVIEW_SESSION_ID, roomName: scenario.id === 'report-malfoy' ? '밤의 호그와트 도서관' : base.name, character: { id: 201, name: scenario.id === 'report-malfoy' ? '말포이 TS' : base.characters[0]!.name },
    startedAt: new Date(Date.now() - 1_800_000).toISOString(), endedAt: new Date().toISOString(), endType: 'USER',
    studySeconds: 1500, presentSeconds: 1380, awaySeconds: 120, returnCount: 2,
    relation: { levelBefore: 3, levelAfter: scenario.id === 'report-levelup' ? 4 : 3, pointsBefore: 61, pointsAfter: 62,
      levelUp: scenario.id === 'report-levelup', stage: 2, stageName: '친구', nextLevelSeconds: 200 },
    closingLine: '오늘도 같이 공부해서 좋았어. 다음에도 이 자리에서 만나자.',
  })
  const json = (body: unknown, status = 200) => new Response(status === 204 || body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  return async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href)
    const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (!url.pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') throw new TypeError('Review mode blocks external mutations')
      return original(input, options)
    }
    const path = url.pathname.replace('/api/backend', '')
    const log = (status: number) => parent.postMessage({ type: 'capsule-review:request', method, path, status }, location.origin)
    const reply = (body: unknown, status = 200) => { log(status); return json(body, status) }
    if ((scenario.fault === 'bootstrap-pending' && path === '/auth/refresh') || (scenario.fault === 'kakao-pending' && path === '/auth/social/KAKAO')
      || (scenario.fault === 'home-pending' && path === '/home') || (scenario.fault === 'avatars-pending' && path === '/avatars')
      || (scenario.fault === 'report-pending' && path.endsWith('/report')) || (scenario.fault === 'withdraw-pending' && method === 'DELETE')
      || (scenario.fault === 'reset-request-pending' && path === '/auth/password/reset-request')
      || (scenario.fault === 'memory-pending' && path === '/me/memories' && method === 'POST')
      || (scenario.fault === 'start-pending' && path === '/sessions' && method === 'POST')) {
      log(0)
      return new Promise<Response>((_resolve, reject) => {
        const signal = options?.signal
        if (signal?.aborted) reject(signal.reason)
        else signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    }
    await new Promise(resolve => setTimeout(resolve, 120))
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(typeof options?.body === 'string' ? options.body : '{}') as Record<string, unknown> } catch { /* No request body. */ }
    if (path === '/terms') return reply({ terms: [
      { termVersionId: 901, code: 'SERVICE', name: '이용약관', required: true, content: terms },
      { termVersionId: 902, code: 'PRIVACY', name: '개인정보 처리방침', required: true, content: privacy },
    ] })
    if (path === '/auth/refresh') return authenticated ? reply({ accessToken: 'review-access' }) : reply({ code: 'UNAUTHORIZED' }, 401)
    if (path === '/auth/email/login') {
      if (scenario.fault === 'login' || scenario.fault === 'locked') return reply({ code: scenario.fault === 'locked' ? 'LOGIN_LOCKED' : 'INVALID_CREDENTIALS' }, 401)
      authenticated = true; return reply({ accessToken: 'review-access', ...me() })
    }
    if (path === '/auth/email/verification') return reply({ expiresInSeconds: scenario.fault === 'verification-expired' ? 1 : 300 }, 202)
    if (path === '/auth/email/verification/confirm') return scenario.fault === 'verification' ? reply({ code: 'INVALID_CODE' }, 400) : reply({ verificationToken: 'review-verification' })
    if (path === '/auth/email/signup') { authenticated = true; onboardingRequired = true; nickname = String(body.nickname); return reply({ accessToken: 'review-access', ...me() }) }
    if (path === '/auth/social/KAKAO') { authenticated = true; return reply({ accessToken: 'review-access', ...me() }) }
    if (path === '/auth/logout') { if (scenario.fault === 'logout') return reply({}, 500); authenticated = false; return reply(null, 204) }
    if (path === '/auth/password/reset-request') return scenario.fault === 'reset-request' ? reply({}, 500) : reply(null, 202)
    if (path === '/auth/password/reset') return scenario.fault === 'reset' ? reply({ code: 'RESET_TOKEN_INVALID' }, 400) : reply(null, 204)
    if (!authenticated) return reply({ code: 'UNAUTHORIZED' }, 401)
    if (path === '/me' && method === 'DELETE') {
      if (scenario.fault === 'withdraw-conflict') return reply({ code: 'SESSION_IN_PROGRESS' }, 409)
      if (scenario.fault === 'withdraw') return reply({}, 500)
      authenticated = false; return reply(null)
    }
    if (path === '/me' && method === 'PATCH') {
      if (scenario.fault === 'profile') return reply({}, 500)
      nickname = String(body.nickname); onboardingRequired = false
      profileImage = avatars.find(avatar => avatar.id === body.avatarId)?.thumbnailUrl ?? profileImage
      return reply(me())
    }
    if (path === '/me') return scenario.fault === 'bootstrap' ? reply({}, 500) : reply(me())
    if (path === '/avatars') return reply({ avatars })
    if (path === '/home') return reply({ todayStudySeconds: scenario.returning ? 5400 : 0, activeSession: summary(), rooms: scenario.empty ? [] : rooms })
    if (path === '/me/memories' && method === 'POST') {
      if (scenario.fault === 'memory') return reply({}, 500)
      const saved = { ...body, memoryId: memoryId++ }
      memories.push(saved as typeof memories[number]); return reply(saved, 201)
    }
    if (path === '/me/memories') return reply({ memories, datesWithMemories: memories.map(memory => memory.dueDate) })
    if (path.startsWith('/rooms/')) return reply(rooms.find(room => String(room.id) === path.split('/').at(-1)) ?? {}, 200)
    if (path === '/sessions' && method === 'POST') {
      if (scenario.fault === 'start') return reply({}, 500)
      active = true; return reply({ ...visuals(), startedAt: new Date().toISOString() }, 201)
    }
    if (path.endsWith('/resume')) return reply({ ...visuals(), studySeconds, breakSeconds: 0 })
    if (path.endsWith('/events')) {
      if (syncFailures > 0) { syncFailures--; return reply({}, 500) }
      return reply({ eventId: eventId++, characters: [{ characterId: 201, affinity: { delta: 0, points: 62, level: 3, stage: 2, stageName: '친구' } }] }, 201)
    }
    if (path.endsWith('/reaction')) return reply({ requestId: body.requestId, characters: [{ characterId: 201, content: '천천히 해도 괜찮아. 나도 옆에서 같이 공부할게.' }] })
    if (path.endsWith('/messages')) return scenario.fault === 'message' ? reply({}, 500) : reply({ requestId: body.requestId, characterId: body.characterId, content: '좋아, 우리 조금만 더 집중해 보자!', affinity: { points: 62, stage: 2, stageName: '친구' } })
    if (path.endsWith('/heartbeat')) { studySeconds = Number(body.studySeconds ?? studySeconds); presentSeconds = Number(body.presentSeconds ?? presentSeconds); return reply(null, 204) }
    if (path.endsWith('/end')) {
      if (scenario.fault === 'end') return reply({}, 500)
      active = false; return reply({ ...report(), startedAt: new Date(Date.now() - Number(body.studySeconds) * 1000).toISOString(),
        studySeconds: Number(body.studySeconds), presentSeconds: Number(body.presentSeconds), awaySeconds: Math.max(0, Number(body.studySeconds) - Number(body.presentSeconds)) })
    }
    if (path.endsWith('/report')) return scenario.fault === 'report' ? reply({}, 500) : reply(report())
    if (url.pathname === '/api/chat') return reply({ text: '옆에서 같이 공부할게.' })
    return reply({}, 404)
  }
}
