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
import { createMockAvatars } from './mock-avatars'
import { mateHeroPortrait } from '@/features/mates/artwork'

export const REVIEW_USER_ID = 990001
export const REVIEW_SESSION_ID = 9001

export function createReviewTransport(scenario: ReviewScenario, original: typeof fetch): typeof fetch {
  const base = studyRooms.find(room => room.id === 'dawn-library')!
  const malfoyDesk = scenario.id === 'study-malfoy-desk'
  const malfoyRoom = malfoyDesk
  const figure = malfoyDesk ? malfoySubject : mateHeroPortrait('chaerin')!
  const rooms = studyRooms.slice(0, 3).map((room, index) => ({
    id: 101 + index, name: malfoyRoom && index === 0 ? '밤의 호그와트 도서관' : room.name, description: room.description,
    thumbnailUrl: malfoyRoom && index === 0 ? hogwartsPoster : roomPosters[getRoomArtwork(room.id).tone],
    bannerUrl: malfoyRoom && index === 0 ? hogwartsBanner : roomDetailBanners[room.id]!.src,
    characters: [{
      id: 201 + index,
      name: malfoyRoom && index === 0 ? '말포이 TS' : room.characters[0]!.name,
      profileImageUrl: index === 0 ? figure : getCharacterArtwork(room.characters[0]!.id).study,
      ...(index === 0 && scenario.farewellLine ? { farewellLine: scenario.farewellLine } : {}),
      personality: ['조용한', '다정한', '집중하는'],
      relation: { level: 3, totalStudySeconds: 7200, points: 62, stage: 2, stageName: '친구' },
    }],
  }))
  const avatars = createMockAvatars(77)
  let authenticated = !scenario.guest, onboardingRequired = !!scenario.onboarding, nickname = '검토하는 나', profileImage = avatars[0]!.thumbnailUrl
  let active = !!scenario.session, eventId = 1, memoryId = 10
  let syncFailures = scenario.fault === 'sync' ? 1 : 0
  let studySeconds = 65
  let endedReportFailures = scenario.fault === 'server-ended-report' ? 1 : 0
  let starts = 0
  let targetMinutes = 3
  const sessionId = () => scenario.fault === 'model-ended-retry' && starts > 1 ? REVIEW_SESSION_ID + 1 : REVIEW_SESSION_ID
  const today = dayKey()
  const date = (days: number) => dayKey(Date.now() + days * 86_400_000)
  const memories = scenario.empty ? [] : [
    { memoryId: 1, type: 'EXAM', title: '다음 주 모의고사', dueDate: date(7), dueTime: '09:00', dDay: 7 },
    { memoryId: 2, type: 'GOAL', title: '매일 30분씩 책 읽기', dueDate: today, dueTime: null, dDay: 0 },
    { memoryId: 3, type: 'PROMISE', title: '친구와 같이 공부하기', dueDate: date(2), dueTime: '20:00', dDay: 2 },
    { memoryId: 4, type: 'EXAM', title: '지난 주 영어 시험', dueDate: date(-4), dueTime: '10:00', dDay: -4 },
  ]
  const summary = () => active ? { sessionId: sessionId(), roomId: 101, roomName: base.name, characterName: base.characters[0]!.name, startedAt: new Date(Date.now() - 65_000).toISOString() } : null
  const me = () => ({
    userId: REVIEW_USER_ID,
    nickname,
    email: 'review@example.invalid',
    avatarId: avatars.find(avatar => avatar.thumbnailUrl === profileImage)?.id ?? avatars[0]?.id,
    onboardingRequired,
    profileImage,
    activeSession: summary(),
  })
  const visuals = () => ({ sessionId: sessionId(), targetMinutes, room: { id: 101, name: malfoyDesk ? '밤의 호그와트 도서관' : base.name, ...(malfoyDesk ? { backgroundImageUrl: hogwartsBackground } : {}) },
    // The review-only image stage reads this local image URL instead of loading a model.
    character: { id: 201, name: malfoyDesk ? '말포이 TS' : base.characters[0]!.name, profileImageUrl: malfoyDesk ? malfoyProfile : figure, modelJsonUrl: scenario.fault === 'model-missing' || scenario.fault === 'model-ended-retry' && starts === 1 ? undefined : figure },
    me: { nickname, profileImageUrl: profileImage }, serverTime: new Date().toISOString() })
  const report = () => {
    const isLevelUp = scenario.id === 'report-levelup' || scenario.id === 'connection-record-levelup'
    const isNoCam = scenario.id === 'connection-record-nocam'
    return {
      sessionId: REVIEW_SESSION_ID,
      roomName: scenario.id === 'report-malfoy' ? '밤의 호그와트 도서관' : base.name,
      character: { id: 201, name: scenario.id === 'report-malfoy' ? '말포이 TS' : base.characters[0]!.name },
      startedAt: new Date(Date.now() - 1_500_000).toISOString(),
      endedAt: new Date().toISOString(),
      endType: 'USER',
      ...(isNoCam ? {} : { mode: 'BASIC' }),
      studySeconds: 1500,
      presentSeconds: isNoCam ? 0 : 1380,
      awaySeconds: isNoCam ? 0 : 120,
      returnCount: isNoCam ? 0 : 2,
      ...(isNoCam
        ? {}
        : {
            relation: {
              levelBefore: 3,
              levelAfter: isLevelUp ? 4 : 3,
              pointsBefore: 61,
              pointsAfter: 62,
              levelUp: isLevelUp,
              stage: 2,
              stageName: '친구',
              ...(isLevelUp ? { previousStageName: '아는 사이', stageProgress: 0.35 } : {}),
              nextStageName: '친한 친구',
              nextLevelSeconds: 10800,
            },
            closingLine: '오늘도 같이 있어서 좋았어. 다음에도 여기서 만나자.',
          }),
    }
  }
  const json = (body: unknown, status = 200) => new Response(status === 204 || body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  return async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href)
    // Allow an explicitly opened Figma export to submit its design; app APIs remain mocked.
    if (url.origin === 'https://mcp.figma.com' && url.pathname.startsWith('/mcp/capture/')) return original(input, options)
    const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (!url.pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') throw new TypeError('Review mode blocks external mutations')
      return original(input, options)
    }
    const path = url.pathname.replace('/api/backend', '')
    const log = (status: number) => parent.postMessage({ type: 'capsule-review:request', method, path, status }, location.origin)
    const reply = (body: unknown, status = 200) => {
      log(status)
      const wire = body !== null && url.pathname.startsWith('/api/backend/')
        ? status < 300 ? { success: true, data: body } : { success: false, ...(body as Record<string, unknown>) }
        : body
      return json(wire, status)
    }
    const ended = () => { active = false; return reply({ code: 'SESSION_ENDED', message: 'SESSION_ENDED' }, 409) }
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
      if (scenario.fault === 'login' || scenario.fault === 'locked') return reply({ code: scenario.fault === 'locked' ? 'LOGIN_LOCKED' : 'INVALID_CREDENTIALS' }, scenario.fault === 'locked' ? 429 : 401)
      authenticated = true; return reply({ accessToken: 'review-access', ...me() })
    }
    if (path === '/auth/email/verification') return reply({ expiresInSeconds: scenario.fault === 'verification-expired' ? 1 : 300 }, 202)
    if (path === '/auth/email/verification/confirm') return scenario.fault === 'verification' ? reply({ code: 'INVALID_CODE' }, 400) : reply({ verificationToken: 'review-verification' })
    if (path === '/auth/email/signup') { authenticated = true; onboardingRequired = true; nickname = String(body.nickname); return reply({ accessToken: 'review-access', ...me() }, 201) }
    if (path === '/auth/social/KAKAO') { authenticated = true; return reply({ accessToken: 'review-access', ...me() }) }
    if (path === '/auth/logout') { if (scenario.fault === 'logout') return reply({}, 500); authenticated = false; return reply(null, 204) }
    if (path === '/auth/password/reset-request') return scenario.fault === 'reset-request' ? reply({}, 500) : reply(null, 202)
    if (path === '/auth/password/reset') return scenario.fault === 'reset' ? reply({ code: 'RESET_TOKEN_INVALID' }, 400) : reply(null, 204)
    if (!authenticated) return reply({ code: 'UNAUTHORIZED' }, 401)
    if (path === '/me' && method === 'DELETE') {
      if (scenario.fault === 'withdraw-conflict') return reply({ code: 'SESSION_IN_PROGRESS' }, 409)
      if (scenario.fault === 'withdraw') return reply({}, 500)
      authenticated = false; return reply(null, 204)
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
      // Independent copy of the server's validation, so a broken client cannot pass review.
      const minutes = body.targetMinutes
      if (typeof minutes !== 'number' || !Number.isInteger(minutes) || !(minutes === 3 || minutes >= 5 && minutes <= 180 && minutes % 5 === 0)) return reply({ code: 'INVALID_TARGET_MINUTES' }, 400)
      targetMinutes = minutes
      starts++
      active = true; return reply({ ...visuals(), startedAt: new Date().toISOString() }, 201)
    }
    if (path.endsWith('/resume')) return scenario.fault === 'server-ended-resume' || scenario.fault === 'model-ended-retry' && path.includes(`/${REVIEW_SESSION_ID}/`) ? ended() : reply({ ...visuals(), studySeconds, breakSeconds: 0 })
    if (path.endsWith('/events')) {
      if (scenario.fault === 'server-ended-event') return ended()
      if (syncFailures > 0) { syncFailures--; return reply({}, 500) }
      return reply({ eventId: eventId++, characters: [{ characterId: 201, affinity: { delta: 0, points: 62, level: 3, stage: 2, stageName: '친구' } }] }, 201)
    }
    if (path.endsWith('/reaction')) return reply({ requestId: body.requestId, characters: [{ characterId: 201, content: '천천히 해도 괜찮아. 나도 옆에 있을게.' }] })
    if (path.endsWith('/messages/stream')) {
      if (scenario.fault === 'server-ended-message') return ended()
      if (scenario.fault === 'server-ended-stream') {
        active = false; log(200)
        return new Response(`event: error\ndata: ${JSON.stringify({ code: 'SESSION_ENDED', message: 'SESSION_ENDED' })}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
      }
      if (scenario.fault === 'message') return reply({}, 500)
      const content = '좋아, 우리 조금만 더 집중해 보자!'
      const message = { requestId: body.requestId, characterId: body.characterId, content, affinity: { points: 62, stage: 2, stageName: '친구' } }
      log(200)
      return new Response(`event: reply\ndata: ${JSON.stringify({ content: '좋아,' })}\n\nevent: reply\ndata: ${JSON.stringify({ content })}\n\nevent: done\ndata: ${JSON.stringify(message)}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
    }
    if (path.endsWith('/messages')) return scenario.fault === 'message' ? reply({}, 500) : reply({ requestId: body.requestId, characterId: body.characterId, content: '좋아, 우리 조금만 더 집중해 보자!', affinity: { points: 62, stage: 2, stageName: '친구' } })
    if (path.endsWith('/heartbeat')) {
      if (scenario.fault === 'server-ended-heartbeat' || scenario.fault === 'server-ended-report') return ended()
      if (!Number.isInteger(body.studySeconds) || !Number.isInteger(body.presentSeconds) || Number(body.presentSeconds) < 0 || Number(body.presentSeconds) > Number(body.studySeconds)) return reply({ code: 'INVALID_STUDY_TIME' }, 400)
      studySeconds = Number(body.studySeconds); return reply(null, 204)
    }
    if (path.endsWith('/end')) {
      if (scenario.fault === 'server-ended-finish') return ended()
      if (scenario.fault === 'end') return reply({}, 500)
      active = false; return reply({ ...report(), startedAt: new Date(Date.now() - Number(body.studySeconds) * 1000).toISOString(),
        studySeconds: Number(body.studySeconds), presentSeconds: Number(body.presentSeconds), awaySeconds: Math.max(0, Number(body.studySeconds) - Number(body.presentSeconds)) })
    }
    if (path.endsWith('/report')) {
      if (endedReportFailures > 0) { endedReportFailures--; return reply({}, 503) }
      if (scenario.fault === 'report') return reply({},500)
      const sessionId = Number(path.split('/')[2]), index = Math.max(0,scenario.reports?.indexOf(sessionId) ?? 0)
      const value = report()

      if (
        scenario.id === 'records' ||
        scenario.id === 'records-two-mates' ||
        scenario.id === 'records-camoff' ||
        scenario.id === 'records-past-empty'
      ) {
        const nowMs = Date.now()
        const MIN = 60_000
        const HOUR = 3_600_000
        const DAY = 86_400_000
        // 12 records strictly in the past (<= nowMs) over 5 weeks:
        // today has 2 connections (9001 & 9002), cam-off on 9004 & 9007, level-up on 9003.
        const agoMs = [
          15 * MIN,                  // 9001: today (recent)
          65 * MIN,                  // 9002: today (earlier, 2nd connection on same day)
          1 * DAY + 2 * HOUR,        // 9003: 1 day ago (levelUp)
          2 * DAY + 1 * HOUR,        // 9004: 2 days ago (cam off)
          3 * DAY + 3 * HOUR,        // 9005: 3 days ago
          5 * DAY + 2 * HOUR,        // 9006: 5 days ago
          7 * DAY + 1 * HOUR,        // 9007: 7 days ago (cam off)
          10 * DAY + 2 * HOUR,       // 9008: 10 days ago
          14 * DAY + 1 * HOUR,       // 9009: 14 days ago
          18 * DAY + 2 * HOUR,       // 9010: 18 days ago
          23 * DAY + 1 * HOUR,       // 9011: 23 days ago
          29 * DAY + 2 * HOUR,       // 9012: 29 days ago (prev month)
        ]
        const durationsSec = [1500, 2100, 3000, 2400, 2700, 3600, 1800, 3000, 4500, 2400, 3300, 3900]
        const secondMateIds = new Set([9002, 9005, 9008, 9011])
        const camOffIds = new Set([9004, 9007])
        const studySec = durationsSec[index] ?? 1500
        const isCamOff = scenario.id === 'records-camoff' || camOffIds.has(sessionId)
        const presentSec = isCamOff ? 0 : Math.round(studySec * 0.92)
        const endedAt = nowMs - (agoMs[index] ?? (index + 1) * DAY)
        const isSecondMate = scenario.id === 'records-two-mates' && secondMateIds.has(sessionId)
        const character = isSecondMate ? { id: 202, name: '남학생' } : value.character
        const relation = value.relation
          ? {
              ...value.relation,
              ...(sessionId === 9003 ? { levelUp: true, previousStageName: '아는 사이' } : { levelUp: false }),
            }
          : undefined
        return reply({
          ...value,
          ...(relation ? { relation } : {}),
          character,
          sessionId,
          startedAt: new Date(endedAt - studySec * 1000).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          studySeconds: studySec,
          presentSeconds: presentSec,
          awaySeconds: isCamOff ? 0 : Math.max(0, studySec - presentSec),
          returnCount: isCamOff ? 0 : 1,
        })
      }

      const endedAt = Date.now()-index*86400000
      const relation = value.relation
        ? {
            ...value.relation,
            ...(scenario.id === 'my-mates-full' && index === 0 ? { stageProgress: 0.4 } : {}),
            ...(scenario.id === 'my-mates-full' && index === 2 ? { levelUp: true, previousStageName: '아는 사이' } : {}),
          }
        : undefined
      return reply({
        ...value,
        ...(relation ? { relation } : {}),
        sessionId,
        startedAt: new Date(endedAt - value.studySeconds! * (index + 1) * 1000).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        studySeconds: value.studySeconds * (index + 1),
        presentSeconds: value.presentSeconds * (index + 1),
        awaySeconds: value.awaySeconds * (index + 1),
      })
    }
    if (url.pathname === '/api/chat') return reply({ text: '옆에 있을게.' })
    return reply({}, 404)
  }
}
