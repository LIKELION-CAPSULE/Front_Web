import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { DemoContext } from './demo-context'
import { demoReducer } from './reducer'
import type { DemoState, Memory } from './types'
import { api, ApiError } from '@/shared/api/client'
import { QueryCache } from '@/shared/api/query-cache'
import type { AffinityChange, AvatarsResponse, HomeResponse, MeResponse, MemoryList, MemoryResponse, LoginResponse, RoomDetail, StartResponse, ResumeResponse, ReportResponse, MessageResponse, TermsResponse } from '@/shared/api/types'
import { BackendContext } from '@/features/backend/backend-context'
import * as adapt from '@/features/backend/adapters'
import { getStudyRooms, registerReportRoom, setServerRooms } from '@/features/rooms/services/room-service'
import { flushSessionEvents, getSessionTotals, presenceKey, readSessionStorageItem } from '@/features/backend/use-session-sync'
import type { BackendContextValue } from '@/features/backend/backend-context'

type Meta = Pick<BackendContextValue, 'status' | 'error' | 'me' | 'home' | 'activeSummary' | 'avatars' | 'terms' | 'visuals' | 'affinities'>
const initialMeta: Meta = { status: 'loading', error: null, me: null, home: null, activeSummary: null, avatars: [], terms: [], visuals: null, affinities: {} }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했어요.'

