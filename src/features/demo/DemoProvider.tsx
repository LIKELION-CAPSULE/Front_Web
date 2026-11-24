import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { DemoContext } from './demo-context'
import { betaReducer, type ConnectionReducer } from '@/features/backend/beta-reducer'
import { readConnectionCache, serverMessages, serverRecords, writeConnectionCache } from '@/features/backend/connection-cache'
import type { DemoState, FocusTotals, Message, TierId } from './types'
import { normalizeFocusTotals } from '@/features/session/focus'
import { api, ApiError } from '@/shared/api/client'
import { QueryCache } from '@/shared/api/query-cache'
import { removeAccountSnapshots } from '@/features/auth/account-storage'
import type { AffinityChange, AvatarsResponse, HomeResponse, MeResponse, LoginResponse, RoomDetail, StartRequest, StartResponse, ResumeResponse, EndRequest, ReportResponse, TermsResponse } from '@/shared/api/types'
import { isSessionTargetMinutes, LEGACY_SESSION_TARGET_MINUTES } from '@/shared/api/constraints'
import { BackendContext } from '@/features/backend/backend-context'
import { streamMessage } from '@/features/backend/message-stream'
import { accountScope } from '@/features/backend/account-scope'
import { EndedConnectionError } from '@/features/backend/ended-connection'
import * as adapt from '@/features/backend/adapters'
import { getStudyRooms, registerReportRoom, setServerRooms } from '@/features/rooms/services/room-service'
import { flushSessionEvents, getSessionTotals, presenceKey, readSessionStorageItem } from '@/features/backend/use-session-sync'
import type { BackendContextValue } from '@/features/backend/backend-context'
import { Live2DStage } from '@/features/live2d/live2d-stage'
import { SessionModel, type AlivingStageFactory, type SessionModelFactory, type SessionModelStage } from '@/features/live2d/session-model'
import { AlivingSessionStage } from '@/features/mate-render/AlivingSessionStage'
import { availableMates, mateByName } from '@/features/mates/catalog'
import { isSessionSurface } from '@/features/mates/session-surface'
import type { BetaAccountPort, BetaAccountResult, BetaOnboardingInput, BetaProfileInput, BetaSignupInput } from '@/features/auth/beta-account'
import { checkedAccountDetails } from '@/features/auth/beta-account'
import { birthDateError } from '@/features/auth/birth-date'
import { nicknameError } from '@/features/profile/profile-input'
import type { MateContentPort } from '@/features/mates/mate-contract'
import { checkedMateDetail, checkMateReset, isMateResetConflict } from '@/features/mates/mate-contract'
import type { BetaFeaturePort, BetaFeatureSnapshot } from '@/features/backend/beta-feature-port'

type Meta = Pick<BackendContextValue, 'status' | 'loadingStage' | 'error' | 'signedOutNotice' | 'me' | 'accountDetails' | 'home' | 'homeContentVersion' | 'mateDetails' | 'mateContentVersion' | 'wallet' | 'invitation' | 'mateUnlocks' | 'mateRelationStats' | 'redeemInvitation' | 'activeSummary' | 'avatars' | 'terms' | 'visuals' | 'affinities'>
/**
 * Local mutations invalidate the affected server queries immediately. These limits bound
 * how long data changed on another device can remain cached here.
 */
const HOME_MAX_AGE = 60_000
const ROOM_MAX_AGE = 300_000
const AVATARS_MAX_AGE = 300_000
const initialMeta: Meta = { status: 'loading', loadingStage: 'auth', error: null, signedOutNotice: null, me: null, accountDetails: null, home: null, homeContentVersion: 0, mateDetails: {}, mateContentVersion: 0, wallet: null, invitation: null, mateUnlocks: undefined, mateRelationStats: undefined, redeemInvitation: null, activeSummary: null, avatars: [], terms: [], visuals: null, affinities: {} }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했어요.'
const createLive2DStage: SessionModelFactory = (url, layout) => new Live2DStage(url, layout, new URL(import.meta.env.BASE_URL, location.href).href)
/** v2 (Aliving2D) session models; engine scripts run only from this page's origin or the API origin. */
const createAlivingStage: AlivingStageFactory = source => new AlivingSessionStage(source)
const engineAllowlist = () => ({ pageOrigin: location.origin, apiBaseUrl: import.meta.env.VITE_API_BASE_URL })

/** Cached reports may belong to rooms no longer returned by /home. */
function registerCachedReportRooms(records: DemoState['records']) {
  for (const record of records) {
    if (!record.serverReport || getStudyRooms().some(room => room.id === record.roomId)) continue
    registerReportRoom({ id: record.roomId, serverRoom: true, name: record.roomName ?? record.serverReport.roomName ?? '',
      description: '', introduction: '', contentStatus: 'preview', characters: [{ id: record.characterIds[0]!,
        name: record.characterName ?? record.serverReport.character?.name ?? '', description: '', serverCharacter: true }],
    })
  }
}

