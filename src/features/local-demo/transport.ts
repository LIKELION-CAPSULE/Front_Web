import { mateArtwork } from '../mates/artwork'
import { mateLine } from '../mates/mate-lines'
import { localAvatarImage, localAvatarItems, resolveLocalAvatarThumbnails } from './local-avatars'
import terms from '../auth/data/legal/terms.md?raw'
import privacy from '../auth/data/legal/privacy.md?raw'
import { LOCAL_MATES, type LocalBetaStore, type LocalMate } from './store'
import { LOCAL_V2_MODELS } from './local-asset-urls'

/**
 * Scripted local reactions in the shape the backend sends: the expression is the v2 model's Korean label
 * (`live2d_expressions.name`), mirroring the backend seed table (reactions.default.json v3). Lines are local copy.
 */
const CHAERIN_REACTIONS: Record<string, { expression: string; line: string }> = {
  AWAY: { expression: '삐짐', line: '어디 갔어? 금방 와.' },
  RETURN: { expression: '웃음', line: '왔네! 다시 해 보자.' },
  BREAK: { expression: '행복', line: '잠깐 쉬자. 물 한 잔 어때?' },
  FOCUS: { expression: '집중', line: '좋아, 다시 집중!' },
  DROWSY: { expression: '하품', line: '졸려 보여… 기지개 한 번 켜자.' },
  YAWN: { expression: '하품', line: '하암… 나도 졸려.' },
  WAVE: { expression: '웃음', line: '응, 나 여기 있어!' },
  HEAD_TURN: { expression: '경멸', line: '어디 봐? 여기야.' },
  // 「먼저 말 걸기」 (idle-talk.ts): not in the backend seed yet (docs/BACKEND_API.md, IDLE_TALK request).
  IDLE_TALK: { expression: '웃음', line: '조용하네, 뭐 해?' },
}
/** 서도현: his persona's lines (mate-lines.ts) on the closest model expressions; never 채린's lines. */
const dohyun = (key: Parameters<typeof mateLine>[1], expression: string) => ({ expression, line: mateLine('dohyun', key)! })
const DOHYUN_REACTIONS: Record<string, { expression: string; line: string }> = {
  AWAY: dohyun('away', '삐짐'),
  RETURN: dohyun('back', '웃음'),
  BREAK: dohyun('breakStart', '웃음'),
  FOCUS: dohyun('breakEnd', '집중'),
  DROWSY: dohyun('quiet', '경멸'),
  YAWN: dohyun('quiet', '하품'),
  WAVE: dohyun('greet', '웃음'),
  HEAD_TURN: dohyun('givingUp', '삐짐'),
  IDLE_TALK: dohyun('quiet', '집중'),
}
const LOCAL_REACTIONS: Record<string, Record<string, { expression: string; line: string }>> = { chaerin: CHAERIN_REACTIONS, dohyun: DOHYUN_REACTIONS }
const LOCAL_REPLY_EXPRESSIONS: Record<string, { name: string }> = { chaerin: { name: '웃음' }, dohyun: { name: '집중' } }

