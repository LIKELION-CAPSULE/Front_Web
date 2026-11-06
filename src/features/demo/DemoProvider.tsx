import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { DemoContext } from './demo-context'
import { demoReducer } from './reducer'
import type { DemoState, FocusTotals, Memory, Message } from './types'
import { normalizeFocusTotals } from '@/features/session/focus'
import { api, ApiError } from '@/shared/api/client'
import { QueryCache } from '@/shared/api/query-cache'
import { removeAccountSnapshots } from '@/features/auth/account-storage'
import type { AffinityChange, AvatarsResponse, CreateMemoryRequest, HomeResponse, MeResponse, MemoryList, MemoryResponse, LoginResponse, RoomDetail, StartResponse, ResumeResponse, ReportResponse, TermsResponse } from '@/shared/api/types'
import { BackendContext } from '@/features/backend/backend-context'
import { streamMessage } from '@/features/backend/message-stream'
import { accountScope } from '@/features/backend/account-scope'
import * as adapt from '@/features/backend/adapters'
import { getStudyRooms, registerReportRoom, setServerRooms } from '@/features/rooms/services/room-service'
import { readSavedRooms, writeSavedRooms } from '@/features/rooms/saved-rooms'
import { flushSessionEvents, getSessionTotals, presenceKey, readSessionStorageItem } from '@/features/backend/use-session-sync'
import type { BackendContextValue } from '@/features/backend/backend-context'
import { Live2DStage } from '@/features/live2d/live2d-stage'
import { SessionModel, type SessionModelFactory, type SessionModelStage } from '@/features/live2d/session-model'

type Meta = Pick<BackendContextValue, 'status' | 'loadingStage' | 'error' | 'signedOutNotice' | 'me' | 'home' | 'activeSummary' | 'avatars' | 'terms' | 'visuals' | 'affinities'>
/**
 * Cache lifetimes. Changes made here invalidate their entries right away (ending a study clears home and the room,
 * saving a schedule clears memories), so these only bound how stale changes from elsewhere can get.
 */
const HOME_MAX_AGE = 60_000
const ROOM_MAX_AGE = 300_000
const AVATARS_MAX_AGE = 300_000
const initialMeta: Meta = { status: 'loading', loadingStage: 'auth', error: null, signedOutNotice: null, me: null, home: null, activeSummary: null, avatars: [], terms: [], visuals: null, affinities: {} }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했어요.'
const createLive2DStage: SessionModelFactory = (url, layout) => new Live2DStage(url, layout, new URL(import.meta.env.BASE_URL, location.href).href)

