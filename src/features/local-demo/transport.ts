import { mateArtwork } from '../mates/artwork'
import { businessDay } from '../../shared/lib/format'
import { mateLine } from '../mates/mate-lines'
import { localAvatarImage, localAvatarItems, resolveLocalAvatarThumbnails } from './local-avatars'
import terms from '../auth/data/legal/terms.md?raw'
import privacy from '../auth/data/legal/privacy.md?raw'
import { LOCAL_AFFINITY, LOCAL_FRIEND_NAMES, LOCAL_MATES, type LocalBetaStore, type LocalMate } from './store'
import { LOCAL_V2_MODELS } from './local-asset-urls'
import { LOCAL_VOICE_TONE_MP3, localVoicePieces } from './voice-tone'
import type {
  ChatMessage, ConnectionTotals, CreditTransaction, EndType, MateCard, MateDetailResponse, MyMate, RecordsResponse,
  UserSettings,
} from '../../shared/api/types'

/**
 * Scripted local reactions in the shape the backend sends: the expression is the v2 model's Korean label
 * (`live2d_expressions.name`), mirroring the backend seed table (reactions.default.json v3). Lines are local copy.
 * Keys are API 18 types (`AWAY` · `RETURN` · `IDLE_TALK`; `PRESENT` has no reaction).
 */
