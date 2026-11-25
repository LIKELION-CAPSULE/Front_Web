import { mateArtwork } from '../mates/artwork'
import { mateLine } from '../mates/mate-lines'
import { localAvatarImage, localAvatarItems, resolveLocalAvatarThumbnails } from './local-avatars'
import terms from '../auth/data/legal/terms.md?raw'
import privacy from '../auth/data/legal/privacy.md?raw'
import { LOCAL_AFFINITY, LOCAL_MATES, type LocalBetaStore, type LocalMate } from './store'
import { LOCAL_V2_MODELS } from './local-asset-urls'
import type {
  ChatMessage, ConnectionTotals, CreditTransaction, EndType, MateCard, MateDetailResponse, MyMate, RecordsResponse,
  UserSettings,
} from '../../shared/api/types'

/**
 * Scripted local reactions in the shape the backend sends: the expression is the v2 model's Korean label
 * (`live2d_expressions.name`), mirroring the backend seed table (reactions.default.json v3). Lines are local copy.
 * Keys are API 18 types (`AWAY` · `RETURN` · `IDLE_TALK`; `PRESENT` has no reaction).
 */
const CHAERIN_REACTIONS: Record<string, { expression: string; line: string }> = {
  AWAY: { expression: '삐짐', line: '어디 갔어? 금방 와.' },
  RETURN: { expression: '웃음', line: '왔네! 다시 해 보자.' },
  IDLE_TALK: { expression: '웃음', line: '조용하네, 뭐 해?' },
}
/** 서도현: his persona's lines (mate-lines.ts) on the closest model expressions; never 채린's lines. */
const dohyun = (key: Parameters<typeof mateLine>[1], expression: string) => ({ expression, line: mateLine('dohyun', key)! })
const DOHYUN_REACTIONS: Record<string, { expression: string; line: string }> = {
  AWAY: dohyun('away', '삐짐'),
  RETURN: dohyun('back', '웃음'),
  IDLE_TALK: dohyun('quiet', '집중'),
}
const LOCAL_REACTIONS: Record<string, Record<string, { expression: string; line: string }>> = { chaerin: CHAERIN_REACTIONS, dohyun: DOHYUN_REACTIONS }
const LOCAL_REPLY_EXPRESSIONS: Record<string, { name: string }> = { chaerin: { name: '웃음' }, dohyun: { name: '집중' } }
const EVENT_TYPES = new Set(['PRESENT', 'AWAY', 'RETURN', 'IDLE_TALK'])
const END_TYPES = new Set<EndType>(['NORMAL', 'AUTO_AWAY', 'MINOR_LIMIT'])
const DEFAULT_SETTINGS: Required<UserSettings> = { talkFrequency: 'SOMETIMES', voiceEnabled: true, voiceVolume: 70, voiceSpeed: 'NORMAL', pipBubble: true, defaultMode: 'BASIC', pipSize: 'M' }
const SETTING_VALUES: Record<keyof UserSettings, (value: unknown) => boolean> = {
  talkFrequency: value => ['QUIET', 'SOMETIMES', 'OFTEN'].includes(value as string),
  voiceEnabled: value => typeof value === 'boolean',
  voiceVolume: value => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100,
  voiceSpeed: value => ['SLOW', 'NORMAL', 'FAST'].includes(value as string),
  pipBubble: value => typeof value === 'boolean',
  defaultMode: value => ['BASIC', 'ADVANCED'].includes(value as string),
  pipSize: value => ['S', 'M', 'L'].includes(value as string),
}
const ENTRY_TYPES = { attendance: 'ATTENDANCE', invite: 'INVITE', use: 'USE', expiration: 'EXPIRE' } as const
const integer = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

/** API 21 · 22 checks: `0 ≤ present ≤ cameraOn ≤ connected ≤ elapsed`, `0 ≤ pip ≤ connected`. */
export function validConnectionTotals(body: Record<string, unknown>, elapsedSeconds: number): body is ConnectionTotals & Record<string, unknown> {
  const { connectedSeconds, presentSeconds, cameraOnSeconds, pipSeconds } = body
  return integer(connectedSeconds) && integer(presentSeconds) && integer(cameraOnSeconds) && integer(pipSeconds) &&
    presentSeconds <= cameraOnSeconds && cameraOnSeconds <= connectedSeconds && connectedSeconds <= Math.ceil(elapsedSeconds) + 1 && pipSeconds <= connectedSeconds
}