/** Server-backed beta state. Optional UI ports inject isolated local previews; legacy demo saves are never loaded. */
export function DemoProvider({ children, modelFactory = createLive2DStage, reducer = betaReducer, accountPort, matePort, featurePort }: { children: ReactNode; modelFactory?: SessionModelFactory; reducer?: ConnectionReducer; accountPort?: BetaAccountPort; matePort?: MateContentPort; featurePort?: BetaFeaturePort }) {
  const { pathname } = useLocation()
  const [state, reducerDispatch] = useReducer(reducer, undefined, adapt.emptyState)
  const [meta, setMeta] = useState<Meta>(initialMeta)
  const [betaSettings, setBetaSettings] = useState<BetaFeatureSnapshot['settings']>()
  const [models] = useState(() => new SessionModel(modelFactory, undefined, { createAliving: createAlivingStage, allowlist: engineAllowlist }))
  const [live2dStage, setLive2dStage] = useState<SessionModelStage | null>(null)
  const pendingSession = useRef<StartResponse | ResumeResponse | null>(null)
  const modelEntry = useRef<{ pathname: string } | null>(null)
  const currentPath = useRef(pathname)
  const stateRef = useRef(state)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const dispatch = useCallback((action: Parameters<ConnectionReducer>[1]) => {
    stateRef.current = reducer(stateRef.current, action)
    reducerDispatch(action)
  }, [reducer])
  const epoch = useRef(0)
  const bootstrap = useRef<Promise<void> | null>(null)
  const termsLoaded = useRef(false)
  const queries = useRef(new QueryCache())
  const userTask = useRef<{ generation: number; task: Promise<MeResponse> } | null>(null)
  const homeTask = useRef<{ generation: number; task: Promise<void> } | null>(null)
  const homeRevision = useRef(0)
  const pending = useRef(new Set<string>())
  const failedMessages = useRef(new Map<string, { content: string; inputType: string; requestId: string }>())
  const mateVersions = useRef(new Map<string, number>())
  const mateReads = useRef(new Map<string, number>())
  const resettingMates = useRef(new Set<string>())
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
    dispatch({ type: 'SERVER_SYNC', patch: value })
  }, [dispatch])
  useEffect(() => {
    if (!featurePort || !state.profile.loggedIn || !state.profile.userId) return
    const userId = state.profile.userId
    let current = true
    const sync = () => {
      if (!current) return
      const snapshot = featurePort.read(userId)
      setMeta(previous => ({ ...previous, wallet: snapshot.wallet, invitation: snapshot.invitation, mateUnlocks: snapshot.mateUnlocks, mateRelationStats: snapshot.mateRelationStats, affinities: snapshot.affinities, redeemInvitation: featurePort.redeemInvitation }))
      setBetaSettings(snapshot.settings)
    }
    const unsubscribe = featurePort.subscribe(sync)
    queueMicrotask(sync)
    return () => { current = false; unsubscribe() }
  }, [featurePort, state.profile.loggedIn, state.profile.userId])
  useEffect(() => {
    if (!state.profile.loggedIn || !state.profile.userId) return
    try { setStorageAvailable(writeConnectionCache(localStorage, state.profile.userId, { records: state.records, messages: state.messages, latestRecordId: state.latestRecordId })) }
    catch { setStorageAvailable(false) }
  }, [state.profile.loggedIn, state.profile.userId, state.records, state.messages, state.latestRecordId])
  useEffect(() => {
    const active = state.activeSession
    if (!active || !state.profile.userId) return
    try {
      localStorage.setItem(`capsule-session:${state.profile.userId}:${active.id}`, JSON.stringify({
        roomId: active.roomId, startedAt: active.startedAt,
        focus: normalizeFocusTotals(active.focus), mateId: active.mateId,
      }))
    } catch { /* Camera measurement still works in memory when storage is unavailable. */ }
  }, [state.activeSession, state.profile.userId])
  useEffect(() => {
    const before = previousPath.current
    previousPath.current = pathname
    const active = stateRef.current.activeSession
    if (!active || !isSessionSurface(before, active) || pathname === before) return
    if (!active.serverSession) { dispatch({ type: 'PAUSE_SESSION', now: Date.now() }); return }
    // Returning through browser history must use the same server recovery as a reload.
    queueMicrotask(() => {
      if (stateRef.current.activeSession?.id !== active.id) return
      const room = getStudyRooms().find(value => value.id === active.roomId)
      releaseModel()
      patch({ activeSession: null, messages: stateRef.current.messages.filter(message => message.sessionId !== active.id || message.delivery !== 'pending') })
      setMeta(previous => ({ ...previous, visuals: null, activeSummary: {
        sessionId: Number(active.id), roomId: Number(active.roomId), roomName: room?.name,
        characterName: room?.characters.find(value => value.id === active.characterIds[0])?.name,
        startedAt: new Date(active.startedAt + (active.serverOffsetMs ?? 0)).toISOString(),
      } }))
    })
  }, [pathname, patch, releaseModel, dispatch])
  const clear = useCallback((signedOutNotice: Meta['signedOutNotice'] = null) => {
    epoch.current++
    pendingSession.current = null
    modelEntry.current = null
    releaseModel()
    queries.current = new QueryCache()
    homeRevision.current++
    pending.current = new Set()
    failedMessages.current.clear()
    mateVersions.current.clear()
    mateReads.current.clear()
    resettingMates.current = new Set()
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
      const homeVersion = homeRevision.current
      // Almost every user has finished onboarding, so home data starts with /me instead of waiting for it.
      // For a user still onboarding the result is simply not used.
      const homeData = loadHome()
      homeData.catch(() => { /* Reported below when it is used. */ })
      const me = await api.request<MeResponse>('/me')
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      const userProfile = adapt.profile(me)
      const accountDetails = accountPort ? checkedAccountDetails(await accountPort.read(me.userId!)) : null
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      setMeta(previous => ({ ...previous, loadingStage: me.onboardingRequired ? 'onboarding' : 'page' }))
      if (me.onboardingRequired) {
        const avatars = await loadAvatars()
        if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
        setServerRooms([])
        let cache = { records: [] as DemoState['records'], messages: [] as DemoState['messages'], latestRecordId: null as string | null }
        try { cache = readConnectionCache(localStorage, me.userId!) } catch { /* No local cache. */ }
        patch({ ...adapt.emptyState(), ...cache, profile: userProfile })
        setMeta(previous => ({ ...previous, status: 'ready', error: null, me, accountDetails, avatars, home: null, activeSummary: null }))
        return me
      }
      // Avatars are only needed by onboarding and the profile editor, which loads them itself.
      const { home, rooms } = await homeData
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      if (homeVersion === homeRevision.current) setServerRooms(rooms)
      const previous = stateRef.current
      const sameUser = previous.profile.userId === me.userId
      let cache = { records: [] as DemoState['records'], messages: [] as DemoState['messages'], latestRecordId: null as string | null }
      if (sameUser) cache = { records: serverRecords(previous.records), messages: serverMessages(previous.messages), latestRecordId: previous.latestRecordId }
      else try { cache = readConnectionCache(localStorage, me.userId!) } catch { /* No local cache. */ }
      if (featurePort) {
        const snapshot = featurePort.read(me.userId!)
        cache = { records: snapshot.records.map(record => cache.records.find(old => old.id === record.id) ?? record), messages: snapshot.messages,
          latestRecordId: cache.latestRecordId ?? snapshot.records[0]?.id ?? null }
      }
      registerCachedReportRooms(cache.records)
      patch({
        ...(!sameUser ? adapt.emptyState() : {}), ...cache,
        profile: { ...userProfile, avatarId: userProfile.avatarId ?? (sameUser ? previous.profile.avatarId : undefined) },
        savedRooms: [], credits: 0, ledger: [], pass: null, gifts: [], affection: {},
        memories: [],
        ...(homeVersion === homeRevision.current ? { firstVisit: (home.todayStudySeconds ?? 0) === 0 && !home.activeSession } : {}),
      })
      setMeta(previousMeta => ({ ...previousMeta, status: 'ready', error: null, me, accountDetails,
        ...(homeVersion === homeRevision.current ? { home, activeSummary: stateRef.current.activeSession ? null : me.activeSession ?? home.activeSession ?? null } : {}),
      }))
      return me
    })()
    const entry = { generation, task }
    userTask.current = entry
    const cleanup = () => { if (userTask.current === entry) userTask.current = null }
    void task.then(cleanup, cleanup)
    return task
  }, [patch, loadHome, loadAvatars, accountPort, featurePort])
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
  const authenticate = useCallback(async (result: LoginResponse) => {
    if (!result.accessToken) throw new ApiError('로그인 응답을 확인하지 못했어요.', 502)
    // A failed second login must never leave the previous account's profile or history on screen.
    clear()
    api.setToken(result.accessToken)
    const generation = epoch.current
    setMeta(previous => ({ ...previous, status: 'loading', error: null, loadingStage: 'auth' }))
    try { return await loadUser() } catch (error) {
      if (generation === epoch.current) setMeta(previous => ({ ...previous, status: 'error', error: errorMessage(error) }))
      throw error
    }
  }, [clear, loadUser])
  const logout = useCallback(async () => {
    const account = accountScope(() => epoch.current)
    await account.wait(api.waitForRefresh())
    await account.wait(api.request('/auth/logout', { method: 'POST', auth: false }))
    clear()
  }, [clear])
  const withdrawAccount = useCallback(async () => {
    const operations = pending.current
    if (operations.has('withdraw')) throw new ApiError('회원탈퇴를 처리하고 있어요.', 409)
    const generation = epoch.current
    const userId = stateRef.current.profile.userId
    if (!stateRef.current.profile.loggedIn || !userId) throw new ApiError('로그인이 필요해요.', 401)
    operations.add('withdraw')
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
    } finally { operations.delete('withdraw') }
  }, [clear])
  const updateAffinity = useCallback((characterId: number, value?: AffinityChange) => {
    if (!value || !Number.isSafeInteger(characterId)) return
    setMeta(previous => ({ ...previous, affinities: { ...previous.affinities, [characterId]: { ...previous.affinities[characterId], ...value } } }))
  }, [])
  const refreshHome = useCallback(async () => {
    if (!stateRef.current.profile.loggedIn || !stateRef.current.profile.onboarded) return
    const generation = epoch.current
    if (homeTask.current?.generation === generation) return homeTask.current.task
    const homeVersion = homeRevision.current
    const task = (async () => {
      const { home, rooms } = await loadHome()
      if (generation !== epoch.current || homeVersion !== homeRevision.current) return
      setServerRooms(rooms)
      registerCachedReportRooms(stateRef.current.records)
      patch({ memories: [], firstVisit: (home.todayStudySeconds ?? 0) === 0 && !home.activeSession })
      setMeta(previous => ({ ...previous, home, activeSummary: stateRef.current.activeSession ? null : home.activeSession ?? null }))
    })()
    const entry = { generation, task }
    homeTask.current = entry
    try { await task } finally { if (homeTask.current === entry) homeTask.current = null }
  }, [patch, loadHome])
  const invalidateSessionQueries = useCallback((roomId: string) => {
    homeRevision.current++
    homeTask.current = null
    queries.current.invalidate('home')
    queries.current.invalidate(`room:${roomId}`)
    setMeta(previous => ({ ...previous, homeContentVersion: previous.homeContentVersion + 1 }))
  }, [])
  const acknowledgeEndedSession = useCallback((sessionId: string, expectedUserId: number) => {
    if (!/^\d+$/.test(sessionId) || !Number.isSafeInteger(Number(sessionId)) || Number(sessionId) <= 0) return false
    const current = stateRef.current.activeSession
    const summary = meta.activeSummary
    const cached = pendingSession.current
    if (!stateRef.current.profile.loggedIn || stateRef.current.profile.userId !== expectedUserId) return false
    const active = current?.serverSession && current.id === sessionId ? current : null
    const summaryMatches = summary && String(summary.sessionId) === sessionId
    const pendingMatches = cached && String(cached.sessionId) === sessionId
    if (!active && !summaryMatches && !pendingMatches) return false
    invalidateSessionQueries(active?.roomId ?? String(summaryMatches ? summary.roomId : cached!.room?.id))
    if (pendingMatches) pendingSession.current = null
    if (active || pendingMatches && !current) {
      modelEntry.current = null
      releaseModel()
    }
    if (active) {
      try {
        localStorage.setItem(`capsule-session:${expectedUserId}:${sessionId}`, JSON.stringify({ roomId: active.roomId, startedAt: active.startedAt, focus: normalizeFocusTotals(active.focus), mateId: active.mateId }))
      } catch { /* Ending the live connection must still work without storage. */ }
      patch({ activeSession: null, messages: stateRef.current.messages.filter(message => message.sessionId !== sessionId || message.delivery !== 'pending') })
    }
    for (const key of failedMessages.current.keys()) if (key.startsWith(`message:${sessionId}:`)) failedMessages.current.delete(key)
    try { localStorage.removeItem(presenceKey(expectedUserId, sessionId)) } catch { /* Nothing to clean up. */ }
    setMeta(previous => ({ ...previous,
      activeSummary: String(previous.activeSummary?.sessionId) === sessionId ? null : previous.activeSummary,
      visuals: String(previous.visuals?.sessionId) === sessionId ? null : previous.visuals,
      me: String(previous.me?.activeSession?.sessionId) === sessionId ? { ...previous.me!, activeSession: undefined } : previous.me,
      home: String(previous.home?.activeSession?.sessionId) === sessionId ? { ...previous.home!, activeSession: undefined } : previous.home,
    }))
    return true
  }, [meta.activeSummary, invalidateSessionQueries, patch, releaseModel])
  const saveProfile = useCallback(async (nickname: string, avatarId?: number) => {
    const error = nicknameError(nickname)
    if (error) throw new ApiError(error, 400)
    if (avatarId !== undefined) adapt.id(avatarId)
    const generation = epoch.current
    const userId = stateRef.current.profile.userId
    if (!userId) throw new ApiError('로그인이 필요해요.', 401)
    const me = await api.request<MeResponse>('/me', { method: 'PATCH', body: { nickname: nickname.trim(), ...(avatarId === undefined ? {} : { avatarId }) } })
    if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
    if (me.userId !== userId) throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
    patch({ profile: { ...adapt.profile(me, stateRef.current.profile), ...(avatarId === undefined ? {} : { avatarId }) } })
    setMeta(previous => ({ ...previous, me }))
  }, [patch])
  const loadMateDetail = useCallback(async (mateId: string, force = false) => {
    const mate = availableMates(meta.home).find(value => value.id === mateId)
    const userId = stateRef.current.profile.userId
    if (!mate || !userId || !matePort) throw new ApiError('요청을 처리하지 못했어요.', 404)
    if (force) {
      queries.current.invalidate(`mate:${mate.characterId}`)
      mateReads.current.set(mate.characterId, (mateReads.current.get(mate.characterId) ?? 0) + 1)
    }
    const version = mateVersions.current.get(mate.characterId) ?? 0
    const read = mateReads.current.get(mate.characterId) ?? 0
    const value = await accountScope(() => epoch.current).wait(queries.current.load(`mate:${mate.characterId}`, async () =>
      checkedMateDetail(await matePort.load(userId, adapt.numericId(mate.characterId)), adapt.numericId(mate.characterId)), ROOM_MAX_AGE))
    if (version !== (mateVersions.current.get(mate.characterId) ?? 0) || read !== (mateReads.current.get(mate.characterId) ?? 0)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    setMeta(previous => previous.mateDetails[mateId] === value ? previous : { ...previous, mateDetails: { ...previous.mateDetails, [mateId]: value } })
    return value
  }, [matePort, meta.home])
  const resetMateConversation = useCallback(async (mateId: string, revision: string) => {
    const mate = availableMates(meta.home).find(value => value.id === mateId)
    const userId = stateRef.current.profile.userId
    if (!mate || !userId || !matePort?.resetConversation) throw new ApiError('요청을 처리하지 못했어요.', 404)
    if (!revision || meta.mateDetails[mateId]?.conversationRevision !== revision || resettingMates.current.has(mate.characterId)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    const pending = resettingMates.current
    pending.add(mate.characterId)
    try {
      const receipt = await accountScope(() => epoch.current).wait(matePort.resetConversation({ userId, characterId: adapt.numericId(mate.characterId), expectedRevision: revision }))
      checkMateReset(receipt, adapt.numericId(mate.characterId), revision)
      mateVersions.current.set(mate.characterId, (mateVersions.current.get(mate.characterId) ?? 0) + 1)
      queries.current.invalidate(`mate:${mate.characterId}`)
      invalidateSessionQueries(mate.roomId)
      patch({ messages: stateRef.current.messages.filter(message => message.characterId !== mate.characterId) })
      for (const key of failedMessages.current.keys()) if (key.endsWith(`:${mate.characterId}`)) failedMessages.current.delete(key)
      setServerRooms(getStudyRooms().map(room => ({ ...room, characters: room.characters.map(character => character.id === mate.characterId ? { ...character, relation: undefined } : character) })))
      setMeta(previous => {
        const mateDetails = { ...previous.mateDetails }, affinities = { ...previous.affinities }
        delete mateDetails[mateId]; delete affinities[mate.characterId]
        return { ...previous, mateDetails, affinities, mateContentVersion: previous.mateContentVersion + 1 }
      })
    } catch (error) {
      if (isMateResetConflict(error)) {
        queries.current.invalidate(`mate:${mate.characterId}`)
        mateVersions.current.set(mate.characterId, (mateVersions.current.get(mate.characterId) ?? 0) + 1)
        setMeta(previous => {
          const mateDetails = { ...previous.mateDetails }
          delete mateDetails[mateId]
          return { ...previous, mateDetails, mateContentVersion: previous.mateContentVersion + 1 }
        })
      }
      throw error
    } finally { pending.delete(mate.characterId) }
  }, [matePort, meta.home, meta.mateDetails, patch, invalidateSessionQueries])
  const applyAccountResult = useCallback((result: BetaAccountResult, avatarId?: number) => {
    if (result.me.userId !== stateRef.current.profile.userId) throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
    const details = checkedAccountDetails(result.details)
    if (meta.accountDetails?.birthDate && details.birthDate !== meta.accountDetails.birthDate) throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
    const profile = adapt.profile(result.me, stateRef.current.profile)
    patch({ profile: { ...profile, ...(avatarId === undefined ? {} : { avatarId }) } })
    setMeta(previous => ({ ...previous, me: result.me, accountDetails: details }))
  }, [patch, meta.accountDetails])
  const betaSignup = useCallback(async (input: BetaSignupInput) => {
    const error = birthDateError(input.birthDate) || nicknameError(input.nickname)
    if (error) throw new ApiError(error, 400)
    if (!accountPort) throw new ApiError('요청을 처리하지 못했어요.', 501)
    const referralCode = input.referralCode?.trim().toUpperCase() || undefined
    return accountScope(() => epoch.current).wait(
      accountPort.signup({ ...input, nickname: input.nickname.trim(), ...(referralCode ? { referralCode } : {}) }),
    )
  }, [accountPort])
  const completeOnboarding = useCallback(async (input: BetaOnboardingInput) => {
    const birthDate = meta.accountDetails?.birthDate || input.birthDate || ''
    const error = nicknameError(input.nickname) || birthDateError(birthDate)
    if (error) throw new ApiError(error, 400)
    if (input.avatarId !== undefined) adapt.id(input.avatarId)
    if (!accountPort) throw new ApiError('요청을 처리하지 못했어요.', 501)
    const userId = stateRef.current.profile.userId
    if (!userId) throw new ApiError('로그인이 필요해요.', 401)
    const referralCode = input.referralCode?.trim().toUpperCase() || undefined
    const result = await accountScope(() => epoch.current).wait(
      accountPort.completeOnboarding(userId, {
        ...input,
        nickname: input.nickname.trim(),
        birthDate,
        ...(referralCode ? { referralCode } : {}),
      }),
    )
    if (result.me.onboardingRequired !== false || result.details.birthDate !== birthDate) throw new ApiError('프로필 응답을 확인하지 못했어요.', 502)
    applyAccountResult(result, input.avatarId)
  }, [accountPort, applyAccountResult, meta.accountDetails])
  const validateReferralCode = useCallback(async (code: string) => {
    if (!accountPort?.validateReferralCode) throw new ApiError('요청을 처리하지 못했어요.', 501)
    return accountPort.validateReferralCode(code)
  }, [accountPort])
  const saveBetaProfile = useCallback(async (input: BetaProfileInput) => {
    const error = nicknameError(input.nickname)
    if (error) throw new ApiError(error, 400)
    if (input.avatarId !== undefined) adapt.id(input.avatarId)
    if (!accountPort) throw new ApiError('요청을 처리하지 못했어요.', 501)
    const userId = stateRef.current.profile.userId
    if (!userId) throw new ApiError('로그인이 필요해요.', 401)
    const result = await accountScope(() => epoch.current).wait(accountPort.saveProfile(userId, { ...input, nickname: input.nickname.trim(), callName: input.callName.trim(), aboutMe: input.aboutMe.trim() }))
    applyAccountResult(result, input.avatarId)
  }, [accountPort, applyAccountResult])
  // Retired source previews still type-check, but cannot call the schedule API.
  const createMemory = useCallback(async (): Promise<never> => { throw new ApiError('요청을 처리하지 못했어요.', 410) }, [])
  const installSession = useCallback(async (dto: StartResponse | ResumeResponse) => {
    const generation = epoch.current
    const entry = { pathname: currentPath.current }
    modelEntry.current = entry
    try {
      const active = adapt.session(dto)
      try {
        const mate = availableMates(meta.home).find(value => value.characterId === active.characterIds[0] && value.roomId === active.roomId)
        if (mate) active.mateId = mate.id
      } catch { /* Missing local conversation settings use basic. */ }
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
      if (generation !== epoch.current || currentPath.current !== entry.pathname || modelEntry.current !== entry) throw new ApiError('연결이 취소됐어요.', 409)
      const stage = await models.prepare(dto.character)
      if (generation !== epoch.current || currentPath.current !== entry.pathname || modelEntry.current !== entry) {
        if (modelEntry.current === entry) releaseModel()
        throw new ApiError('연결이 취소됐어요.', 409)
      }
      setLive2dStage(stage)
      pendingSession.current = null
      patch({ activeSession: active, firstVisit: false })
      invalidateSessionQueries(active.roomId)
      setMeta(previous => ({ ...previous, visuals: dto, activeSummary: null }))
      try {
        localStorage.setItem(`capsule-session:${stateRef.current.profile.userId}:${active.id}`, JSON.stringify({ roomId: active.roomId, startedAt: active.startedAt, focus: active.focus, mateId: active.mateId }))
      } catch { /* Server report still works without browser storage. */ }
      return active
    } finally { if (modelEntry.current === entry) modelEntry.current = null }
  }, [patch, invalidateSessionQueries, models, releaseModel, meta.home])
  const resumeSession = useCallback(async (sessionId: string) => {
    const requestedId = adapt.numericId(sessionId)
    const id = String(requestedId)
    const current = stateRef.current.activeSession
    if (current?.id === id && !current.serverSession) throw new ApiError('요청을 처리하지 못했어요.', 410)
    const cached = pendingSession.current
    const expected = current?.id === id ? { roomId: current.roomId, characterId: current.characterIds[0] }
      : cached?.sessionId === requestedId ? { roomId: String(cached.room?.id), characterId: String(cached.character?.id) } : null
    const userId = stateRef.current.profile.userId
    const account = accountScope(() => epoch.current)
    const entryPath = currentPath.current
    try {
      await account.wait(flushSessionEvents(id))
      const dto = await account.wait(api.request<ResumeResponse>(`/sessions/${requestedId}/resume`, { method: 'POST' }))
      if (dto.sessionId !== requestedId || expected && (String(dto.room?.id) !== expected.roomId || String(dto.character?.id) !== expected.characterId)) throw new ApiError('연결 응답을 확인하지 못했어요.', 502)
      const roomId = adapt.id(dto.room?.id)
      adapt.id(dto.character?.id)
      pendingSession.current = dto
      invalidateSessionQueries(roomId)
      if (currentPath.current !== entryPath) {
        throw new ApiError('연결이 취소됐어요.', 409)
      }
      return installSession(dto)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SESSION_ENDED' && userId) {
        acknowledgeEndedSession(id, userId)
        throw new EndedConnectionError(error, id)
      }
      throw error
    }
  }, [installSession, acknowledgeEndedSession, invalidateSessionQueries])
  const startSession = useCallback(async (roomId: string, characterId: string, minutes = LEGACY_SESSION_TARGET_MINUTES, options: { tier?: TierId; characterIds?: string[] } = {}) => {
    const operations = pending.current
    const room = getStudyRooms().find(value => value.id === roomId)
    const character = room?.characters.find(value => value.id === characterId)
    const ids = options.characterIds ?? [characterId]
    if (!room || !character || !ids.length || !ids.includes(characterId) || !ids.every(id => room.characters.some(c => c.id === id))) throw new ApiError('메이트를 선택해 주세요.', 400)
    if (stateRef.current.activeSession || meta.activeSummary) throw new ApiError('진행 중인 연결을 먼저 이어가 주세요.', 409)
    if (resettingMates.current.has(characterId)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    if (!room.serverRoom || !character.serverCharacter || ids.length !== 1 || (options.tier && options.tier !== 'basic')) throw new ApiError('요청을 처리하지 못했어요.', 400)
    if (!isSessionTargetMinutes(minutes)) throw new ApiError('연결 시작에 필요한 시간 설정이 올바르지 않아요.', 400, 'INVALID_TARGET_MINUTES')
    if (operations.has('start')) throw new ApiError('연결하고 있어요.', 409)
    operations.add('start')
    const generation = epoch.current
    const account = accountScope(() => epoch.current)
    const entryPath = currentPath.current
    try {
      const cached = pendingSession.current
      if (cached?.room?.id === adapt.numericId(roomId) && cached.character?.id === adapt.numericId(characterId)) return await resumeSession(adapt.id(cached.sessionId))
      const body: StartRequest = { roomId: adapt.numericId(roomId), characterId: adapt.numericId(characterId), targetMinutes: minutes }
      const dto = await account.wait(api.request<StartResponse>('/sessions', { method: 'POST', body }))
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      if (dto.room?.id !== adapt.numericId(roomId) || dto.character?.id !== adapt.numericId(characterId)) throw new ApiError('요청을 처리하지 못했어요.', 502)
      pendingSession.current = dto
      invalidateSessionQueries(roomId)
      // A late start response can still be resumed, but must not load a model on the screen the user left for.
      if (currentPath.current !== entryPath) throw new ApiError('연결이 취소됐어요.', 409)
      const active = await installSession(dto)
      return stateRef.current.activeSession ?? active
    } finally { operations.delete('start') }
  }, [installSession, meta.activeSummary, resumeSession, invalidateSessionQueries])
  const connectMate = useCallback(async (mateId: string) => {
    const mate = availableMates(meta.home).find(value => value.id === mateId)
    if (!mate) throw new ApiError('요청을 처리하지 못했어요.', 404)
    if (resettingMates.current.has(mate.characterId)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    const current = stateRef.current.activeSession
    if (current && (current.roomId !== mate.roomId || current.characterIds.length !== 1 || current.characterIds[0] !== mate.characterId || !current.serverSession)) {
      throw new ApiError('요청을 처리하지 못했어요.', 409)
    }
    if (meta.activeSummary && (!mateByName(meta.activeSummary.characterName, [mate]) || String(meta.activeSummary.roomId) !== mate.roomId)) {
      throw new ApiError('요청을 처리하지 못했어요.', 409)
    }
    // The current API requires a legacy target. Keep it in the request only; the beta UI
    // does not use it as a countdown or an automatic end condition. See REQUEST.md R09.
    const active = current ?? (meta.activeSummary?.sessionId
      ? await resumeSession(String(meta.activeSummary.sessionId))
      : await startSession(mate.roomId, mate.characterId))
    const connection = { ...active, mateId: mate.id }
    patch({ activeSession: connection })
    return connection
  }, [meta.home, meta.activeSummary, startSession, resumeSession, patch])
  const finishSession = useCallback(async (options: { acceptUnknownPresence?: boolean } = {}) => {
    const operations = pending.current
    if (operations.has('end')) throw new ApiError('연결을 마무리하고 있어요.', 409)
    const current = stateRef.current.activeSession
    if (!current) throw new ApiError('진행 중인 연결이 없어요.', 400)
    if (!current.serverSession) throw new ApiError('요청을 처리하지 못했어요.', 410)
    // An unknown baseline already counts earlier study as away; ending then needs the user's explicit confirmation.
    if (current.presenceKnown === false && !options.acceptUnknownPresence) throw new ApiError('이전 자리 지킴 시간을 불러오지 못했어요. 처음 연결한 브라우저에서 이어가 주세요.', 409)
    const account = accountScope(() => epoch.current)
    operations.add('end')
    try {
      await account.wait(flushSessionEvents(current.id))
      const totals = getSessionTotals(current)
      const body: EndRequest = { studySeconds: totals.studySeconds, presentSeconds: totals.presentSeconds }
      const dto = await account.wait(api.request<ReportResponse>(`/sessions/${adapt.numericId(current.id)}/end`, { method: 'POST', body }))
      if (String(dto.sessionId) !== current.id || String(dto.character?.id) !== current.characterIds[0]) throw new ApiError('연결 기록을 확인하지 못했어요.', 502)
      const record = adapt.report(dto, current.roomId)
      const active = stateRef.current.activeSession
      const finished = active?.id === current.id ? active : current
      record.tier = finished.tier
      record.cameraFocus = normalizeFocusTotals(finished.focus)
      try {
        localStorage.setItem(`capsule-session:${stateRef.current.profile.userId}:${current.id}`, JSON.stringify({
          roomId: current.roomId, startedAt: current.startedAt, focus: record.cameraFocus, mateId: current.mateId,
        }))
      } catch { /* The current report retains its camera measurement in memory. */ }
      invalidateSessionQueries(current.roomId)
      const cached = pendingSession.current
      if (String(cached?.sessionId) === current.id) pendingSession.current = null
      patch({
        ...(active?.id === current.id ? { activeSession: null } : {}),
        messages: stateRef.current.messages.filter(message => message.sessionId !== current.id || message.delivery !== 'pending'),
        records: [record, ...stateRef.current.records.filter(value => value.id !== record.id)], latestRecordId: record.id,
      })
      // The user may have left this connection and prepared another while /end was pending.
      if ((!active || active.id === current.id) && (!cached || String(cached.sessionId) === current.id)) {
        modelEntry.current = null
        releaseModel()
      }
      for (const key of failedMessages.current.keys()) if (key.startsWith(`message:${current.id}:`)) failedMessages.current.delete(key)
      try { localStorage.removeItem(presenceKey(stateRef.current.profile.userId, current.id)) } catch { /* Nothing to clean up. */ }
      setMeta(previous => ({ ...previous,
        activeSummary: String(previous.activeSummary?.sessionId) === current.id ? null : previous.activeSummary,
        visuals: String(previous.visuals?.sessionId) === current.id ? null : previous.visuals,
        me: String(previous.me?.activeSession?.sessionId) === current.id ? { ...previous.me!, activeSession: undefined } : previous.me,
        home: String(previous.home?.activeSession?.sessionId) === current.id ? { ...previous.home!, activeSession: undefined } : previous.home,
      }))
      return record
    } finally { operations.delete('end') }
  }, [patch, invalidateSessionQueries, releaseModel])
  const sendMessage = useCallback(async (characterId: string, content: string, inputType: 'TEXT' | 'QUICK' = 'TEXT') => {
    const current = stateRef.current.activeSession
    if (!current) throw new ApiError('진행 중인 연결이 없어요.', 400)
    if (!content.trim() || content.length > 300) throw new ApiError('메시지는 1~300자로 입력해 주세요.', 400)
    if (!current.characterIds.includes(characterId)) throw new ApiError('연결 중인 메이트를 선택해 주세요.', 400)
    if (resettingMates.current.has(characterId)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    if (!current.serverSession) throw new ApiError('요청을 처리하지 못했어요.', 410)
    const key = `message:${current.id}:${characterId}`
    const operations = pending.current
    if (operations.has(key)) throw new ApiError('답장을 기다려 주세요.', 409)
    const generation = epoch.current
    const mateVersion = mateVersions.current.get(characterId) ?? 0
    const previous = failedMessages.current.get(key)
    const requestId = previous?.content === content.trim() && previous.inputType === inputType ? previous.requestId : crypto.randomUUID()
    failedMessages.current.set(key, { content: content.trim(), inputType, requestId })
    operations.add(key)
    const live = () => generation === epoch.current && stateRef.current.activeSession?.id === current.id && mateVersion === (mateVersions.current.get(characterId) ?? 0)
    // Replaces a message in place (keeping its position) or appends it.
    const upsert = (message: Message) => {
      const list = stateRef.current.messages
      patch({ messages: list.some(value => value.id === message.id) ? list.map(value => value.id === message.id ? message : value) : [...list, message] })
    }
    const reply = (text: string, delivery: Message['delivery'] = 'pending', createdAt = Date.now()): Message => ({
      id: `${requestId}:reply`, requestId, sessionId: current.id, characterId, sender: 'character', text, voice: false,
      delivery,
      createdAt: stateRef.current.messages.find(value => value.id === `${requestId}:reply`)?.createdAt ?? createdAt,
    })
    // The user's line shows right away so streamed reply text appears below it.
    upsert({ id: `${requestId}:user`, requestId, sessionId: current.id, characterId, sender: 'user', text: content.trim(), voice: false, createdAt: Date.now(), delivery: 'pending' })
    try {
      const result = await accountScope(() => epoch.current).wait(streamMessage(api, adapt.numericId(current.id), { requestId, characterId: adapt.numericId(characterId), content: content.trim(), inputType, tts: false }, {
        onReply: text => { if (live()) upsert(reply(text)) },
        alive: live,
      }))
      if (result.requestId !== requestId || adapt.id(result.characterId) !== characterId || !result.content) throw new ApiError('답장 응답을 확인하지 못했어요.', 502)
      if (!live()) return result
      // `done` holds the final text; it also creates the bubble when no `reply` came (fallback line, or a resend that
      // waited for the original request and gets its stored reply with no expression and affinity delta 0).
      upsert({ ...stateRef.current.messages.find(message => message.id === `${requestId}:user`)!, delivery: 'confirmed' })
      upsert(reply(result.content, 'confirmed'))
      updateAffinity(result.characterId!, result.affinity)
      failedMessages.current.delete(key)
      return result
    } catch (error) {
      // As with API 20, a failed send leaves no messages; sending the same text again reuses the requestId.
      if (live()) patch({ messages: stateRef.current.messages.filter(value => value.requestId !== requestId) })
      throw error
    } finally { operations.delete(key) }
  }, [patch, updateAffinity])
  const loadReport = useCallback(async (sessionId: string) => {
    if (stateRef.current.records.some(value => value.id === sessionId)) return
    if (!/^\d+$/.test(sessionId)) throw new ApiError('이 브라우저에 저장된 연결 기록이 없어요.', 404)
    const generation = epoch.current
    const dto = await api.request<ReportResponse>(`/sessions/${adapt.numericId(sessionId)}/report`)
    if (generation !== epoch.current) return
    if (String(dto.sessionId) !== sessionId) throw new ApiError('연결 기록을 확인하지 못했어요.', 502)
    let room = getStudyRooms().find(value => value.name === dto.roomName)
    if (!room) {
      room = { id: `report-${sessionId}`, serverRoom: true, name: dto.roomName ?? '', description: '', introduction: '', contentStatus: 'preview', characters: [{ id: adapt.id(dto.character?.id), name: dto.character?.name ?? '', description: '', serverCharacter: true }] }
      registerReportRoom(room)
    }
    let cameraFocus: FocusTotals | undefined
    try {
      const stored = JSON.parse(readSessionStorageItem(`capsule-session:${stateRef.current.profile.userId}:${sessionId}`) ?? 'null') as { focus?: FocusTotals } | null
      if (stored?.focus) cameraFocus = normalizeFocusTotals(stored.focus)
    } catch { /* Do not invent a target missing from the report. */ }
    const record = adapt.report(dto, room.id)
    record.cameraFocus = cameraFocus
    patch({ records: [...stateRef.current.records.filter(value => value.id !== record.id), record] })
  }, [patch])
  return (
    <DemoContext value={{ state, dispatch, storageAvailable }}>
      <BackendContext value={{ ...meta, featurePort, betaSettings, loadMateDetail: matePort ? loadMateDetail : null, resetMateConversation: matePort?.resetConversation ? resetMateConversation : null, previewModelFactory: modelFactory, betaSignup: accountPort ? betaSignup : null, completeOnboarding: accountPort ? completeOnboarding : null, saveBetaProfile: accountPort ? saveBetaProfile : null, validateReferralCode: accountPort?.validateReferralCode ? validateReferralCode : null, live2dStage, reload, refreshHome, ensureAvatars, updateAffinity, authenticate, logout, withdrawAccount, forgetAuthentication: clear, saveProfile, createMemory, startSession, connectMate, resumeSession, finishSession, acknowledgeEndedSession, sendMessage, loadReport }}>
        {children}
      </BackendContext>
    </DemoContext>
  )
}