const line = (mateId: string, key: Parameters<typeof mateLine>[1], expression: string) => ({ expression, line: mateLine(mateId, key)! })
/** 채린: her persona's lines (mate-lines.ts) on the closest model expressions. */
const CHAERIN_REACTIONS: Record<string, { expression: string; line: string }> = {
  AWAY: line('chaerin', 'away', '삐짐'),
  RETURN: line('chaerin', 'back', '웃음'),
  IDLE_TALK: line('chaerin', 'quiet', '하품'),
}
/** 서도현: his persona's lines (mate-lines.ts) on the closest model expressions; never 채린's lines. */
const DOHYUN_REACTIONS: Record<string, { expression: string; line: string }> = {
  AWAY: line('dohyun', 'away', '삐짐'),
  RETURN: line('dohyun', 'back', '웃음'),
  IDLE_TALK: line('dohyun', 'quiet', '집중'),
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
  /** 43's list for this tab (newest first, higher ids newer): a few fresh ones, then enough older ones for a second page. */
  const notifications = localNotifications(Date.now())
  /** 40 · 41 for this tab: the ratings 32 reads back, the replies already reported. */
  const ratings = new Map<string, 'UP' | 'DOWN'>()
  const reported = new Set<string>()
  /** Kakao sign-up tickets already spent in this tab (they are single use). */
  const usedSignupTokens = new Set<string>()
  /**
   * QA (session storage, development only): `capsule-local-coming-soon` = a mate's catalogue id (e.g. `dohyun`) makes that
   * mate coming soon (11 · 31 `comingSoon`, 16 refuses it, 46 accepts the alert, 48 leaves it out);
   * `capsule-local-beta-full` = `1` makes a new signup (4) and Kakao (6 and its sign-up step) answer 403 `BETA_FULL`;
   * `capsule-local-kakao-signup` = `expired` | `invalid` | `terms` makes the Kakao sign-up step answer 401
   * `SIGNUP_TOKEN_EXPIRED` (and its ticket last 1 s) | 401 `SIGNUP_TOKEN_INVALID` | 400 `TERMS_NOT_AGREED`;
   * `capsule-local-notifications` = `empty` | `error` empties 43 or makes it fail; `capsule-local-chat-delay` (ms) slows
   * 32 and `capsule-local-chat-fail` (N) fails its next N reads.
   */
  const qa = (key: string) => { try { return globalThis.sessionStorage?.getItem(key) ?? null } catch { return null } }
  const comingSoon = (mate: LocalMate) => qa('capsule-local-coming-soon') === mate.mateId
  const card = (mate: LocalMate): MateCard => ({ id: mate.characterId, name: mate.name, oneLiner: null, ageRating: 'ALL', hashtags: [],
    cardImageUrl: mateArtwork(mate.mateId)?.card ?? null, comingSoon: comingSoon(mate) })
  const figure = (mate: LocalMate) => ({ id: mate.characterId, name: mate.name, profileImageUrl: mateArtwork(mate.mateId)?.card,
    // v2 (Aliving2D) model; the server sends `format: ALIVING2D_V2`.
    ...LOCAL_V2_MODELS[mate.mateId], format: 'ALIVING2D_V2' })
  /**
   * QA: `sessionStorage['capsule-local-minor-seconds'] = '600'` makes the account under 19 with that many seconds left
   * today when the connection starts (API 16 · 17 · 21 `minorRemainingSeconds`); unset, an adult (null).
   */
  const minorRemaining = () => {
    let raw: string | null = null
    try { raw = globalThis.sessionStorage?.getItem('capsule-local-minor-seconds') ?? null } catch { /* Storage blocked. */ }
    const total = raw === null ? NaN : Number(raw)
    if (!Number.isFinite(total)) return null
    const active = store.data.active
    return Math.max(0, Math.floor(total - (active ? (Date.now() - active.startedAt) / 1000 : 0)))
  }
  const figures = () => {
    const mate = store.activeMate()
    return { connectionId: store.data.active!.id, mate: figure(mate),
      me: { nickname: store.data.nickname, honorific: null, profileImageUrl: image() },
      serverTime: new Date().toISOString(), minorRemainingSeconds: minorRemaining(), backgrounds: [], background: null }
  }
  const detail = (mate: LocalMate): MateDetailResponse => ({
    id: mate.characterId, name: mate.name, oneLiner: null, ageRating: 'ALL', hashtags: [], illustrationUrl: mateArtwork(mate.mateId)?.hero ?? null,
    voiceSampleUrl: null, world: null, myRole: null, intro: null, model: { ...LOCAL_V2_MODELS[mate.mateId], format: 'ALIVING2D_V2' },
    comingSoon: comingSoon(mate), hasConversation: store.data.messages.some(message => message.characterId === String(mate.characterId)),
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
  /**
   * 38 by the server's rules: a connection counts on the day it started, a day running from 05:00 Seoul time; WEEK is
   * Monday–Sunday, YEAR has month buckets (`YYYY-MM`); every bucket of the range, empty ones at 0; the newest five.
   */
  const records = (range: string, dateText: string | null, mateId: number | null): RecordsResponse => {
    const DAY = 86_400_000
    const day = (time: number) => businessDay(time)
    const base = dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : day(Date.now())
    const [y, m, d] = base.split('-').map(Number) as [number, number, number]
    const utc = (year: number, month: number, date: number) => new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10)
    const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
    const from = range === 'WEEK' ? utc(y, m, d - weekday) : range === 'MONTH' ? utc(y, m, 1) : utc(y, 1, 1)
    const to = range === 'WEEK' ? utc(y, m, d - weekday + 6) : range === 'MONTH' ? utc(y, m + 1, 0) : utc(y, 12, 31)
    const inRange = store.data.records.filter(record => day(record.startedAt) >= from && day(record.startedAt) <= to &&
      (mateId === null || record.characterIds[0] === String(mateId))).sort((a, b) => b.endedAt - a.endedAt)
    const keyOf = (time: number) => range === 'YEAR' ? day(time).slice(0, 7) : day(time)
    const keys: string[] = []
    if (range === 'YEAR') for (let month = 1; month <= 12; month++) keys.push(`${y}-${String(month).padStart(2, '0')}`)
    else for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += DAY) keys.push(new Date(time).toISOString().slice(0, 10))
    const sum = (list: typeof inRange, key: 'focusSeconds' | 'studySeconds') => list.reduce((total, record) => total + record[key], 0)
    return {
      from, to, totalPresentSeconds: sum(inRange, 'focusSeconds'), totalConnectedSeconds: sum(inRange, 'studySeconds'),
      connectedDays: new Set(inRange.map(record => day(record.startedAt))).size, connectionCount: inRange.length,
      buckets: keys.map(key => { const list = inRange.filter(record => keyOf(record.startedAt) === key); return { key, presentSeconds: sum(list, 'focusSeconds'), connectedSeconds: sum(list, 'studySeconds') } }),
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
    if (path === '/login-mates') return reply({ mates: LOCAL_MATES.filter(mate => !comingSoon(mate)).map(mate => ({ id: mate.characterId, name: mate.name, ageRating: 'ALL', cardImageUrl: mateArtwork(mate.mateId)?.card ?? null, model: { ...LOCAL_V2_MODELS[mate.mateId], format: 'ALIVING2D_V2' } })) })
    if (path === '/auth/refresh') return store.data.authenticated ? reply({ accessToken: 'local-beta-access' }) : error('UNAUTHORIZED', 401)
    if (path === '/auth/email/login') return reply(store.login())
    if (path === '/auth/social/KAKAO' && method === 'POST') {
      if (!deviceOk) return error('INVALID_REQUEST', 400)
      if (qa('capsule-local-beta-full') === '1') return error('BETA_FULL', 403)
      // Contract a′ (kakao-signup-contract.ts): a first-time Kakao user (here: a code starting with `new-`) gets no
      // account yet, only a short sign-up ticket. Any other code is a Kakao user who already has an account.
      if (typeof body.code === 'string' && body.code.startsWith('new-')) {
        const expiresInSeconds = qa('capsule-local-kakao-signup') === 'expired' ? 1 : 600
        return error('KAKAO_SIGNUP_REQUIRED', 403, { signupToken: `local-signup.${Date.now() + expiresInSeconds * 1000}.${crypto.randomUUID()}`, expiresInSeconds })
      }
      return reply({ ...store.login(), isNewUser: false })
    }
    if (path === '/auth/social/KAKAO/signup' && method === 'POST') {
      if (!deviceOk || typeof body.signupToken !== 'string' || !Array.isArray(body.agreedTermVersionIds)) return error('INVALID_REQUEST', 400)
      // The ticket carries its own expiry, so a refreshed consent screen can still use it; each one works once per tab.
      const [kind, expiry] = body.signupToken.split('.')
      const switched = qa('capsule-local-kakao-signup')
      if (switched === 'invalid' || kind !== 'local-signup' || usedSignupTokens.has(body.signupToken)) return error('SIGNUP_TOKEN_INVALID', 401)
      if (switched === 'expired' || !(Number(expiry) > Date.now())) return error('SIGNUP_TOKEN_EXPIRED', 401)
      if (switched === 'terms' || ![990501, 990502].every(id => (body.agreedTermVersionIds as unknown[]).includes(id))) return error('TERMS_NOT_AGREED', 400)
      if (qa('capsule-local-beta-full') === '1') return error('BETA_FULL', 403)
      usedSignupTokens.add(body.signupToken)
      return reply({ ...store.beginOnboarding(), isNewUser: true })
    }
    if (path === '/auth/email/signup' && method === 'POST' && qa('capsule-local-beta-full') === '1') return error('BETA_FULL', 403)
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
    // 45: an email already on the list gets 204 again.
    if (path === '/beta/waitlist') return typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? reply(null, 204) : error('INVALID_EMAIL', 400)
    const referralCheck = path.match(/^\/referrals\/([^/]+)$/)
    if (referralCheck && referralCheck[1] !== 'me' && method === 'GET') {
      const code = decodeURIComponent(referralCheck[1]!).trim().toUpperCase()
      // 39 does not check whose code it is for (own code: 36 refuses it with REFERRAL_SELF).
      if (code === store.data.invitation.code) return reply({ inviterNickname: store.data.nickname, rewardOnFirstConnection: 1000 })
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
      // QA: `sessionStorage['capsule-local-settings-fail'] = '1'` makes saving fail (the settings tab's 「다시 저장」).
      let failing = false
      try { failing = globalThis.sessionStorage?.getItem('capsule-local-settings-fail') === '1' } catch { /* Storage blocked. */ }
      if (failing) return error('LOCAL_TEST_FAILURE', 503)
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
      // Newest first; `cursor` is the last id of the page before (ids grow with time); `size` 1–50 (default 20).
      const filter = url.searchParams.get('filter') ?? 'ALL'
      const size = Number(url.searchParams.get('size') ?? 20)
      const cursor = url.searchParams.get('cursor')
      if (!['ALL', 'ATTENDANCE', 'USE', 'INVITE'].includes(filter) || !Number.isInteger(size) || size < 1 || size > 50 || (cursor !== null && !/^\d+$/.test(cursor))) {
        return error('INVALID_REQUEST', 400)
      }
      const items: CreditTransaction[] = store.data.wallet.entries.map((entry, index) => ({ id: store.data.wallet.entries.length - index, type: ENTRY_TYPES[entry.kind],
        title: entry.description, change: entry.change, balanceAfter: entry.balance, createdAt: new Date(entry.at).toISOString() }))
      const matching = items.filter(item => (filter === 'ALL' || item.type === filter) && (cursor === null || item.id! < Number(cursor)))
      const page = matching.slice(0, size)
      return reply({ items: page, nextCursor: matching.length > size ? String(page.at(-1)!.id) : null })
    }
    if (path === '/referrals/me') {
      const invitation = store.data.invitation
      // 35 `friends`, newest first: those who entered my code and have not finished a connection, then the rewarded ones.
      const day = 86_400_000, now = Date.now()
      const joined = Array.from({ length: invitation.joinedCount ?? 0 }, (_, index) => ({
        nickname: LOCAL_FRIEND_NAMES[(invitation.invitedCount + index) % LOCAL_FRIEND_NAMES.length], status: 'JOINED', rewarded: false,
        joinedAt: new Date(now - (index + 1) * 3_600_000).toISOString() }))
      const rewarded = Array.from({ length: invitation.invitedCount }, (_, index) => ({
        nickname: LOCAL_FRIEND_NAMES[index % LOCAL_FRIEND_NAMES.length], status: 'QUALIFIED', rewarded: true,
        joinedAt: new Date(now - (invitation.invitedCount - index + 1) * 2 * day).toISOString() })).reverse()
      return reply({ code: invitation.code, link: new URL(`/i/${invitation.code}`, origin).href, rewardedCount: invitation.invitedCount, maxRewards: 10,
        rewardedCredits: invitation.rewardedCredits, friends: [...joined, ...rewarded], canEnterCode: invitation.canRedeem && !store.data.details.referralRegistered,
        codeInputDeadline: invitation.canRedeem ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null })
    }
    // Proposed attendance API (attendance-source.ts): answered only when the local server plays it; otherwise 404 as now.
    if (path === '/attendance' && method === 'GET') return store.attendanceApi ? reply(store.attendanceStatus()) : error('NOT_FOUND', 404)
    if (path === '/attendance/check-in' && method === 'POST') {
      if (!store.attendanceApi) return error('NOT_FOUND', 404)
      const result = store.checkInAttendance()
      return result ? reply(result, 201) : error('ALREADY_CHECKED_IN', 409)
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
    // 43 · 44. QA: `sessionStorage['capsule-local-notifications']` = `empty` (none) or `error` (43 answers 503).
    if (path === '/notifications' || path === '/notifications/read') {
      const mode = qa('capsule-local-notifications')
      if (mode === 'error' && path === '/notifications') return error('LOCAL_TEST_FAILURE', 503)
      const list = mode === 'empty' ? [] : notifications
      const unreadCount = () => list.filter(item => !item.read).length
      if (path === '/notifications/read') {
        if (method !== 'POST') return error('METHOD_NOT_ALLOWED', 405)
        const ids = Array.isArray(body.ids) ? new Set(body.ids as unknown[]) : null
        for (const item of list) if (!ids || ids.has(item.id)) item.read = true
        return reply({ unreadCount: unreadCount() })
      }
      const size = Number(url.searchParams.get('size') ?? 20)
      const before = url.searchParams.get('before')
      if (!Number.isInteger(size) || size < 1 || size > 50 || (before !== null && !/^\d+$/.test(before))) return error('INVALID_REQUEST', 400)
      const older = list.filter(item => before === null || item.id < Number(before))
      const page = older.slice(0, size)
      return reply({ items: page.map(item => ({ ...item, createdAt: new Date(item.createdAt).toISOString() })), unreadCount: unreadCount(),
        nextBefore: older.length > size ? page[page.length - 1]!.id : null })
    }
    if (path === '/feedback' && method === 'POST') return reply({ feedbackId: Date.now() }, 201)
    const messageMatch = path.match(/^\/messages\/([^/]+)\/(rating|report)$/)
    if (messageMatch) {
      const requestId = decodeURIComponent(messageMatch[1]!)
      if (!store.data.messages.some(message => (message.requestId ?? message.id) === requestId && message.sender === 'character')) return error('MESSAGE_NOT_FOUND', 404)
      if (messageMatch[2] === 'rating') {
        if (method !== 'PUT' || !(body.rating === 'UP' || body.rating === 'DOWN' || body.rating === null)) return error('INVALID_REQUEST', 400)
        if (body.rating === null) ratings.delete(requestId); else ratings.set(requestId, body.rating)
        return reply(null, 204)
      }
      const reason = body.reason, detail = typeof body.detail === 'string' ? body.detail.trim() : ''
      if (method !== 'POST' || !['INAPPROPRIATE', 'VIOLENT', 'OUT_OF_CHARACTER', 'OTHER'].includes(String(reason)) || detail.length > 300 || (reason === 'OTHER' && !detail)) return error('INVALID_REQUEST', 400)
      if (reported.has(requestId)) return error('ALREADY_REPORTED', 409)
      reported.add(requestId)
      return reply({ reportId: Date.now() }, 201)
    }

    // ── Mates ──
    if (path === '/mates/me') return reply({ mates: myMates() })
    const mateMatch = path.match(/^\/mates\/(\d+)(\/.*)?$/)
    if (mateMatch) {
      const mate = LOCAL_MATES.find(value => value.characterId === Number(mateMatch[1]))
      if (!mate) return error('MATE_NOT_FOUND', 404)
      const rest = mateMatch[2] ?? ''
      if (!rest) return reply(detail(mate))
      // 46: 204 while the mate is coming soon (again on a second request), 409 once it is open.
      if (rest === '/alert') return comingSoon(mate) ? reply(null, 204) : error('MATE_ALREADY_OPEN', 409)
      if (rest === '/conversation/reset') {
        if (store.data.active?.characterId === mate.characterId) return error('CONNECTION_IN_PROGRESS', 409)
        store.data.messages = store.data.messages.filter(message => message.characterId !== String(mate.characterId)); store.changed()
        return reply(null, 204)
      }
      if (rest === '/messages') {
        // QA: `capsule-local-chat-delay` = ms (a slow 32), `capsule-local-chat-fail` = N (the next N reads answer 503).
        const slow = Number(qa('capsule-local-chat-delay'))
        if (slow > 0) await new Promise(resolve => setTimeout(resolve, Math.min(slow, 30_000)))
        const failing = Number(qa('capsule-local-chat-fail'))
        if (failing > 0) {
          try { globalThis.sessionStorage?.setItem('capsule-local-chat-fail', String(failing - 1)) } catch { /* Storage blocked. */ }
          return error('LOCAL_TEST_FAILURE', 503)
        }
        const size = Number(url.searchParams.get('size') ?? 20)
        if (!Number.isInteger(size) || size < 1 || size > 50) return error('INVALID_REQUEST', 400)
        const list = store.data.messages.filter(message => message.characterId === String(mate.characterId) && /^\d+$/.test(message.sessionId))
          .slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        const cursor = Number(url.searchParams.get('cursor') ?? 0)
        const page = list.slice(cursor, cursor + size)
        const messages: ChatMessage[] = page.map(message => ({ requestId: message.requestId ?? message.id, sender: message.sender === 'user' ? 'USER' : 'MATE', content: message.text,
          inputType: message.sender === 'user' ? 'TEXT' : null, rating: message.sender === 'user' ? null : ratings.get(message.requestId ?? message.id) ?? null, createdAt: new Date(message.createdAt ?? 0).toISOString(), connectionId: Number(message.sessionId) }))
        return reply({ messages, nextCursor: cursor + size < list.length ? String(cursor + size) : null })
      }
      return error('NOT_FOUND', 404)
    }

    // ── Connections ──
    if (path === '/connections' && method === 'POST') {
      const mate = LOCAL_MATES.find(value => value.characterId === body.mateId)
      if (!mate) return error('MATE_NOT_FOUND', 404)
      if (store.data.onboardingRequired) return error('ONBOARDING_REQUIRED', 403)
      if (comingSoon(mate)) return error('MATE_COMING_SOON', 409)
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
      if (operation === 'heartbeat') { store.heartbeat(totals); return reply({ minorRemainingSeconds: minorRemaining(), serverTime: new Date().toISOString(), stageUp: null }) }
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
      // `tts: true` with 「메이트 음성」 on: the line comes with the test tone for 20 credits (text only when short).
      const voice = Boolean(face) && body.tts === true && settings.voiceEnabled && store.voiceLine()
      return reply({ requestId: body.requestId, characters: [{ characterId: activeMate.characterId, ...(face ? { content: face.line, expression: { name: face.expression, file: null } } : {}), fallback: false, audioBase64: voice ? LOCAL_VOICE_TONE_MP3 : null }],
        charged: voice ? 20 : 0, credits: body.tts === true ? store.credits() : null })
    }
    if (operation === 'messages/stream' || operation === 'messages') {
      if (body.characterId !== activeMate.characterId) return error('CHARACTER_NOT_IN_SESSION', 400)
      if (typeof body.requestId !== 'string' || typeof body.content !== 'string') return error('INVALID_REQUEST', 400)
      if (!body.content.trim()) return error('EMPTY_MESSAGE', 400)
      if (body.mode !== undefined && body.mode !== 'BASIC' && body.mode !== 'ADVANCED') return error('INVALID_REQUEST', 400)
      store.expireAttendance()
      const advanced = body.mode === 'ADVANCED' || body.mode === undefined && store.data.settings.advanced
      // 28 with `tts: true` and 「메이트 음성」 on: a voice turn (20 more), the test tone in pieces (20 never asks: no voice).
      const answer = store.reply(body.requestId, body.content, advanced, operation === 'messages/stream' && body.tts === true && settings.voiceEnabled)
      if (!answer) return error('CREDIT_INSUFFICIENT', 409, { credits: store.credits() })
      const result = { requestId: body.requestId, characterId: activeMate.characterId, content: answer.content, affinity: answer.affinity, emotion: '웃음',
        expression: LOCAL_REPLY_EXPRESSIONS[activeMate.mateId] ?? LOCAL_REPLY_EXPRESSIONS.chaerin, fallback: false, audioBase64: null, motion: null,
        mode: advanced ? 'ADVANCED' : 'BASIC', charged: answer.charged, credits: store.credits(), safety: null, background: null, voice: answer.voice }
      if (operation === 'messages') return reply(result)
      // As the server: voice pieces between the replies and after `done`, then `audio_end`.
      const pieces = answer.voice ? localVoicePieces(3) : []
      const stream = new ReadableStream<Uint8Array>({ async start(controller) {
        const encoder = new TextEncoder()
        const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        let seq = 0
        for (const content of [result.content.slice(0, 3), result.content]) {
          if (signal?.aborted) { controller.close(); return }
          send('reply', { content })
          if (seq < pieces.length - 1) send('audio', { seq, format: 'mp3', data: pieces[seq++] })
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        send('done', result)
        for (; seq < pieces.length; seq++) {
          await new Promise(resolve => setTimeout(resolve, 120))
          if (signal?.aborted) { controller.close(); return }
          send('audio', { seq, format: 'mp3', data: pieces[seq] })
        }
        if (pieces.length) send('audio_end', { chunks: pieces.length, complete: true })
        controller.close()
      } })
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
    }
    return error('NOT_FOUND', 404)
  }
}

type LocalNotification = { id: number; type: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: number }
function localNotifications(now: number): LocalNotification[] {
  const MINUTE = 60_000
  const fresh: Omit<LocalNotification, 'id'>[] = [
    { type: 'STAGE_UP', title: '채린과 한 걸음 가까워졌어요', body: '새 세계관이 열렸어요 · EP.03 도서관', link: '/mates/me', read: false, createdAt: now - 4 * MINUTE },
    { type: 'ATTENDANCE', title: '출석 보상 100 크레딧을 받았어요', body: null, link: '/credits', read: false, createdAt: now - 3 * 60 * MINUTE },
    { type: 'REFERRAL_REWARD', title: '친구가 첫 연결을 마쳤어요', body: '초대 보상 1,000 크레딧이 들어왔어요.', link: '/credits/invite', read: true, createdAt: now - 26 * 60 * MINUTE },
    { type: 'NOTICE', title: '바깥 링크는 열리지 않아요', body: '앱 밖 주소가 담긴 알림은 눌러도 이동하지 않아요.', link: 'https://example.com', read: true, createdAt: now - 3 * 24 * 60 * MINUTE },
  ]
  const older = Array.from({ length: 22 }, (_, index): Omit<LocalNotification, 'id'> => ({
    type: 'ATTENDANCE', title: '출석 보상 100 크레딧을 받았어요', body: null, link: '/credits', read: index > 1,
    createdAt: now - (4 + index) * 24 * 60 * MINUTE,
  }))
  const all = [...fresh, ...older]
  return all.map((item, index) => ({ ...item, id: all.length - index }))
}