/** The local mock server: the 11-25 paths, bodies, responses and error codes, so mock and server modes share one code path. */
export function createLocalTransport(store: LocalBetaStore, original: typeof fetch, origin: string): typeof fetch {
  const failures = new Set<string>()
  const eventTypes = new Map<number, string>()
  const settings: Required<UserSettings> = { ...DEFAULT_SETTINGS }
  let nextEventId = Date.now()
  const image = () => localAvatarImage(store.data.avatarId)
  const card = (mate: LocalMate): MateCard => ({ id: mate.characterId, name: mate.name, oneLiner: null, ageRating: 'ALL', hashtags: [],
    cardImageUrl: mateArtwork(mate.mateId)?.card ?? null, comingSoon: false })
  const figure = (mate: LocalMate) => ({ id: mate.characterId, name: mate.name, profileImageUrl: mateArtwork(mate.mateId)?.card,
    // v2 (Aliving2D) model; the server sends `format: ALIVING2D_V2`.
    ...LOCAL_V2_MODELS[mate.mateId], format: 'ALIVING2D_V2' })
  const figures = () => {
    const mate = store.activeMate()
    return { connectionId: store.data.active!.id, mate: figure(mate),
      me: { nickname: store.data.nickname, honorific: store.data.details.callName || null, profileImageUrl: image() },
      serverTime: new Date().toISOString(), minorRemainingSeconds: null, backgrounds: [], background: null }
  }
  const detail = (mate: LocalMate): MateDetailResponse => ({
    id: mate.characterId, name: mate.name, oneLiner: null, ageRating: 'ALL', hashtags: [], illustrationUrl: mateArtwork(mate.mateId)?.hero ?? null,
    voiceSampleUrl: null, world: null, myRole: null, intro: null, model: { ...LOCAL_V2_MODELS[mate.mateId], format: 'ALIVING2D_V2' },
    comingSoon: false, hasConversation: store.data.messages.some(message => message.characterId === String(mate.characterId)),
  })
  const myMates = (): MyMate[] => LOCAL_MATES.flatMap(mate => {
    const records = store.data.records.filter(record => record.characterIds[0] === String(mate.characterId)).sort((a, b) => b.endedAt - a.endedAt)
    if (!records.length) return []
    return [{ id: mate.characterId, name: mate.name, cardImageUrl: mateArtwork(mate.mateId)?.card ?? null,
      firstMetAt: new Date(Math.min(...records.map(record => record.startedAt))).toISOString(),
      lastConnectedAt: new Date(records[0]!.startedAt).toISOString(), connectionCount: records.length,
      totalPresentSeconds: records.reduce((sum, record) => sum + record.focusSeconds, 0),
      totalConnectedSeconds: records.reduce((sum, record) => sum + record.studySeconds, 0),
      relation: { stage: LOCAL_AFFINITY.stage, stageName: LOCAL_AFFINITY.stageName, nextStageName: LOCAL_AFFINITY.nextStageName,
        nextStageSeconds: LOCAL_AFFINITY.nextLevelSeconds, stageProgress: Math.round(LOCAL_AFFINITY.stageSeconds / LOCAL_AFFINITY.stageTargetSeconds * 100) },
      unlocks: [],
      recent: records.slice(0, 5).map(record => ({ connectionId: Number(record.id), endedAt: new Date(record.endedAt).toISOString(), presentSeconds: record.focusSeconds, connectedSeconds: record.studySeconds })),
    }]
  })
  /** 38 with the local day (the server uses 05:00 KST). */
  const records = (range: string, dateText: string | null, mateId: number | null): RecordsResponse => {
    const day = (time: number) => { const date = new Date(time); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
    const base = dateText ? new Date(`${dateText}T12:00:00`) : new Date()
    const from = new Date(base), to = new Date(base)
    if (range === 'WEEK') { from.setDate(base.getDate() - ((base.getDay() + 6) % 7)); to.setTime(from.getTime()); to.setDate(from.getDate() + 6) }
    else if (range === 'MONTH') { from.setDate(1); to.setMonth(base.getMonth() + 1, 0) }
    else { from.setMonth(0, 1); to.setMonth(11, 31) }
    const inRange = store.data.records.filter(record => day(record.startedAt) >= day(from.getTime()) && day(record.startedAt) <= day(to.getTime()) &&
      (mateId === null || record.characterIds[0] === String(mateId))).sort((a, b) => b.endedAt - a.endedAt)
    const keyOf = (time: number) => range === 'YEAR' ? day(time).slice(0, 7) : day(time)
    const keys: string[] = []
    for (const cursor = new Date(from); cursor <= to; range === 'YEAR' ? cursor.setMonth(cursor.getMonth() + 1) : cursor.setDate(cursor.getDate() + 1)) keys.push(keyOf(cursor.getTime()))
    const sum = (list: typeof inRange, key: 'focusSeconds' | 'studySeconds') => list.reduce((total, record) => total + record[key], 0)
    return {
      from: day(from.getTime()), to: day(to.getTime()), totalPresentSeconds: sum(inRange, 'focusSeconds'), totalConnectedSeconds: sum(inRange, 'studySeconds'),
      connectedDays: new Set(inRange.map(record => day(record.startedAt))).size, connectionCount: inRange.length,
      buckets: [...new Set(keys)].map(key => { const list = inRange.filter(record => keyOf(record.startedAt) === key); return { key, presentSeconds: sum(list, 'focusSeconds'), connectedSeconds: sum(list, 'studySeconds') } }),
      mates: LOCAL_MATES.flatMap(mate => { const list = inRange.filter(record => record.characterIds[0] === String(mate.characterId)); return list.length ? [{ mateId: mate.characterId, name: mate.name, presentSeconds: sum(list, 'focusSeconds'), connectedSeconds: sum(list, 'studySeconds'), connectionCount: list.length, stage: LOCAL_AFFINITY.stage }] : [] }),
      recent: inRange.slice(0, 5).map(record => ({ connectionId: Number(record.id), mateId: Number(record.characterIds[0]), mateName: record.characterName, endedAt: new Date(record.endedAt).toISOString(), presentSeconds: record.focusSeconds, connectedSeconds: record.studySeconds })),
    }
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
    const error = (code: string, status: number, detail: Record<string, unknown> = {}) => reply({ code, message: code, detail }, status)
    const faultKey = `${method}:${path.replace(/\/\d+/g, '/id')}`
    const canFail = path === '/home' || path === '/connections' || path.endsWith('/messages/stream') || /^\/connections\/\d+$/.test(path) || path === '/me' && method === 'PATCH'
    if (store.data.scenario === 'failure' && canFail && !failures.has(faultKey)) { failures.add(faultKey); return error('LOCAL_TEST_FAILURE', 503) }
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(typeof options?.body === 'string' ? options.body : input instanceof Request ? await input.clone().text() : '{}') as Record<string, unknown> } catch { /* GET/empty body. */ }
    const deviceOk = typeof body.deviceHash === 'string' && body.deviceHash.length >= 1 && body.deviceHash.length <= 64

    // ── Public ──
    if (path === '/terms') return reply({ terms: [
      { termVersionId: 990501, code: 'SERVICE', name: '이용약관', required: true, content: terms },
      { termVersionId: 990502, code: 'PRIVACY', name: '개인정보 처리방침', required: true, content: privacy },
    ] })
    if (path === '/login-mates') return reply({ mates: LOCAL_MATES.map(mate => ({ id: mate.characterId, name: mate.name, ageRating: 'ALL', cardImageUrl: mateArtwork(mate.mateId)?.card ?? null, model: { ...LOCAL_V2_MODELS[mate.mateId], format: 'ALIVING2D_V2' } })) })
    if (path === '/auth/refresh') return store.data.authenticated ? reply({ accessToken: 'local-beta-access' }) : error('UNAUTHORIZED', 401)
    if (path === '/auth/email/login') return reply(store.login())
    if (path === '/auth/social/KAKAO') return deviceOk ? reply({ ...store.login(), isNewUser: false }) : error('INVALID_REQUEST', 400)
    if (path === '/auth/email/signup' && method === 'POST') {
      if (!deviceOk || typeof body.birthDate !== 'string' || typeof body.nickname !== 'string') return error('INVALID_REQUEST', 400)
      store.reset('empty')
      store.data.details.birthDate = body.birthDate
      store.profile(body.nickname)
      store.data.onboardingRequired = true
      return reply(store.login(), 201)
    }
    if (path === '/auth/email/verification') return reply({ expiresInSeconds: 300 }, 202)
    if (path === '/auth/email/verification/confirm') return String(body.code) === '123456' ? reply({ verificationToken: 'local-verification' }) : error('INVALID_CODE', 400, { remainingAttempts: 4 })
    if (path === '/auth/logout') { store.logout(); return reply(null, 204) }
    if (path === '/auth/password/reset-request') return reply(null, 202)
    if (path === '/auth/password/reset') return reply(null, 204)
    if (path === '/beta/waitlist') return reply(null, 204)
    const referralCheck = path.match(/^\/referrals\/([^/]+)$/)
    if (referralCheck && referralCheck[1] !== 'me' && method === 'GET') {
      const code = decodeURIComponent(referralCheck[1]!).trim().toUpperCase()
      return code === 'FRIEND1000' || code === 'CAPSULE2026' ? reply({ inviterNickname: '민수', rewardOnFirstConnection: 1000 }) : error('REFERRAL_CODE_NOT_FOUND', 404)
    }
    if (!store.data.authenticated) return error('UNAUTHORIZED', 401)

    // ── Account ──
    if (path === '/me' && method === 'DELETE') { if (store.data.active) return error('CONNECTION_IN_PROGRESS', 409); store.reset('guest'); return reply(null, 204) }
    if (path === '/me' && method === 'PATCH') {
      if (typeof body.birthDate === 'string' && body.birthDate > `${new Date().getFullYear() - 14}-12-31`) return error('UNDER_14', 400)
      store.updateMe(body)
      return reply(store.me(image()))
    }
    if (path === '/me') return reply(store.me(image()))
    if (path === '/me/settings' && method === 'PATCH') {
      for (const [key, value] of Object.entries(body)) {
        if (!(key in SETTING_VALUES) || value !== null && !SETTING_VALUES[key as keyof UserSettings](value)) return error('INVALID_SETTINGS', 400)
      }
      for (const [key, value] of Object.entries(body)) Object.assign(settings, { [key]: value === null ? DEFAULT_SETTINGS[key as keyof UserSettings] : value })
      return reply({ ...settings })
    }
    if (path === '/me/settings') return reply({ ...settings })
    if (path === '/avatars') {
      // Generated thumbnails replace the silhouettes once they exist (scripts/capture-avatar-thumbnails.mjs).
      await resolveLocalAvatarThumbnails(original, origin)
      // QA: `sessionStorage['capsule-local-avatars'] = 'empty'` shows the empty-list state.
      let empty = false
      try { empty = globalThis.sessionStorage?.getItem('capsule-local-avatars') === 'empty' } catch { /* Storage blocked. */ }
      return reply({ avatars: empty ? [] : localAvatarItems() })
    }
    if (path === '/home') {
      const today = new Date().toDateString()
      const ended = store.data.records.filter(record => new Date(record.endedAt).toDateString() === today)
      const last = store.data.records.slice().sort((a, b) => b.endedAt - a.endedAt)[0]
      const lastMate = last ? LOCAL_MATES.find(mate => String(mate.characterId) === last.characterIds[0]) : undefined
      return reply({ mates: LOCAL_MATES.map(card), activeConnection: store.summary(),
        lastMate: lastMate ? { id: lastMate.characterId, name: lastMate.name, illustrationUrl: mateArtwork(lastMate.mateId)?.hero ?? null } : null,
        todayPresentSeconds: ended.reduce((total, record) => total + record.focusSeconds, 0),
        todayConnectedSeconds: ended.reduce((total, record) => total + record.studySeconds, 0) })
    }

    // ── Credits · referrals · records · notifications ──
    if (path === '/credits') {
      store.expireAttendance()
      return reply({ ...store.credits(), todayUsed: store.data.wallet.usedToday, invitedFriends: store.data.invitation.invitedCount })
    }
    if (path === '/credits/transactions') {
      const filter = url.searchParams.get('filter') ?? 'ALL'
      if (!['ALL', 'ATTENDANCE', 'USE', 'INVITE'].includes(filter)) return error('INVALID_REQUEST', 400)
      const items: CreditTransaction[] = store.data.wallet.entries.map((entry, index) => ({ id: store.data.wallet.entries.length - index, type: ENTRY_TYPES[entry.kind],
        title: entry.description, change: entry.change, balanceAfter: entry.balance, createdAt: new Date(entry.at).toISOString() }))
      return reply({ items: filter === 'ALL' ? items : items.filter(item => item.type === filter), nextCursor: null })
    }
    if (path === '/referrals/me') {
      const invitation = store.data.invitation
      return reply({ code: invitation.code, link: new URL(`/i/${invitation.code}`, origin).href, rewardedCount: invitation.invitedCount, maxRewards: 10,
        rewardedCredits: invitation.rewardedCredits, friends: [], canEnterCode: invitation.canRedeem && !store.data.details.referralRegistered,
        codeInputDeadline: invitation.canRedeem ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null })
    }
    if (path === '/referrals' && method === 'POST') {
      if (typeof body.code !== 'string' || !deviceOk) return error('INVALID_REQUEST', 400)
      const failure = store.enterReferral(body.code)
      if (failure) return error(failure, failure === 'REFERRAL_CODE_NOT_FOUND' ? 404 : failure === 'REFERRAL_ALREADY_ENTERED' ? 409 : 400)
      return reply({ inviterNickname: '민수', rewardOnFirstConnection: 1000 }, 201)
    }
    if (path === '/records') {
      const range = url.searchParams.get('range')
      if (!range || !['WEEK', 'MONTH', 'YEAR'].includes(range)) return error('INVALID_REQUEST', 400)
      const mateId = url.searchParams.get('mateId')
      return reply(records(range, url.searchParams.get('date'), mateId ? Number(mateId) : null))
    }
    if (path === '/notifications') return reply({ items: [], unreadCount: 0, nextBefore: null })
    if (path === '/notifications/read') return reply({ unreadCount: 0 })
    if (path === '/feedback' && method === 'POST') return reply({ feedbackId: Date.now() }, 201)
    const messageMatch = path.match(/^\/messages\/([^/]+)\/(rating|report)$/)
    if (messageMatch) {
      if (!store.data.messages.some(message => message.requestId === decodeURIComponent(messageMatch[1]!) && message.sender === 'character')) return error('MESSAGE_NOT_FOUND', 404)
      return messageMatch[2] === 'rating' ? reply(null, 204) : reply({ reportId: Date.now() }, 201)
    }

    // ── Mates ──
    if (path === '/mates/me') return reply({ mates: myMates() })
    const mateMatch = path.match(/^\/mates\/(\d+)(\/.*)?$/)
    if (mateMatch) {
      const mate = LOCAL_MATES.find(value => value.characterId === Number(mateMatch[1]))
      if (!mate) return error('MATE_NOT_FOUND', 404)
      const rest = mateMatch[2] ?? ''
      if (!rest) return reply(detail(mate))
      if (rest === '/alert') return error('MATE_ALREADY_OPEN', 409)
      if (rest === '/conversation/reset') {
        if (store.data.active?.characterId === mate.characterId) return error('CONNECTION_IN_PROGRESS', 409)
        store.data.messages = store.data.messages.filter(message => message.characterId !== String(mate.characterId)); store.changed()
        return reply(null, 204)
      }
      if (rest === '/messages') {
        const size = Number(url.searchParams.get('size') ?? 20)
        if (!Number.isInteger(size) || size < 1 || size > 50) return error('INVALID_REQUEST', 400)
        const list = store.data.messages.filter(message => message.characterId === String(mate.characterId) && /^\d+$/.test(message.sessionId))
          .slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        const cursor = Number(url.searchParams.get('cursor') ?? 0)
        const page = list.slice(cursor, cursor + size)
        const messages: ChatMessage[] = page.map(message => ({ requestId: message.requestId ?? message.id, sender: message.sender === 'user' ? 'USER' : 'MATE', content: message.text,
          inputType: message.sender === 'user' ? 'TEXT' : null, rating: null, createdAt: new Date(message.createdAt ?? 0).toISOString(), connectionId: Number(message.sessionId) }))
        return reply({ messages, nextCursor: cursor + size < list.length ? String(cursor + size) : null })
      }
      return error('NOT_FOUND', 404)
    }

    // ── Connections ──
    if (path === '/connections' && method === 'POST') {
      const mate = LOCAL_MATES.find(value => value.characterId === body.mateId)
      if (!mate) return error('MATE_NOT_FOUND', 404)
      if (store.data.onboardingRequired) return error('ONBOARDING_REQUIRED', 403)
      if (store.data.active) return error('CONNECTION_ALREADY_IN_PROGRESS', 409, { connectionId: store.data.active.id })
      store.start(mate.characterId)
      const firstMeet = !store.data.records.some(record => record.characterIds[0] === String(mate.characterId))
      return reply({ ...figures(), startedAt: new Date(store.data.active!.startedAt).toISOString(), settings: { ...settings }, firstMeet,
        greeting: { trigger: 'GREETING', intensity: null, line: null, expression: '웃음', audio: null },
        relation: { stage: LOCAL_AFFINITY.stage, stageName: LOCAL_AFFINITY.stageName }, credits: store.credits() }, 201)
    }
    const match = path.match(/^\/connections\/(\d+)(?:\/(.+))?$/)
    if (!match) return error('NOT_FOUND', 404)
    const connectionId = Number(match[1]), operation = match[2] ?? ''
    if (!operation) {
      if (store.data.active?.id === connectionId) return error('CONNECTION_IN_PROGRESS', 409)
      const report = store.data.records.find(record => Number(record.id) === connectionId)?.serverReport
      return report ? reply(report) : error('CONNECTION_NOT_FOUND', 404)
    }
    const active = store.data.active
    if (active?.id !== connectionId) {
      // 22 answers an ended connection with its record again.
      const report = operation === 'end' ? store.data.records.find(record => Number(record.id) === connectionId)?.serverReport : undefined
      if (report) return reply(report)
      return store.data.records.some(record => Number(record.id) === connectionId) ? error('CONNECTION_ENDED', 409) : error('CONNECTION_NOT_FOUND', 404)
    }
    const activeMate = store.activeMate()
    const reactions = LOCAL_REACTIONS[activeMate.mateId] ?? CHAERIN_REACTIONS
    if (operation === 'resume') return reply({ ...figures(), connectedSeconds: active.studySeconds, presentSeconds: active.presentSeconds,
      cameraOnSeconds: Math.max(active.presentSeconds, active.cameraOnSeconds ?? 0), pipSeconds: active.pipSeconds ?? 0 })
    if (operation === 'heartbeat' || operation === 'end') {
      if (!validConnectionTotals(body, (Date.now() - active.startedAt) / 1000)) return error('INVALID_CONNECTION_TIME', 400)
      const totals = { connectedSeconds: body.connectedSeconds, presentSeconds: body.presentSeconds, cameraOnSeconds: body.cameraOnSeconds, pipSeconds: body.pipSeconds }
      if (operation === 'heartbeat') { store.heartbeat(totals); return reply({ minorRemainingSeconds: null, serverTime: new Date().toISOString(), stageUp: null }) }
      const endType = (body.endType ?? 'NORMAL') as EndType
      if (!END_TYPES.has(endType)) return error('INVALID_REQUEST', 400)
      return reply(store.finish(totals, endType))
    }
    if (operation === 'events') {
      const type = typeof body.type === 'string' ? body.type : ''
      if (!EVENT_TYPES.has(type) || typeof body.occurredAt !== 'string') return error('INVALID_EVENT', 400)
      const eventId = ++nextEventId
      eventTypes.set(eventId, type)
      const face = reactions[type]
      const trigger = type === 'IDLE_TALK' ? 'IDLE' : type
      return reply({ eventId, reaction: type === 'PRESENT' ? null : { trigger, intensity: type === 'AWAY' ? 1 : null, line: null, expression: face?.expression ?? null, audio: null } }, 201)
    }
    if (/^events\/\d+\/reaction$/.test(operation)) {
      const type = eventTypes.get(Number(operation.split('/')[1]))
      if (!type) return error('EVENT_NOT_FOUND', 404)
      if (typeof body.requestId !== 'string') return error('INVALID_REQUEST', 400)
      const face = reactions[type]
      return reply({ requestId: body.requestId, characters: [{ characterId: activeMate.characterId, ...(face ? { content: face.line, expression: { name: face.expression, file: null } } : {}), fallback: false, audioBase64: null }], charged: 0, credits: null })
    }
    if (operation === 'messages/stream' || operation === 'messages') {
      if (body.characterId !== activeMate.characterId) return error('CHARACTER_NOT_IN_SESSION', 400)
      if (typeof body.requestId !== 'string' || typeof body.content !== 'string') return error('INVALID_REQUEST', 400)
      if (!body.content.trim()) return error('EMPTY_MESSAGE', 400)
      if (body.mode !== undefined && body.mode !== 'BASIC' && body.mode !== 'ADVANCED') return error('INVALID_REQUEST', 400)
      store.expireAttendance()
      const advanced = body.mode === 'ADVANCED' || body.mode === undefined && store.data.settings.advanced
      const answer = store.reply(body.requestId, body.content, advanced)
      if (!answer) return error('CREDIT_INSUFFICIENT', 409, { credits: store.credits() })
      const result = { requestId: body.requestId, characterId: activeMate.characterId, content: answer.content, affinity: answer.affinity, emotion: '웃음',
        expression: LOCAL_REPLY_EXPRESSIONS[activeMate.mateId] ?? LOCAL_REPLY_EXPRESSIONS.chaerin, fallback: false, audioBase64: null, motion: null,
        mode: advanced ? 'ADVANCED' : 'BASIC', charged: answer.charged, credits: store.credits(), safety: null, background: null, voice: false }
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