/** Server-backed state. Legacy samples and local login flags are never loaded here. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [state, dispatch] = useReducer(demoReducer, undefined, adapt.emptyState)
  const [meta, setMeta] = useState<Meta>(initialMeta)
  const stateRef = useRef(state)
  const epoch = useRef(0)
  const bootstrap = useRef<Promise<void> | null>(null)
  const queries = useRef(new QueryCache())
  const userTask = useRef<{ generation: number; task: Promise<MeResponse> } | null>(null)
  const homeTask = useRef<{ generation: number; task: Promise<void> } | null>(null)
  const homeRevision = useRef(0)
  const memoryRevision = useRef(0)
  const pending = useRef(new Set<string>())
  const failedMessages = useRef(new Map<string, { content: string; inputType: string; requestId: string }>())
  const previousPath = useRef(pathname)
  useLayoutEffect(() => { stateRef.current = state }, [state])
  const patch = useCallback((value: Partial<DemoState>) => {
    stateRef.current = { ...stateRef.current, ...value }
    dispatch({ type: 'SERVER_SYNC', patch: value })
  }, [])
  useEffect(() => {
    const before = previousPath.current
    previousPath.current = pathname
    const active = stateRef.current.activeSession
    if (!active || before !== `/study/${active.id}` || pathname === before) return
    // Returning through browser history must use the same server recovery as a reload.
    queueMicrotask(() => {
      if (stateRef.current.activeSession?.id !== active.id) return
      const room = getStudyRooms().find(value => value.id === active.roomId)
      patch({ activeSession: null })
      setMeta(previous => ({ ...previous, visuals: null, activeSummary: {
        sessionId: Number(active.id), roomId: Number(active.roomId), roomName: room?.name,
        characterName: room?.characters.find(value => value.id === active.characterIds[0])?.name,
        startedAt: new Date(active.startedAt + (active.serverOffsetMs ?? 0)).toISOString(),
      } }))
    })
  }, [pathname, patch])
  const clear = useCallback(() => {
    epoch.current++
    queries.current = new QueryCache()
    homeRevision.current++
    memoryRevision.current++
    failedMessages.current.clear()
    api.setToken(null)
    setServerRooms([])
    patch(adapt.emptyState())
    setMeta(previous => ({ ...initialMeta, terms: previous.terms, status: 'ready' }))
  }, [patch])
  const loadAvatars = useCallback(() => queries.current.load('avatars', async () => {
    const value = await api.request<AvatarsResponse>('/avatars')
    if (!Array.isArray(value.avatars)) throw new ApiError('아바타 정보를 확인하지 못했어요.', 502)
    return value.avatars
  }, 300_000), [])
  const loadMemories = useCallback(() => queries.current.load('memories', async () => {
    const value = await api.request<MemoryList>('/me/memories?status=ALL')
    if (!Array.isArray(value.memories)) throw new ApiError('일정 정보를 확인하지 못했어요.', 502)
    return value.memories.map(adapt.memory)
  }, 10_000), [])
  const loadHome = useCallback(async () => {
    const generation = epoch.current
    const homeVersion = homeRevision.current
    const cache = queries.current
    const home = await cache.load('home', async () => {
      const value = await api.request<HomeResponse>('/home')
      if (!Array.isArray(value.rooms)) throw new ApiError('홈 정보를 확인하지 못했어요.', 502)
      return value
    }, 10_000)
    if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
    if (homeVersion !== homeRevision.current) return { home, rooms: [] }
    const rooms = await Promise.all(home.rooms!.map(value => {
      const roomId = adapt.id(value.id)
      return cache.load(`room:${roomId}`, async () => adapt.room(await api.request<RoomDetail>(`/rooms/${roomId}`)), 30_000)
    }))
    return { home, rooms }
  }, [])
  const loadUser = useCallback(() => {
    const generation = epoch.current
    if (userTask.current?.generation === generation) return userTask.current.task
    const task = (async () => {
      const revision = memoryRevision.current
      const homeVersion = homeRevision.current
      const me = await api.request<MeResponse>('/me')
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      const userProfile = adapt.profile(me)
      if (me.onboardingRequired) {
        const avatars = await loadAvatars()
        if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
        setServerRooms([])
        patch({ ...adapt.emptyState(), profile: userProfile })
        setMeta(previous => ({ ...previous, status: 'ready', error: null, me, avatars, home: null, activeSummary: null }))
        return me
      }
      const [{ home, rooms }, memories, avatars] = await Promise.all([loadHome(), loadMemories(), loadAvatars()])
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      if (homeVersion === homeRevision.current) setServerRooms(rooms)
      const previous = stateRef.current
      const sameUser = previous.profile.userId === me.userId
      patch({
        ...(sameUser ? {} : adapt.emptyState()), profile: { ...userProfile, avatarId: sameUser ? previous.profile.avatarId : undefined },
        ...(revision === memoryRevision.current ? { memories } : {}),
        ...(homeVersion === homeRevision.current ? { firstVisit: (home.todayStudySeconds ?? 0) === 0 && !home.activeSession } : {}),
      })
      setMeta(previousMeta => ({ ...previousMeta, status: 'ready', error: null, me, avatars,
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
  const reload = useCallback(async () => {
    const generation = epoch.current
    queries.current.invalidate('home')
    queries.current.invalidate('memories')
    setMeta(previous => ({ ...previous, status: 'loading', error: null }))
    try {
      if (stateRef.current.profile.loggedIn) await loadUser()
      else if (await api.refresh()) await loadUser()
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
    // Terms are used on authentication screens, not on every authenticated page reload.
    if (pathname !== '/login') return
    void api.request<TermsResponse>('/terms', { auth: false }).then(value => {
      if (Array.isArray(value.terms)) setMeta(previous => ({ ...previous, terms: value.terms! }))
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
    try { return await loadUser() } catch (error) {
      if (generation === epoch.current) setMeta(previous => ({ ...previous, status: 'error', error: errorMessage(error) }))
      throw error
    }
  }, [loadUser])
  const logout = useCallback(async () => {
    await api.waitForRefresh()
    await api.request('/auth/logout', { method: 'POST', auth: false })
    clear()
  }, [clear])
  const updateAffinity = useCallback((characterId: number, value?: AffinityChange) => {
    if (!value || !Number.isSafeInteger(characterId)) return
    setMeta(previous => ({ ...previous, affinities: { ...previous.affinities, [characterId]: value } }))
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
      method: 'POST', body: { type: { 시험: 'EXAM', 목표: 'GOAL', 약속: 'PROMISE' }[input.kind], title: input.title, dueDate: input.date, dueTime: input.time || null },
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
    const active = adapt.session(dto)
    active.presenceKnown = true
    active.initialAwaySeconds = 0
    if ('studySeconds' in dto) {
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
      setServerRooms([...getStudyRooms(), adapt.room(detail)])
    }
    patch({ activeSession: active, firstVisit: false })
    invalidateSessionQueries(active.roomId)
    setMeta(previous => ({ ...previous, visuals: dto, activeSummary: null }))
    try {
      localStorage.setItem(`capsule-session:${stateRef.current.profile.userId}:${active.id}`, JSON.stringify({ roomId: active.roomId, targetSeconds: active.targetSeconds, startedAt: active.startedAt }))
    } catch { /* Server report still works without browser storage. */ }
    return active
  }, [patch, invalidateSessionQueries])
  const startSession = useCallback(async (roomId: string, characterId: string, minutes: number) => {
    if (pending.current.has('start')) throw new ApiError('공부를 시작하고 있어요.', 409)
    pending.current.add('start')
    const generation = epoch.current
    try {
      const dto = await api.request<StartResponse>('/sessions', { method: 'POST', body: { roomId: adapt.numericId(roomId), characterId: adapt.numericId(characterId), targetMinutes: minutes } })
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      return await installSession(dto)
    } finally { pending.current.delete('start') }
  }, [installSession])
  const resumeSession = useCallback(async (sessionId: string) => {
    const generation = epoch.current
    await flushSessionEvents(sessionId)
    const dto = await api.request<ResumeResponse>(`/sessions/${adapt.numericId(sessionId)}/resume`, { method: 'POST' })
    if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
    return installSession(dto)
  }, [installSession])
  const finishSession = useCallback(async (options: { acceptUnknownPresence?: boolean } = {}) => {
    if (pending.current.has('end')) throw new ApiError('공부를 마무리하고 있어요.', 409)
    const current = stateRef.current.activeSession
    if (!current) throw new ApiError('진행 중인 공부가 없어요.', 400)
    // An unknown baseline already counts earlier study as away; ending then needs the user's explicit confirmation.
    if (current.presenceKnown === false && !options.acceptUnknownPresence) throw new ApiError('이전 자리 지킴 시간을 불러오지 못했어요. 처음 공부한 브라우저에서 이어가 주세요.', 409)
    const generation = epoch.current
    pending.current.add('end')
    try {
      await flushSessionEvents(current.id)
      const totals = getSessionTotals(current)
      const dto = await api.request<ReportResponse>(`/sessions/${adapt.numericId(current.id)}/end`, {
        method: 'POST', body: { studySeconds: totals.studySeconds, presentSeconds: totals.presentSeconds },
      })
      const record = adapt.report(dto, current.roomId, current.targetSeconds)
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      invalidateSessionQueries(current.roomId)
      patch({ activeSession: null, records: [record, ...stateRef.current.records.filter(value => value.id !== record.id)], latestRecordId: record.id })
      try { localStorage.removeItem(presenceKey(stateRef.current.profile.userId, current.id)) } catch { /* Nothing to clean up. */ }
      setMeta(previous => ({ ...previous, activeSummary: null, visuals: null }))
      return record
    } finally { pending.current.delete('end') }
  }, [patch, invalidateSessionQueries])
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
    try {
      const result = await api.request<MessageResponse>(`/sessions/${adapt.numericId(current.id)}/messages`, {
        method: 'POST', body: { requestId, characterId: adapt.numericId(characterId), content: content.trim(), inputType, tts: false },
      })
      if (result.requestId !== requestId || adapt.id(result.characterId) !== characterId || !result.content) throw new ApiError('답장 응답을확인하지 못했어요.', 502)
      if (generation !== epoch.current || stateRef.current.activeSession?.id !== current.id) return result
      const now = Date.now()
      patch({ messages: [...stateRef.current.messages,
        { id: `${requestId}:user`, requestId, sessionId: current.id, characterId, sender: 'user', text: content.trim(), voice: false, createdAt: now },
        { id: `${requestId}:reply`, requestId, sessionId: current.id, characterId, sender: 'character', text: result.content, voice: false, createdAt: now },
      ] })
      updateAffinity(result.characterId!, result.affinity)
      failedMessages.current.delete(key)
      return result
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
    try {
      const stored = JSON.parse(readSessionStorageItem(`capsule-session:${stateRef.current.profile.userId}:${sessionId}`) ?? 'null') as { targetSeconds?: number } | null
      if (typeof stored?.targetSeconds === 'number' && stored.targetSeconds > 0) target = stored.targetSeconds
    } catch { /* Do not invent a target missing from the report. */ }
    const record = adapt.report(dto, room.id, target)
    patch({ records: [...stateRef.current.records.filter(value => value.id !== record.id), record] })
  }, [patch])
  return (
    <DemoContext value={{ state, dispatch, storageAvailable: true }}>
      <BackendContext value={{ ...meta, reload, refreshHome, updateAffinity, authenticate, logout, forgetAuthentication: clear, saveProfile, createMemory, startSession, resumeSession, finishSession, sendMessage, loadReport }}>
        {children}
      </BackendContext>
    </DemoContext>
  )
}