/** Server-backed state. Legacy samples and local login flags are never loaded here. */
export function DemoProvider({ children, modelFactory = createLive2DStage }: { children: ReactNode; modelFactory?: SessionModelFactory }) {
  const { pathname } = useLocation()
  const [state, dispatch] = useReducer(demoReducer, undefined, adapt.emptyState)
  const [meta, setMeta] = useState<Meta>(initialMeta)
  const [models] = useState(() => new SessionModel(modelFactory))
  const [live2dStage, setLive2dStage] = useState<SessionModelStage | null>(null)
  const pendingSession = useRef<StartResponse | ResumeResponse | null>(null)
  const modelEntry = useRef<{ pathname: string } | null>(null)
  const currentPath = useRef(pathname)
  const stateRef = useRef(state)
  const epoch = useRef(0)
  const bootstrap = useRef<Promise<void> | null>(null)
  const termsLoaded = useRef(false)
  const queries = useRef(new QueryCache())
  const userTask = useRef<{ generation: number; task: Promise<MeResponse> } | null>(null)
  const homeTask = useRef<{ generation: number; task: Promise<void> } | null>(null)
  const homeRevision = useRef(0)
  const memoryRevision = useRef(0)
  const pending = useRef(new Set<string>())
  const failedMessages = useRef(new Map<string, { content: string; inputType: string; requestId: string }>())
  const previousPath = useRef(pathname)
  useLayoutEffect(() => { stateRef.current = state }, [state])
  useLayoutEffect(() => { currentPath.current = pathname }, [pathname])
  useEffect(() => () => models.release(), [models])
  useEffect(() => {
    if (modelEntry.current && modelEntry.current.pathname !== pathname) models.release()
  }, [models, pathname])
  const releaseModel = useCallback(() => {
    models.release()
    setLive2dStage(null)
  }, [models])
  const patch = useCallback((value: Partial<DemoState>) => {
    stateRef.current = { ...stateRef.current, ...value }
    dispatch({ type: 'SERVER_SYNC', patch: value })
  }, [])
  useEffect(() => {
    if (state.profile.loggedIn && state.profile.userId) writeSavedRooms(state.profile.userId, state.savedRooms)
  }, [state.profile.loggedIn, state.profile.userId, state.savedRooms])
  useEffect(() => {
    const active = state.activeSession
    if (!active || !state.profile.userId) return
    try {
      localStorage.setItem(`capsule-session:${state.profile.userId}:${active.id}`, JSON.stringify({
        roomId: active.roomId, targetSeconds: active.targetSeconds, startedAt: active.startedAt,
        focus: normalizeFocusTotals(active.focus),
      }))
    } catch { /* Camera measurement still works in memory when storage is unavailable. */ }
  }, [state.activeSession, state.profile.userId])
  useEffect(() => {
    const before = previousPath.current
    previousPath.current = pathname
    const active = stateRef.current.activeSession
    if (!active || before !== `/study/${active.id}` || pathname === before) return
    // Returning through browser history must use the same server recovery as a reload.
    queueMicrotask(() => {
      if (stateRef.current.activeSession?.id !== active.id) return
      const room = getStudyRooms().find(value => value.id === active.roomId)
      releaseModel()
      patch({ activeSession: null })
      setMeta(previous => ({ ...previous, visuals: null, activeSummary: {
        sessionId: Number(active.id), roomId: Number(active.roomId), roomName: room?.name,
        characterName: room?.characters.find(value => value.id === active.characterIds[0])?.name,
        startedAt: new Date(active.startedAt + (active.serverOffsetMs ?? 0)).toISOString(),
      } }))
    })
  }, [pathname, patch, releaseModel])
  const clear = useCallback((signedOutNotice: Meta['signedOutNotice'] = null) => {
    epoch.current++
    pendingSession.current = null
    modelEntry.current = null
    releaseModel()
    queries.current = new QueryCache()
    homeRevision.current++
    memoryRevision.current++
    failedMessages.current.clear()
    api.setToken(null)
    setServerRooms([])
    patch(adapt.emptyState())
    setMeta(previous => ({ ...initialMeta, terms: previous.terms, status: 'ready', signedOutNotice }))
  }, [patch, releaseModel])
  const loadAvatars = useCallback(() => queries.current.load('avatars', async () => {
    const value = await api.request<AvatarsResponse>('/avatars')
    if (!Array.isArray(value.avatars)) throw new ApiError('아바타 정보를 확인하지 못했어요.', 502)
    return value.avatars
  }, AVATARS_MAX_AGE), [])
  const loadMemories = useCallback(() => queries.current.load('memories', async () => {
    const value = await api.request<MemoryList>('/me/memories?status=ALL')
    if (!Array.isArray(value.memories)) throw new ApiError('일정 정보를 확인하지 못했어요.', 502)
    return value.memories.map(adapt.memory)
  }, HOME_MAX_AGE), [])
  const loadHome = useCallback(async () => {
    const generation = epoch.current
    const homeVersion = homeRevision.current
    const cache = queries.current
    const home = await cache.load('home', async () => {
      const value = await api.request<HomeResponse>('/home')
      if (!Array.isArray(value.rooms)) throw new ApiError('홈 정보를 확인하지 못했어요.', 502)
      return value
    }, HOME_MAX_AGE)
    if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
    if (homeVersion !== homeRevision.current) return { home, rooms: [] }
    const rooms = await Promise.all(home.rooms!.map(value => {
      const roomId = adapt.id(value.id)
      return cache.load(`room:${roomId}`, async () => adapt.room(await api.request<RoomDetail>(`/rooms/${roomId}`)), ROOM_MAX_AGE)
    }))
    return { home, rooms }
  }, [])
  const loadUser = useCallback(() => {
    const generation = epoch.current
    if (userTask.current?.generation === generation) return userTask.current.task
    const task = (async () => {
      const revision = memoryRevision.current
      const homeVersion = homeRevision.current
      // Almost every user has finished onboarding, so home data starts with /me instead of waiting for it.
      // For a user still onboarding the result is simply not used.
      const homeData = Promise.all([loadHome(), loadMemories()])
      homeData.catch(() => { /* Reported below when it is used. */ })
      const me = await api.request<MeResponse>('/me')
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      const userProfile = adapt.profile(me)
      setMeta(previous => ({ ...previous, loadingStage: me.onboardingRequired ? 'onboarding' : 'page' }))
      if (me.onboardingRequired) {
        const avatars = await loadAvatars()
        if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
        setServerRooms([])
        patch({ ...adapt.emptyState(), profile: userProfile, savedRooms: readSavedRooms(me.userId) })
        setMeta(previous => ({ ...previous, status: 'ready', error: null, me, avatars, home: null, activeSummary: null }))
        return me
      }
      // Avatars are only needed by onboarding and the profile editor, which loads them itself.
      const [{ home, rooms }, memories] = await homeData
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      if (homeVersion === homeRevision.current) setServerRooms(rooms)
      const previous = stateRef.current
      const sameUser = previous.profile.userId === me.userId
      patch({
        ...(sameUser ? {} : adapt.emptyState()), profile: { ...userProfile, avatarId: sameUser ? previous.profile.avatarId : undefined },
        savedRooms: sameUser ? previous.savedRooms : readSavedRooms(me.userId),
        ...(revision === memoryRevision.current ? { memories } : {}),
        ...(homeVersion === homeRevision.current ? { firstVisit: (home.todayStudySeconds ?? 0) === 0 && !home.activeSession } : {}),
      })
      setMeta(previousMeta => ({ ...previousMeta, status: 'ready', error: null, me,
        ...(homeVersion === homeRevision.current ? { home, activeSummary: stateRef.current.activeSession ? null : me.activeSession ?? home.activeSession ?? null } : {}),
      }))
      return me
    })()
    const entry = { generation, task }
    userTask.current = entry
    const cleanup = () => { if (userTask.current === entry) userTask.current = null }
    void task.then(cleanup, cleanup)
    return task
  }, [patch, loadHome, loadMemories, loadAvatars])
  /** Avatar choices for the profile editor; onboarding has them already. */
  const ensureAvatars = useCallback(async () => {
    const generation = epoch.current
    const avatars = await loadAvatars()
    if (generation === epoch.current) setMeta(previous => previous.avatars === avatars ? previous : { ...previous, avatars })
  }, [loadAvatars])
  const reload = useCallback(async () => {
    const generation = epoch.current
    const account = accountScope(() => epoch.current)
    queries.current.invalidate('home')
    queries.current.invalidate('memories')
    setMeta(previous => ({ ...previous, status: 'loading', error: null, loadingStage: previous.status === 'loading' ? previous.loadingStage : 'auth' }))
    try {
      if (stateRef.current.profile.loggedIn) await loadUser()
      else if (await account.wait(api.refresh())) await loadUser()
      else setMeta(previous => ({ ...previous, status: 'ready' }))
    } catch (error) {
      if (generation !== epoch.current) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) clear()
      else setMeta(previous => ({ ...previous, status: 'error', error: errorMessage(error) }))
    }
  }, [clear, loadUser])
  useEffect(() => {
    api.onExpired(clear)
    setServerRooms([])
    if (!bootstrap.current) bootstrap.current = reload()
    return () => api.onExpired(null)
  }, [clear, reload])
  useEffect(() => {
    // Terms are used on authentication screens, not on every authenticated page reload; once loaded they are kept.
    if (pathname !== '/login' || termsLoaded.current) return
    void api.request<TermsResponse>('/terms', { auth: false }).then(value => {
      if (!Array.isArray(value.terms)) return
      termsLoaded.current = true
      setMeta(previous => ({ ...previous, terms: value.terms! }))
    }).catch(() => { /* Signup offers a separate terms retry. */ })
  }, [pathname])
  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 1000)
    return () => clearInterval(timer)
  }, [])
  const authenticate = useCallback(async (result: LoginResponse) => {
    if (!result.accessToken) throw new ApiError('로그인 응답을 확인하지 못했어요.', 502)
    epoch.current++
    queries.current = new QueryCache()
    homeRevision.current++
    memoryRevision.current++
    api.setToken(result.accessToken)
    const generation = epoch.current
    setMeta(previous => ({ ...previous, status: 'loading', error: null, loadingStage: 'auth' }))
    try { return await loadUser() } catch (error) {
      if (generation === epoch.current) setMeta(previous => ({ ...previous, status: 'error', error: errorMessage(error) }))
      throw error
    }
  }, [loadUser])
  const logout = useCallback(async () => {
    const account = accountScope(() => epoch.current)
    await account.wait(api.waitForRefresh())
    await account.wait(api.request('/auth/logout', { method: 'POST', auth: false }))
    clear()
  }, [clear])
  const withdrawAccount = useCallback(async () => {
    if (pending.current.has('withdraw')) throw new ApiError('회원탈퇴를 처리하고 있어요.', 409)
    const generation = epoch.current
    const userId = stateRef.current.profile.userId
    if (!stateRef.current.profile.loggedIn || !userId) throw new ApiError('로그인이 필요해요.', 401)
    pending.current.add('withdraw')
    try {
      await api.waitForRefresh()
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      await api.request('/me', { method: 'DELETE' })
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      for (const getStorage of [() => localStorage, () => sessionStorage]) {
        try { removeAccountSnapshots(getStorage(), userId) } catch { /* In-memory account data is still cleared below. */ }
      }
      try { sessionStorage.removeItem('capsule-login-provider'); sessionStorage.removeItem('capsule-kakao') } catch { /* Storage may be unavailable. */ }
      clear('account-withdrawn')
    } finally { pending.current.delete('withdraw') }
  }, [clear])
  const updateAffinity = useCallback((characterId: number, value?: AffinityChange) => {
    if (!value || !Number.isSafeInteger(characterId)) return
    setMeta(previous => ({ ...previous, affinities: { ...previous.affinities, [characterId]: { ...previous.affinities[characterId], ...value } } }))
  }, [])
  const refreshHome = useCallback(async () => {
    if (!stateRef.current.profile.loggedIn || !stateRef.current.profile.onboarded) return
    const generation = epoch.current
    if (homeTask.current?.generation === generation) return homeTask.current.task
    const revision = memoryRevision.current
    const homeVersion = homeRevision.current
    const task = (async () => {
      const [{ home, rooms }, memories] = await Promise.all([loadHome(), loadMemories()])
      if (generation !== epoch.current || homeVersion !== homeRevision.current) return
      setServerRooms(rooms)
      patch({ ...(revision === memoryRevision.current ? { memories } : {}), firstVisit: (home.todayStudySeconds ?? 0) === 0 && !home.activeSession })
      setMeta(previous => ({ ...previous, home, activeSummary: stateRef.current.activeSession ? null : home.activeSession ?? null }))
    })()
    const entry = { generation, task }
    homeTask.current = entry
    try { await task } finally { if (homeTask.current === entry) homeTask.current = null }
  }, [patch, loadHome, loadMemories])
  const invalidateSessionQueries = useCallback((roomId: string) => {
    homeRevision.current++
    homeTask.current = null
    queries.current.invalidate('home')
    queries.current.invalidate(`room:${roomId}`)
  }, [])
  const saveProfile = useCallback(async (nickname: string, avatarId?: number) => {
    const generation = epoch.current
    const me = await api.request<MeResponse>('/me', { method: 'PATCH', body: { nickname: nickname.trim(), ...(avatarId === undefined ? {} : { avatarId }) } })
    if (generation !== epoch.current) return
    patch({ profile: { ...adapt.profile(me, stateRef.current.profile), ...(avatarId === undefined ? {} : { avatarId }) } })
    setMeta(previous => ({ ...previous, me }))
  }, [patch])
  const createMemory = useCallback(async (input: Omit<Memory, 'id'>) => {
    const generation = epoch.current
    const value = await api.request<MemoryResponse>('/me/memories', {
      method: 'POST', body: {
        type: { 시험: 'EXAM', 목표: 'GOAL', 약속: 'PROMISE' }[input.kind], title: input.title,
        ...(input.date ? { dueDate: input.date } : {}), ...(input.time ? { dueTime: input.time } : {}),
      } satisfies CreateMemoryRequest,
    })
    const saved = adapt.memory(value)
    if (generation === epoch.current) {
      memoryRevision.current++
      queries.current.invalidate('memories')
      patch({ memories: [...stateRef.current.memories.filter(item => item.id !== saved.id), saved] })
    }
    return saved
  }, [patch])
  const installSession = useCallback(async (dto: StartResponse | ResumeResponse) => {
    const generation = epoch.current
    const entry = { pathname: currentPath.current }
    modelEntry.current = entry
    try {
      const active = adapt.session(dto)
      active.presenceKnown = true
      active.initialAwaySeconds = 0
      if ('studySeconds' in dto) {
        try {
          const stored = JSON.parse(readSessionStorageItem(`capsule-session:${stateRef.current.profile.userId}:${active.id}`) ?? 'null') as { focus?: FocusTotals } | null
          active.focus = normalizeFocusTotals(stored?.focus)
        } catch { /* Only newly measured camera time is used when no snapshot can be restored. */ }
        const extended = dto as ResumeResponse & { presentSeconds?: number }
        if (typeof extended.presentSeconds === 'number') {
          active.initialAwaySeconds = Math.max(0, active.studySeconds - extended.presentSeconds)
        } else {
          active.presenceKnown = false
          // Without a saved baseline, earlier study counts as away so a missing record never turns absences into presence.
          active.initialAwaySeconds = active.studySeconds
          try {
            // localStorage (not sessionStorage) so a new tab or a browser restart on this device keeps the baseline.
            const saved = JSON.parse(readSessionStorageItem(presenceKey(stateRef.current.profile.userId, active.id)) ?? 'null') as { studySeconds: number; presentSeconds: number; known?: boolean } | null
            if (saved && saved.known !== false && Number.isFinite(saved.studySeconds) && Number.isFinite(saved.presentSeconds)) {
              active.presenceKnown = true
              active.initialAwaySeconds = Math.max(0, Math.min(active.studySeconds, saved.studySeconds - saved.presentSeconds))
            }
          } catch { /* The conservative baseline above stays. */ }
        }
      }
      if (!getStudyRooms().some(value => value.id === active.roomId)) {
        const detail = await api.request<RoomDetail>(`/rooms/${active.roomId}`)
        if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
        setServerRooms([...getStudyRooms(), adapt.room(detail)])
      }
      if (generation !== epoch.current || currentPath.current !== entry.pathname || modelEntry.current !== entry) throw new ApiError('공부 준비가 취소됐어요.', 409)
      const stage = await models.prepare(dto.character)
      if (generation !== epoch.current || currentPath.current !== entry.pathname || modelEntry.current !== entry) {
        if (modelEntry.current === entry) releaseModel()
        throw new ApiError('공부 준비가 취소됐어요.', 409)
      }
      setLive2dStage(stage)
      pendingSession.current = null
      patch({ activeSession: active, firstVisit: false })
      invalidateSessionQueries(active.roomId)
      setMeta(previous => ({ ...previous, visuals: dto, activeSummary: null }))
      try {
        localStorage.setItem(`capsule-session:${stateRef.current.profile.userId}:${active.id}`, JSON.stringify({ roomId: active.roomId, targetSeconds: active.targetSeconds, startedAt: active.startedAt, focus: active.focus }))
      } catch { /* Server report still works without browser storage. */ }
      return active
    } finally { if (modelEntry.current === entry) modelEntry.current = null }
  }, [patch, invalidateSessionQueries, models, releaseModel])
  const startSession = useCallback(async (roomId: string, characterId: string, minutes: number) => {
    if (pending.current.has('start')) throw new ApiError('공부를 시작하고 있어요.', 409)
    pending.current.add('start')
    const generation = epoch.current
    const entryPath = currentPath.current
    try {
      const cached = pendingSession.current
      const dto = cached?.room?.id === adapt.numericId(roomId) && cached.character?.id === adapt.numericId(characterId)
        ? await api.request<ResumeResponse>(`/sessions/${adapt.id(cached.sessionId)}/resume`, { method: 'POST' })
        : await api.request<StartResponse>('/sessions', { method: 'POST', body: { roomId: adapt.numericId(roomId), characterId: adapt.numericId(characterId), targetMinutes: minutes } })
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      pendingSession.current = dto
      // A late start response can still be resumed, but must not load a model on the screen the user left for.
      if (currentPath.current !== entryPath) throw new ApiError('공부 준비가 취소됐어요.', 409)
      return await installSession(dto)
    } finally { pending.current.delete('start') }
  }, [installSession])
  const resumeSession = useCallback(async (sessionId: string) => {
    const account = accountScope(() => epoch.current)
    await account.wait(flushSessionEvents(sessionId))
    const dto = await account.wait(api.request<ResumeResponse>(`/sessions/${adapt.numericId(sessionId)}/resume`, { method: 'POST' }))
    return installSession(dto)
  }, [installSession])
  const finishSession = useCallback(async (options: { acceptUnknownPresence?: boolean } = {}) => {
    if (pending.current.has('end')) throw new ApiError('공부를 마무리하고 있어요.', 409)
    const current = stateRef.current.activeSession
    if (!current) throw new ApiError('진행 중인 공부가 없어요.', 400)
    // An unknown baseline already counts earlier study as away; ending then needs the user's explicit confirmation.
    if (current.presenceKnown === false && !options.acceptUnknownPresence) throw new ApiError('이전 자리 지킴 시간을 불러오지 못했어요. 처음 공부한 브라우저에서 이어가 주세요.', 409)
    const account = accountScope(() => epoch.current)
    pending.current.add('end')
    try {
      await account.wait(flushSessionEvents(current.id))
      const totals = getSessionTotals(current)
      const dto = await account.wait(api.request<ReportResponse>(`/sessions/${adapt.numericId(current.id)}/end`, {
        method: 'POST', body: { studySeconds: totals.studySeconds, presentSeconds: totals.presentSeconds },
      }))
      const record = adapt.report(dto, current.roomId, current.targetSeconds)
      record.cameraFocus = normalizeFocusTotals(stateRef.current.activeSession?.focus ?? current.focus)
      try {
        localStorage.setItem(`capsule-session:${stateRef.current.profile.userId}:${current.id}`, JSON.stringify({
          roomId: current.roomId, targetSeconds: current.targetSeconds, startedAt: current.startedAt, focus: record.cameraFocus,
        }))
      } catch { /* The current report retains its camera measurement in memory. */ }
      invalidateSessionQueries(current.roomId)
      patch({ activeSession: null, records: [record, ...stateRef.current.records.filter(value => value.id !== record.id)], latestRecordId: record.id })
      releaseModel()
      try { localStorage.removeItem(presenceKey(stateRef.current.profile.userId, current.id)) } catch { /* Nothing to clean up. */ }
      setMeta(previous => ({ ...previous, activeSummary: null, visuals: null }))
      return record
    } finally { pending.current.delete('end') }
  }, [patch, invalidateSessionQueries, releaseModel])
  const sendMessage = useCallback(async (characterId: string, content: string, inputType: 'TEXT' | 'QUICK' = 'TEXT') => {
    const current = stateRef.current.activeSession
    if (!current) throw new ApiError('진행 중인 공부가 없어요.', 400)
    if (!content.trim() || content.length > 300) throw new ApiError('메시지는 1~300자로 입력해 주세요.', 400)
    const key = `message:${current.id}:${characterId}`
    if (pending.current.has(key)) throw new ApiError('답장을 기다려 주세요.', 409)
    const generation = epoch.current
    const previous = failedMessages.current.get(key)
    const requestId = previous?.content === content.trim() && previous.inputType === inputType ? previous.requestId : crypto.randomUUID()
    failedMessages.current.set(key, { content: content.trim(), inputType, requestId })
    pending.current.add(key)
    const live = () => generation === epoch.current && stateRef.current.activeSession?.id === current.id
    // Replaces a message in place (keeping its position) or appends it.
    const upsert = (message: Message) => {
      const list = stateRef.current.messages
      patch({ messages: list.some(value => value.id === message.id) ? list.map(value => value.id === message.id ? message : value) : [...list, message] })
    }
    const reply = (text: string, createdAt = Date.now()): Message => ({
      id: `${requestId}:reply`, requestId, sessionId: current.id, characterId, sender: 'character', text, voice: false,
      createdAt: stateRef.current.messages.find(value => value.id === `${requestId}:reply`)?.createdAt ?? createdAt,
    })
    // The user's line shows right away so streamed reply text appears below it.
    upsert({ id: `${requestId}:user`, requestId, sessionId: current.id, characterId, sender: 'user', text: content.trim(), voice: false, createdAt: Date.now() })
    try {
      const result = await streamMessage(api, adapt.numericId(current.id), { requestId, characterId: adapt.numericId(characterId), content: content.trim(), inputType, tts: false }, {
        onReply: text => { if (live()) upsert(reply(text)) },
        alive: live,
      })
      if (result.requestId !== requestId || adapt.id(result.characterId) !== characterId || !result.content) throw new ApiError('답장 응답을 확인하지 못했어요.', 502)
      if (!live()) return result
      // `done` holds the final text; it also creates the bubble when no `reply` came (fallback line, or a resend that
      // waited for the original request and gets its stored reply with no expression and affinity delta 0).
      upsert(reply(result.content))
      updateAffinity(result.characterId!, result.affinity)
      failedMessages.current.delete(key)
      return result
    } catch (error) {
      // As with API 20, a failed send leaves no messages; sending the same text again reuses the requestId.
      if (live()) patch({ messages: stateRef.current.messages.filter(value => value.requestId !== requestId) })
      throw error
    } finally { pending.current.delete(key) }
  }, [patch, updateAffinity])
  const loadReport = useCallback(async (sessionId: string) => {
    if (stateRef.current.records.some(value => value.id === sessionId && value.serverReport)) return
    const generation = epoch.current
    const dto = await api.request<ReportResponse>(`/sessions/${adapt.numericId(sessionId)}/report`)
    if (generation !== epoch.current) return
    let room = getStudyRooms().find(value => value.name === dto.roomName)
    if (!room) {
      room = { id: `report-${sessionId}`, serverRoom: true, name: dto.roomName ?? '', description: '', introduction: '', contentStatus: 'preview', characters: [{ id: adapt.id(dto.character?.id), name: dto.character?.name ?? '', description: '', serverCharacter: true }] }
      registerReportRoom(room)
    }
    let target: number | undefined
    let cameraFocus: FocusTotals | undefined
    try {
      const stored = JSON.parse(readSessionStorageItem(`capsule-session:${stateRef.current.profile.userId}:${sessionId}`) ?? 'null') as { targetSeconds?: number; focus?: FocusTotals } | null
      if (typeof stored?.targetSeconds === 'number' && stored.targetSeconds > 0) target = stored.targetSeconds
      if (stored?.focus) cameraFocus = normalizeFocusTotals(stored.focus)
    } catch { /* Do not invent a target missing from the report. */ }
    const record = adapt.report(dto, room.id, target)
    record.cameraFocus = cameraFocus
    patch({ records: [...stateRef.current.records.filter(value => value.id !== record.id), record] })
  }, [patch])
  return (
    <DemoContext value={{ state, dispatch, storageAvailable: true }}>
      <BackendContext value={{ ...meta, live2dStage, reload, refreshHome, ensureAvatars, updateAffinity, authenticate, logout, withdrawAccount, forgetAuthentication: clear, saveProfile, createMemory, startSession, resumeSession, finishSession, sendMessage, loadReport }}>
        {children}
      </BackendContext>
    </DemoContext>
  )
}
