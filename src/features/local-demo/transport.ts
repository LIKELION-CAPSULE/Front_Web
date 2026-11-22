import { chaerinArtwork } from '../mates/artwork'
import { CALL_STAGE_LIVE2D_LAYOUT } from '../live2d/call-framing'
import { createMockAvatars } from '../review/mock-avatars'
import terms from '../auth/data/legal/terms.md?raw'
import privacy from '../auth/data/legal/privacy.md?raw'
import { LOCAL_CHARACTER_ID, LOCAL_MODEL_URL, LOCAL_ROOM_ID, type LocalBetaStore } from './store'

/** Legacy compatibility at the existing client boundary; beta-only operations use UI ports. */
export function createLocalTransport(store: LocalBetaStore, original: typeof fetch, origin: string): typeof fetch {
  const failures = new Set<string>()
  const avatars = createMockAvatars(990401)
  const image = () => avatars.find(avatar => avatar.id === store.data.avatarId)?.thumbnailUrl ?? avatars[0]!.thumbnailUrl
  const room = () => ({ id: LOCAL_ROOM_ID, name: '채린', description: '', thumbnailUrl: chaerinArtwork.card, bannerUrl: chaerinArtwork.hero,
    characters: [{ id: LOCAL_CHARACTER_ID, name: '채린', profileImageUrl: chaerinArtwork.card, personality: [], relation: store.affinity() }] })
  const visuals = () => ({ sessionId: store.data.active!.id, room: { id: LOCAL_ROOM_ID, name: '채린' },
    character: { id: LOCAL_CHARACTER_ID, name: '채린', profileImageUrl: chaerinArtwork.card, modelJsonUrl: LOCAL_MODEL_URL, ...CALL_STAGE_LIVE2D_LAYOUT },
    me: { nickname: store.data.nickname, profileImageUrl: image() }, serverTime: new Date().toISOString() })
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
    if (path === '/avatars') return reply({ avatars })
    if (path === '/home') return reply({ rooms: [room()], activeSession: store.summary(), todayStudySeconds: store.data.records.filter(record => new Date(record.endedAt).toDateString() === new Date().toDateString()).reduce((total, record) => total + record.studySeconds, 0) })
    if (path === `/rooms/${LOCAL_ROOM_ID}`) return reply(room())
    if (path === '/sessions' && method === 'POST') {
      const minutes = body.targetMinutes
      if (body.roomId !== LOCAL_ROOM_ID || body.characterId !== LOCAL_CHARACTER_ID || typeof minutes !== 'number' || !Number.isInteger(minutes) || !(minutes === 3 || minutes >= 5 && minutes <= 180 && minutes % 5 === 0)) return error('INVALID_TARGET_MINUTES', 400)
      store.start(minutes)
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
    if (operation === 'resume') return reply({ ...visuals(), studySeconds: Math.max(store.data.active.studySeconds, Math.floor((Date.now() - store.data.active.startedAt) / 1000)), breakSeconds: 0 })
    if (operation === 'heartbeat' || operation === 'end') {
      if (!Number.isInteger(body.studySeconds) || !Number.isInteger(body.presentSeconds) || Number(body.presentSeconds) < 0 || Number(body.studySeconds) < Number(body.presentSeconds)) return error('INVALID_STUDY_TIME', 400)
      if (operation === 'heartbeat') { store.heartbeat(Number(body.studySeconds), Number(body.presentSeconds)); return reply(null, 204) }
      const result = store.finish(Number(body.studySeconds), Number(body.presentSeconds)); store.rewardFirstConnection(); return reply(result)
    }
    if (operation === 'events') return reply({ eventId: Date.now(), characters: [{ characterId: LOCAL_CHARACTER_ID, affinity: store.affinity() }] }, 201)
    if (/^events\/\d+\/reaction$/.test(operation)) return reply({ requestId: body.requestId, characters: [{ characterId: LOCAL_CHARACTER_ID }] })
    if (operation === 'messages/stream' || operation === 'messages') {
      if (body.characterId !== LOCAL_CHARACTER_ID || typeof body.requestId !== 'string' || typeof body.content !== 'string' || !body.content.trim()) return error('INVALID_INPUT', 400)
      store.expireAttendance()
      const result = { requestId: body.requestId, characterId: LOCAL_CHARACTER_ID, ...store.reply(body.requestId, body.content) }
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