/** Legacy compatibility at the existing client boundary; beta-only operations use UI ports. */
export function createLocalTransport(store: LocalBetaStore, original: typeof fetch, origin: string): typeof fetch {
  const failures = new Set<string>()
  const eventTypes = new Map<number, string>()
  let nextEventId = Date.now()
  const image = () => localAvatarImage(store.data.avatarId)
  // One room per mate, as the published API does.
  const room = (mate: LocalMate) => ({ id: mate.roomId, name: mate.name, description: '', thumbnailUrl: mateArtwork(mate.mateId)?.card, bannerUrl: mateArtwork(mate.mateId)?.hero,
    characters: [{ id: mate.characterId, name: mate.name, profileImageUrl: mateArtwork(mate.mateId)?.card, personality: [], relation: store.affinity() }] })
  const visuals = () => {
    const mate = store.activeMate()
    return { sessionId: store.data.active!.id, room: { id: mate.roomId, name: mate.name },
      // v2 (Aliving2D) model with the draft contract fields (docs/MATE_MODEL_V2_CONTRACT.md).
      character: { id: mate.characterId, name: mate.name, profileImageUrl: mateArtwork(mate.mateId)?.card, ...LOCAL_V2_MODELS[mate.mateId] },
      me: { nickname: store.data.nickname, profileImageUrl: image() }, serverTime: new Date().toISOString() }
  }
  return async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input), origin)
    const method = (options?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (url.origin !== origin) throw new TypeError('로컬 더미 모드에서는 외부 요청을 실행하지 않아요.')
    if (!url.pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') throw new TypeError('로컬 더미 모드에서는 외부 변경을 실행하지 않아요.')
      return original(input, options)
    }
    const path = url.pathname.replace(/^\/api\/backend/, '')
    const signal = options?.signal ?? (input instanceof Request ? input.signal : undefined)
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return }
      const abort = () => { clearTimeout(timer); reject(signal?.reason) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, store.data.scenario === 'loading' ? 2500 : 120)
      signal?.addEventListener('abort', abort, { once: true })
    })
    const reply = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(status >= 400 ? { success: false, ...body as object } : { success: true, data: body }), { status, headers: { 'content-type': 'application/json' } })
    const error = (code: string, status: number) => reply({ code }, status)
    const faultKey = `${method}:${path.replace(/\/\d+/g, '/id')}`
    const canFail = path === '/home' || path === '/sessions' || path.endsWith('/messages/stream') || path.endsWith('/report') || path === '/me' && method === 'PATCH'
    if (store.data.scenario === 'failure' && canFail && !failures.has(faultKey)) { failures.add(faultKey); return error('LOCAL_TEST_FAILURE', 503) }
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(typeof options?.body === 'string' ? options.body : input instanceof Request ? await input.clone().text() : '{}') as Record<string, unknown> } catch { /* GET/empty body. */ }
    if (path === '/terms') return reply({ terms: [
      { termVersionId: 990501, code: 'SERVICE', name: '이용약관', required: true, content: terms },
      { termVersionId: 990502, code: 'PRIVACY', name: '개인정보 처리방침', required: true, content: privacy },
    ] })
    if (path === '/auth/refresh') return store.data.authenticated ? reply({ accessToken: 'local-beta-access' }) : error('UNAUTHORIZED', 401)
    if (path === '/auth/email/login' || path === '/auth/social/KAKAO') return reply({ ...store.login(), profileImage: image() })
    if (path === '/auth/email/verification') return reply({ expiresInSeconds: 300 }, 202)
    if (path === '/auth/email/verification/confirm') return String(body.code) === '123456' ? reply({ verificationToken: 'local-verification' }) : error('INVALID_CODE', 400)
    if (path === '/auth/logout') { store.logout(); return reply(null, 204) }
    if (path === '/auth/password/reset-request') return reply(null, 202)
    if (path === '/auth/password/reset') return reply(null, 204)
    if (!store.data.authenticated) return error('UNAUTHORIZED', 401)
    if (path === '/me' && method === 'DELETE') { store.reset('guest'); return reply(null, 204) }
    if (path === '/me' && method === 'PATCH') return reply({ ...store.profile(String(body.nickname), typeof body.avatarId === 'number' ? body.avatarId : undefined), profileImage: image() })
    if (path === '/me') return reply(store.me(image()))
    if (path === '/avatars') {
      // Generated thumbnails replace the silhouettes once they exist (scripts/capture-avatar-thumbnails.mjs).
      await resolveLocalAvatarThumbnails(original, origin)
      // QA: `sessionStorage['capsule-local-avatars'] = 'empty'` shows the empty-list state.
      let empty = false
      try { empty = globalThis.sessionStorage?.getItem('capsule-local-avatars') === 'empty' } catch { /* Storage blocked. */ }
      return reply({ avatars: empty ? [] : localAvatarItems() })
    }
    if (path === '/home') return reply({ rooms: LOCAL_MATES.map(room), activeSession: store.summary(), todayStudySeconds: store.data.records.filter(record => new Date(record.endedAt).toDateString() === new Date().toDateString()).reduce((total, record) => total + record.studySeconds, 0) })
    const roomMatch = path.match(/^\/rooms\/(\d+)$/)
    const roomMate = roomMatch ? LOCAL_MATES.find(mate => mate.roomId === Number(roomMatch[1])) : undefined
    if (roomMate) return reply(room(roomMate))
    if (path === '/sessions' && method === 'POST') {
      const minutes = body.targetMinutes
      const mate = LOCAL_MATES.find(value => value.roomId === body.roomId && value.characterId === body.characterId)
      if (!mate || typeof minutes !== 'number' || !Number.isInteger(minutes) || !(minutes === 3 || minutes >= 5 && minutes <= 180 && minutes % 5 === 0)) return error('INVALID_TARGET_MINUTES', 400)
      store.start(minutes, mate.characterId)
      return reply({ ...visuals(), startedAt: new Date(store.data.active!.startedAt).toISOString(), targetMinutes: minutes }, 201)
    }
    const match = path.match(/^\/sessions\/(\d+)\/(.+)$/)
    if (!match) return error('NOT_FOUND', 404)
    const sessionId = Number(match[1]), operation = match[2]!
    if (operation === 'report') {
      const report = store.data.records.find(record => Number(record.id) === sessionId)?.serverReport
      return report ? reply(report) : error('SESSION_NOT_FOUND', 404)
    }
    if (store.data.active?.id !== sessionId) return error('SESSION_ENDED', 409)
    const activeMate = store.activeMate()
    const reactions = LOCAL_REACTIONS[activeMate.mateId] ?? CHAERIN_REACTIONS
    if (operation === 'resume') return reply({ ...visuals(), studySeconds: Math.max(store.data.active.studySeconds, Math.floor((Date.now() - store.data.active.startedAt) / 1000)), breakSeconds: 0 })
    if (operation === 'heartbeat' || operation === 'end') {
      if (!Number.isInteger(body.studySeconds) || !Number.isInteger(body.presentSeconds) || Number(body.presentSeconds) < 0 || Number(body.studySeconds) < Number(body.presentSeconds)) return error('INVALID_STUDY_TIME', 400)
      if (operation === 'heartbeat') { store.heartbeat(Number(body.studySeconds), Number(body.presentSeconds)); return reply(null, 204) }
      const result = store.finish(Number(body.studySeconds), Number(body.presentSeconds)); store.rewardFirstConnection(); return reply(result)
    }
    if (operation === 'events') {
      const eventId = ++nextEventId
      const type = typeof body.type === 'string' ? body.type : ''
      eventTypes.set(eventId, type)
      const face = reactions[type]
      return reply({ eventId, characters: [{ characterId: activeMate.characterId, affinity: store.affinity(), ...(face ? { expression: { name: face.expression } } : {}) }] }, 201)
    }
    if (/^events\/\d+\/reaction$/.test(operation)) {
      const face = reactions[eventTypes.get(Number(operation.split('/')[1])) ?? '']
      return reply({ requestId: body.requestId, characters: [{ characterId: activeMate.characterId, ...(face ? { content: face.line, expression: { name: face.expression } } : {}) }] })
    }
    if (operation === 'messages/stream' || operation === 'messages') {
      if (body.characterId !== activeMate.characterId || typeof body.requestId !== 'string' || typeof body.content !== 'string' || !body.content.trim()) return error('INVALID_INPUT', 400)
      store.expireAttendance()
      const result = { requestId: body.requestId, characterId: activeMate.characterId, ...store.reply(body.requestId, body.content), expression: LOCAL_REPLY_EXPRESSIONS[activeMate.mateId] ?? LOCAL_REPLY_EXPRESSIONS.chaerin }
      if (operation === 'messages') return reply(result)
      const stream = new ReadableStream<Uint8Array>({ async start(controller) {
        const encoder = new TextEncoder()
        for (const content of [result.content.slice(0, 3), result.content]) {
          if (signal?.aborted) { controller.close(); return }
          controller.enqueue(encoder.encode(`event: reply\ndata: ${JSON.stringify({ content })}\n\n`))
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(result)}\n\n`)); controller.close()
      } })
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
    }
    return error('NOT_FOUND', 404)
  }
}

