import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { DemoContext } from './demo-context'
import { betaReducer, type ConnectionAction } from '@/features/backend/beta-reducer'
import { readConnectionCache, serverMessages, serverRecords, writeConnectionCache } from '@/features/backend/connection-cache'
import type { DemoState, FocusTotals, Message, TierId } from './types'
import type { ConnectionModeChoice } from '@/features/backend/backend-context'
import { normalizeFocusTotals } from '@/features/session/focus'
import { api, ApiError } from '@/shared/api/client'
import { QueryCache } from '@/shared/api/query-cache'
import { removeAccountSnapshots } from '@/features/auth/account-storage'
import type { ActiveConnectionSummary, AffinityChange, AvatarsResponse, EndType, HomeResponse, MeResponse, LoginResponse, StartRequest, StartResponse, ResumeResponse, EndRequest, ReportResponse, TermsResponse } from '@/shared/api/types'
import { BackendContext } from '@/features/backend/backend-context'
import { streamMessage } from '@/features/backend/message-stream'
import { accountScope } from '@/features/backend/account-scope'
import { EndedConnectionError, isConnectionEnded } from '@/features/backend/ended-connection'
import * as adapt from '@/features/backend/adapters'
import { getMateRooms, registerReportRoom, setMateRooms } from '@/features/mates/mate-rooms'
import { flushSessionEvents, getSessionTotals, readSessionStorageItem } from '@/features/backend/use-session-sync'
import type { BackendContextValue } from '@/features/backend/backend-context'
import { Live2DStage } from '@/features/live2d/live2d-stage'
import { SessionModel, type AlivingStageFactory, type SessionModelFactory, type SessionModelStage } from '@/features/live2d/session-model'
import { AlivingSessionStage } from '@/features/mate-render/AlivingSessionStage'
import { availableMates } from '@/features/mates/catalog'
import { showConnectionNotice } from '@/features/mates/connection-notice'
import { connectedMate, frontMateOf } from '@/features/mates/connected-mate'
import { withParticle } from '@/shared/lib/korean'
import { isSessionSurface } from '@/features/mates/session-surface'
import { matePortrait } from '@/features/mates/artwork'
import type { BetaAccountPort, BetaAccountResult, BetaOnboardingInput, BetaProfileInput, BetaSignupInput } from '@/features/auth/beta-account'
import { checkedAccountDetails } from '@/features/auth/beta-account'
import { birthDateError } from '@/features/auth/birth-date'
import { nicknameError } from '@/features/profile/profile-input'
import type { MateContentPort } from '@/features/mates/mate-contract'
import { checkedMateDetail } from '@/features/mates/mate-contract'
import { engineAllowlist } from '@/features/mate-render/engine-allowlist'
import { forgetAllChatRooms, forgetChatRoom } from '@/features/mates/chat-room'
import type { BetaFeaturePort, BetaFeatureSnapshot } from '@/features/backend/beta-feature-port'

type Meta = Pick<BackendContextValue, 'status' | 'loadingStage' | 'error' | 'signedOutNotice' | 'me' | 'accountDetails' | 'home' | 'homeContentVersion' | 'mateDetails' | 'mateContentVersion' | 'wallet' | 'invitation' | 'mateUnlocks' | 'redeemInvitation' | 'activeSummary' | 'avatars' | 'terms' | 'visuals' | 'affinities'>
/**
 * Local mutations invalidate the affected server queries immediately. These limits bound
 * how long data changed on another device can remain cached here.
 */
const HOME_MAX_AGE = 60_000
const MATE_MAX_AGE = 300_000
const AVATARS_MAX_AGE = 300_000
const initialMeta: Meta = { status: 'loading', loadingStage: 'auth', error: null, signedOutNotice: null, me: null, accountDetails: null, home: null, homeContentVersion: 0, mateDetails: {}, mateContentVersion: 0, wallet: null, invitation: null, mateUnlocks: undefined, redeemInvitation: null, activeSummary: null, avatars: [], terms: [], visuals: null, affinities: {} }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했어요.'
const createLive2DStage: SessionModelFactory = (url, layout) => new Live2DStage(url, layout, new URL(import.meta.env.BASE_URL, location.href).href)
/** v2 (Aliving2D) session models; engine scripts run only from this page's origin or the API origin. */
const createAlivingStage: AlivingStageFactory = (source, options) => new AlivingSessionStage(source, { stillImage: options.stillImage })

/** Cached reports may belong to mates no longer returned by /home. */
function registerCachedReportRooms(records: DemoState['records']) {
  for (const record of records) {
    if (!record.serverReport || getMateRooms().some(room => room.id === record.roomId)) continue
    const name = record.characterName ?? adapt.mateName(record.serverReport.mate?.name)
    registerReportRoom({ id: record.roomId, serverRoom: true, name: record.roomName ?? name,
      description: '', introduction: '', contentStatus: 'preview', characters: [{ id: record.characterIds[0]!,
        name, description: '', serverCharacter: true }],
    })
  }
}
/** The connection summary (8 · 11 `activeConnection`) of a running connection the user left. */
function connectionSummary(active: DemoState['activeSession'] & object, mateName: string | undefined): ActiveConnectionSummary {
  return { connectionId: Number(active.id), mateId: Number(active.characterIds[0]), mateName,
    startedAt: new Date(active.startedAt + (active.serverOffsetMs ?? 0)).toISOString() }
}
const summaryId = (summary: ActiveConnectionSummary | null | undefined) => summary?.connectionId === undefined ? undefined : String(summary.connectionId)

/** Server-backed beta state. Optional UI ports inject isolated local previews; legacy demo saves are never loaded. */
export function DemoProvider({ children, modelFactory = createLive2DStage, accountPort, matePort, featurePort }: { children: ReactNode; modelFactory?: SessionModelFactory; accountPort?: BetaAccountPort; matePort?: MateContentPort; featurePort?: BetaFeaturePort }) {
  const { pathname } = useLocation()
  const [state, reducerDispatch] = useReducer(betaReducer, undefined, adapt.emptyState)
  const [meta, setMeta] = useState<Meta>(initialMeta)
  const [betaSettings, setBetaSettings] = useState<BetaFeatureSnapshot['settings']>()
  const [models] = useState(() => new SessionModel(modelFactory, undefined, { createAliving: createAlivingStage, allowlist: engineAllowlist }))
  const [live2dStage, setLive2dStage] = useState<SessionModelStage | null>(null)
  const pendingSession = useRef<StartResponse | ResumeResponse | null>(null)
  const modelEntry = useRef<{ pathname: string } | null>(null)
  const currentPath = useRef(pathname)
  const stateRef = useRef(state)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const dispatch = useCallback((action: ConnectionAction) => {
    stateRef.current = betaReducer(stateRef.current, action)
    reducerDispatch(action)
  }, [])
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
  /** A referral code typed at signup, entered (36) after the new account signs in. */
  const pendingReferral = useRef<string | null>(null)
  /**
   * The conversation mode of the running connection (T-7; BASIC 0 · ADVANCED 30 credits a turn), the same in production
   * and the local mock: starts from the start response's `settings.defaultMode`, the call screen applies the account
   * setting and its toggle, and every message sends it (20 · 28 `mode`).
   */
  const [connectionMode, setConnectionModeState] = useState<{ id: string | null; mode: ConnectionModeChoice }>({ id: null, mode: 'basic' })
  const connectionModeRef = useRef(connectionMode)
  useLayoutEffect(() => { connectionModeRef.current = connectionMode }, [connectionMode])
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
      setMeta(previous => ({ ...previous, wallet: snapshot.wallet, invitation: snapshot.invitation, mateUnlocks: snapshot.mateUnlocks, affinities: snapshot.affinities, redeemInvitation: featurePort.redeemInvitation }))
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
    if (!active.serverSession) return
    // Returning through browser history must use the same server recovery as a reload.
    queueMicrotask(() => {
      if (stateRef.current.activeSession?.id !== active.id) return
      const room = getMateRooms().find(value => value.id === active.roomId)
      releaseModel()
      patch({ activeSession: null, messages: stateRef.current.messages.filter(message => message.sessionId !== active.id || message.delivery !== 'pending') })
      setMeta(previous => ({ ...previous, visuals: null, activeSummary: connectionSummary(active, room?.characters.find(value => value.id === active.characterIds[0])?.name) }))
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
    setMateRooms([])
    forgetAllChatRooms()
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
      if (!Array.isArray(value.mates)) throw new ApiError('홈 정보를 확인하지 못했어요.', 502)
      return value
    }, HOME_MAX_AGE)
    if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
    if (homeVersion !== homeRevision.current) return { home, rooms: [] }
    // 11-25: one card per mate; the app's room/character pair is that mate (/rooms/* was removed).
    const rooms = home.mates!.flatMap(card => { try { return [adapt.mateRoom(card)] } catch { return [] } })
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
      const accountDetails = accountPort ? checkedAccountDetails(await accountPort.read(me.userId!, me)) : null
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      setMeta(previous => ({ ...previous, loadingStage: me.onboardingRequired ? 'onboarding' : 'page' }))
      if (me.onboardingRequired) {
        const avatars = await loadAvatars()
        if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
        setMateRooms([])
        let cache = { records: [] as DemoState['records'], messages: [] as DemoState['messages'], latestRecordId: null as string | null }
        try { cache = readConnectionCache(localStorage, me.userId!) } catch { /* No local cache. */ }
        patch({ ...adapt.emptyState(), ...cache, profile: userProfile })
        setMeta(previous => ({ ...previous, status: 'ready', error: null, me, accountDetails, avatars, home: null, activeSummary: null }))
        return me
      }
      // Avatars are only needed by onboarding and the profile editor, which loads them itself.
      const { home, rooms } = await homeData
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      if (homeVersion === homeRevision.current) setMateRooms(rooms)
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
        ...(homeVersion === homeRevision.current ? { firstVisit: (home.todayConnectedSeconds ?? 0) === 0 && !home.activeConnection } : {}),
      })
      setMeta(previousMeta => ({ ...previousMeta, status: 'ready', error: null, me, accountDetails,
        ...(homeVersion === homeRevision.current ? { home, activeSummary: stateRef.current.activeSession ? null : me.activeConnection ?? home.activeConnection ?? null } : {}),
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
    setMateRooms([])
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
    const referral = pendingReferral.current
    pendingReferral.current = null
    // A failed second login must never leave the previous account's profile or history on screen.
    clear()
    api.setToken(result.accessToken)
    const generation = epoch.current
    setMeta(previous => ({ ...previous, status: 'loading', error: null, loadingStage: 'auth' }))
    try {
      // The referral code typed at signup (36). Its failure (REFERRAL_* codes) never fails the signup itself.
      if (referral && accountPort?.enterReferral) {
        try { await accountPort.enterReferral(referral) } catch { /* The code can still be entered on the invite screen within 7 days. */ }
      }
      return await loadUser()
    } catch (error) {
      if (generation === epoch.current) setMeta(previous => ({ ...previous, status: 'error', error: errorMessage(error) }))
      throw error
    }
  }, [clear, loadUser, accountPort])
  /** Work to finish before signing out (e.g. settings still waiting to be saved); each gets at most 2 s. */
  const beforeSignOut = useRef(new Set<() => Promise<unknown>>())
  const onBeforeSignOut = useCallback((task: () => Promise<unknown>) => {
    const tasks = beforeSignOut.current
    tasks.add(task)
    return () => { tasks.delete(task) }
  }, [])
  const logout = useCallback(async () => {
    const account = accountScope(() => epoch.current)
    const pendingWork = [...beforeSignOut.current].map(task => Promise.race([task().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 2000))]))
    if (pendingWork.length) await account.wait(Promise.all(pendingWork))
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
      setMateRooms(rooms)
      registerCachedReportRooms(stateRef.current.records)
      patch({ memories: [], firstVisit: (home.todayConnectedSeconds ?? 0) === 0 && !home.activeConnection })
      setMeta(previous => ({ ...previous, home, activeSummary: stateRef.current.activeSession ? null : home.activeConnection ?? null }))
    })()
    const entry = { generation, task }
    homeTask.current = entry
    try { await task } finally { if (homeTask.current === entry) homeTask.current = null }
  }, [patch, loadHome])
  const invalidateSessionQueries = useCallback(() => {
    homeRevision.current++
    homeTask.current = null
    queries.current.invalidate('home')
    setMeta(previous => ({ ...previous, homeContentVersion: previous.homeContentVersion + 1 }))
  }, [])
  const acknowledgeEndedSession = useCallback((sessionId: string, expectedUserId: number) => {
    if (!/^\d+$/.test(sessionId) || !Number.isSafeInteger(Number(sessionId)) || Number(sessionId) <= 0) return false
    const current = stateRef.current.activeSession
    const summary = meta.activeSummary
    const cached = pendingSession.current
    if (!stateRef.current.profile.loggedIn || stateRef.current.profile.userId !== expectedUserId) return false
    const active = current?.serverSession && current.id === sessionId ? current : null
    const summaryMatches = summaryId(summary) === sessionId
    const pendingMatches = cached && String(cached.connectionId) === sessionId
    if (!active && !summaryMatches && !pendingMatches) return false
    invalidateSessionQueries()
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
    setMeta(previous => ({ ...previous,
      activeSummary: summaryId(previous.activeSummary) === sessionId ? null : previous.activeSummary,
      visuals: String(previous.visuals?.connectionId) === sessionId ? null : previous.visuals,
      me: summaryId(previous.me?.activeConnection) === sessionId ? { ...previous.me!, activeConnection: null } : previous.me,
      home: summaryId(previous.home?.activeConnection) === sessionId ? { ...previous.home!, activeConnection: null } : previous.home,
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
      checkedMateDetail(await matePort.load(userId, adapt.numericId(mate.characterId)), adapt.numericId(mate.characterId)), MATE_MAX_AGE))
    if (version !== (mateVersions.current.get(mate.characterId) ?? 0) || read !== (mateReads.current.get(mate.characterId) ?? 0)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    setMeta(previous => previous.mateDetails[mateId] === value ? previous : { ...previous, mateDetails: { ...previous.mateDetails, [mateId]: value } })
    return value
  }, [matePort, meta.home])
  /**
   * 47: hides this mate's chat room and remembered facts on the server (204). This browser then drops the mate's message
   * cache, its chat-room history (32) and the detail (`hasConversation` changes); intimacy, unlocks and records stay, as
   * on the server. Refused here, before the request, while this mate is connected (the server answers the same 409).
   */
  const resetMateConversation = useCallback(async (mateId: string) => {
    const mate = availableMates(meta.home).find(value => value.id === mateId)
    const userId = stateRef.current.profile.userId
    if (!mate || !userId || !matePort?.resetConversation) throw new ApiError('요청을 처리하지 못했어요.', 404)
    const active = stateRef.current.activeSession
    if (active && (active.mateId === mate.id || active.characterIds.includes(mate.characterId))) throw new ApiError('지금 이 메이트와 연결 중이에요.', 409, 'CONNECTION_IN_PROGRESS')
    if (resettingMates.current.has(mate.characterId)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    const pending = resettingMates.current
    pending.add(mate.characterId)
    try {
      await accountScope(() => epoch.current).wait(matePort.resetConversation({ userId, characterId: adapt.numericId(mate.characterId) }))
      mateVersions.current.set(mate.characterId, (mateVersions.current.get(mate.characterId) ?? 0) + 1)
      queries.current.invalidate(`mate:${mate.characterId}`)
      patch({ messages: stateRef.current.messages.filter(message => message.characterId !== mate.characterId) })
      for (const key of failedMessages.current.keys()) if (key.endsWith(`:${mate.characterId}`)) failedMessages.current.delete(key)
      forgetChatRoom(userId, mate.characterId)
      setMeta(previous => {
        const mateDetails = { ...previous.mateDetails }
        delete mateDetails[mateId]
        return { ...previous, mateDetails, mateContentVersion: previous.mateContentVersion + 1 }
      })
    } finally { pending.delete(mate.characterId) }
  }, [matePort, meta.home, patch])
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
    const result = await accountScope(() => epoch.current).wait(
      accountPort.signup({ ...input, nickname: input.nickname.trim(), ...(referralCode ? { referralCode } : {}) }),
    )
    // 11-25: signup (4) has no referral field; the code is entered (36) once the new account is signed in (`authenticate`).
    pendingReferral.current = referralCode && accountPort.enterReferral ? referralCode : null
    return result
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
    const result = await accountScope(() => epoch.current).wait(accountPort.saveProfile(userId, { ...input, nickname: input.nickname.trim(), aboutMe: input.aboutMe.trim() }))
    applyAccountResult(result, input.avatarId)
  }, [accountPort, applyAccountResult])
  // Retired source previews still type-check, but cannot call the schedule API.
  const createMemory = useCallback(async (): Promise<never> => { throw new ApiError('요청을 처리하지 못했어요.', 410) }, [])
  const setConnectionMode = useCallback((mode: ConnectionModeChoice) => {
    const active = stateRef.current.activeSession
    if (!active) return
    if (connectionModeRef.current.id === active.id && connectionModeRef.current.mode === mode) return
    connectionModeRef.current = { id: active.id, mode }
    setConnectionModeState(connectionModeRef.current)
    // The local preview's credit simulation follows the same choice.
    featurePort?.setSettings({ advanced: mode === 'advanced' })
  }, [featurePort])
  const installSession = useCallback(async (dto: StartResponse | ResumeResponse) => {
    const generation = epoch.current
    const entry = { pathname: currentPath.current }
    modelEntry.current = entry
    try {
      const active = adapt.session(dto)
      // By id, else by the server name (one persona listed twice: 서진 id 2 · 3), so the call opens as that mate.
      const mate = frontMateOf(active.characterIds[0], dto.mate?.name, availableMates(meta.home))
      if (mate) active.mateId = mate.id
      if ('connectedSeconds' in dto) {
        // Camera measurement shown on this device's records continues from the snapshot of this connection, if any.
        try {
          const stored = JSON.parse(readSessionStorageItem(`capsule-session:${stateRef.current.profile.userId}:${active.id}`) ?? 'null') as { focus?: FocusTotals } | null
          active.focus = normalizeFocusTotals(stored?.focus)
        } catch { /* Only newly measured camera time is used when no snapshot can be restored. */ }
      }
      if (!getMateRooms().some(value => value.id === active.roomId) && dto.mate?.name) {
        setMateRooms([...getMateRooms(), adapt.mateRoom({ id: dto.mate.id, name: dto.mate.name, cardImageUrl: dto.mate.profileImageUrl })])
      }
      if (generation !== epoch.current || currentPath.current !== entry.pathname || modelEntry.current !== entry) throw new ApiError('연결이 취소됐어요.', 409)
      // The same still the call screen shows without a model (matePortrait), used if the v2 model breaks mid-call.
      const stage = await models.prepare(dto.mate, { stillImage: matePortrait(active.mateId ?? '', dto.mate?.profileImageUrl) })
      if (generation !== epoch.current || currentPath.current !== entry.pathname || modelEntry.current !== entry) {
        if (modelEntry.current === entry) releaseModel()
        throw new ApiError('연결이 취소됐어요.', 409)
      }
      setLive2dStage(stage)
      pendingSession.current = null
      const previousMode = connectionModeRef.current
      const mode: ConnectionModeChoice = previousMode.id === active.id ? previousMode.mode
        : 'settings' in dto && dto.settings?.defaultMode === 'ADVANCED' ? 'advanced' : 'basic'
      connectionModeRef.current = { id: active.id, mode }
      setConnectionModeState(connectionModeRef.current)
      patch({ activeSession: active, firstVisit: false })
      invalidateSessionQueries()
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
    const summary = meta.activeSummary
    const expectedMate = current?.id === id ? current.characterIds[0]
      : cached?.connectionId === requestedId ? String(cached.mate?.id)
        : summaryId(summary) === id && summary?.mateId !== undefined ? String(summary.mateId) : null
    const userId = stateRef.current.profile.userId
    const account = accountScope(() => epoch.current)
    const entryPath = currentPath.current
    try {
      await account.wait(flushSessionEvents(id))
      const dto = await account.wait(api.request<ResumeResponse>(`/connections/${requestedId}/resume`, { method: 'POST' }))
      if (dto.connectionId !== requestedId || expectedMate && String(dto.mate?.id) !== expectedMate) throw new ApiError('연결 응답을 확인하지 못했어요.', 502)
      adapt.id(dto.mate?.id)
      pendingSession.current = dto
      invalidateSessionQueries()
      if (currentPath.current !== entryPath) {
        throw new ApiError('연결이 취소됐어요.', 409)
      }
      return installSession(dto)
    } catch (error) {
      if (isConnectionEnded(error) && userId) {
        acknowledgeEndedSession(id, userId)
        throw new EndedConnectionError(error, id)
      }
      throw error
    }
  }, [installSession, acknowledgeEndedSession, invalidateSessionQueries, meta.activeSummary])
  /** API 16. `roomId` and `characterId` are both the mate id since 11-25; the old target minutes are ignored. */
  const startSession = useCallback(async (roomId: string, characterId: string, _minutes?: number, options: { tier?: TierId; characterIds?: string[] } = {}) => {
    const operations = pending.current
    const room = getMateRooms().find(value => value.id === roomId)
    const character = room?.characters.find(value => value.id === characterId)
    const ids = options.characterIds ?? [characterId]
    if (!room || !character || !ids.length || !ids.includes(characterId) || !ids.every(id => room.characters.some(c => c.id === id))) throw new ApiError('메이트를 선택해 주세요.', 400)
    if (stateRef.current.activeSession || meta.activeSummary) throw new ApiError('진행 중인 연결을 먼저 이어가 주세요.', 409)
    if (resettingMates.current.has(characterId)) throw new ApiError('요청을 처리하지 못했어요.', 409)
    if (!room.serverRoom || !character.serverCharacter || ids.length !== 1 || (options.tier && options.tier !== 'basic')) throw new ApiError('요청을 처리하지 못했어요.', 400)
    if (operations.has('start')) throw new ApiError('연결하고 있어요.', 409)
    operations.add('start')
    const generation = epoch.current
    const account = accountScope(() => epoch.current)
    const entryPath = currentPath.current
    const mateId = adapt.numericId(characterId)
    try {
      const cached = pendingSession.current
      if (cached?.mate?.id === mateId && cached.connectionId) return await resumeSession(String(cached.connectionId))
      const body: StartRequest = { mateId }
      let dto: StartResponse
      try {
        dto = await account.wait(api.request<StartResponse>('/connections', { method: 'POST', body }))
      } catch (error) {
        // Another tab or device already connected: continue that connection (409 + `detail.connectionId`).
        const existing = error instanceof ApiError && error.code === 'CONNECTION_ALREADY_IN_PROGRESS' ? error.detail.connectionId : undefined
        if (typeof existing === 'number' && Number.isSafeInteger(existing) && existing > 0) {
          operations.delete('start')
          return await resumeSession(String(existing))
        }
        throw error
      }
      if (generation !== epoch.current) throw new ApiError('로그인 상태가 변경됐어요.', 401)
      if (dto.mate?.id !== mateId) throw new ApiError('요청을 처리하지 못했어요.', 502)
      adapt.id(dto.connectionId)
      pendingSession.current = dto
      invalidateSessionQueries()
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
    // Only one connection at a time: name the mate it is with, so the user knows which one to finish first.
    const busyWith = (name: string | undefined) => new ApiError(
      name ? `${withParticle(name, '과', '와')} 연결 중이에요. 그 연결을 먼저 마쳐 주세요.` : '진행 중인 연결을 먼저 마쳐 주세요.', 409)
    const current = stateRef.current.activeSession
    const mates = availableMates(meta.home)
    // The same launch mate counts as the same, whichever of its server entries the connection is with.
    const frontOf = (characterId: string | number | undefined, name?: string) => frontMateOf(characterId === undefined ? undefined : String(characterId), name, mates)
    const currentMate = current && (current.mateId ? mates.find(value => value.id === current.mateId) : frontOf(current.characterIds[0]))
    if (current && (current.characterIds.length !== 1 || currentMate?.id !== mate.id || !current.serverSession)) {
      throw busyWith(currentMate?.name)
    }
    const summary = meta.activeSummary
    const summaryMate = summary && frontOf(summary.mateId, summary.mateName)
    if (summary && summaryMate?.id !== mate.id) throw busyWith(summaryMate?.name ?? summary.mateName)
    const active = current ?? (summary?.connectionId
      ? await resumeSession(String(summary.connectionId))
      : await startSession(mate.roomId, mate.characterId))
    // The 409 hand-off may continue another mate's connection: it stays that mate's (connected-mate.ts).
    const actual = connectedMate(mate, active.characterIds[0], mates, active.mateId)
    if (actual.notice) showConnectionNotice(actual.notice)
    // No launch mate for it: `mateId` stays empty (use-connect-mate.ts does not open the mate asked for).
    const connection = { ...active, mateId: actual.mate?.id }
    patch({ activeSession: connection })
    return connection
  }, [meta.home, meta.activeSummary, startSession, resumeSession, patch])
  const finishSession = useCallback(async (options: { acceptUnknownPresence?: boolean; endType?: EndType } = {}) => {
    const operations = pending.current
    if (operations.has('end')) throw new ApiError('연결을 마무리하고 있어요.', 409)
    const current = stateRef.current.activeSession
    if (!current) throw new ApiError('진행 중인 연결이 없어요.', 400)
    if (!current.serverSession) throw new ApiError('요청을 처리하지 못했어요.', 410)
    const account = accountScope(() => epoch.current)
    operations.add('end')
    try {
      await account.wait(flushSessionEvents(current.id))
      const body: EndRequest = { ...getSessionTotals(current), endType: options.endType ?? 'NORMAL' }
      const dto = await account.wait(api.request<ReportResponse>(`/connections/${adapt.numericId(current.id)}/end`, { method: 'POST', body }))
      if (String(dto.connectionId) !== current.id || String(dto.mate?.id) !== current.characterIds[0]) throw new ApiError('연결 기록을 확인하지 못했어요.', 502)
      const record = adapt.report(dto)
      const active = stateRef.current.activeSession
      const finished = active?.id === current.id ? active : current
      record.tier = finished.tier
      record.cameraFocus = normalizeFocusTotals(finished.focus)
      try {
        localStorage.setItem(`capsule-session:${stateRef.current.profile.userId}:${current.id}`, JSON.stringify({
          roomId: current.roomId, startedAt: current.startedAt, focus: record.cameraFocus, mateId: current.mateId,
        }))
      } catch { /* The current report retains its camera measurement in memory. */ }
      invalidateSessionQueries()
      const cached = pendingSession.current
      if (String(cached?.connectionId) === current.id) pendingSession.current = null
      patch({
        ...(active?.id === current.id ? { activeSession: null } : {}),
        messages: stateRef.current.messages.filter(message => message.sessionId !== current.id || message.delivery !== 'pending'),
        records: [record, ...stateRef.current.records.filter(value => value.id !== record.id)], latestRecordId: record.id,
      })
      // The user may have left this connection and prepared another while /end was pending.
      if ((!active || active.id === current.id) && (!cached || String(cached.connectionId) === current.id)) {
        modelEntry.current = null
        releaseModel()
      }
      for (const key of failedMessages.current.keys()) if (key.startsWith(`message:${current.id}:`)) failedMessages.current.delete(key)
      setMeta(previous => ({ ...previous,
        activeSummary: summaryId(previous.activeSummary) === current.id ? null : previous.activeSummary,
        visuals: String(previous.visuals?.connectionId) === current.id ? null : previous.visuals,
        me: summaryId(previous.me?.activeConnection) === current.id ? { ...previous.me!, activeConnection: null } : previous.me,
        home: summaryId(previous.home?.activeConnection) === current.id ? { ...previous.home!, activeConnection: null } : previous.home,
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
    const mode = connectionModeRef.current.id === current.id && connectionModeRef.current.mode === 'advanced' ? 'ADVANCED' : 'BASIC'
    try {
      const result = await accountScope(() => epoch.current).wait(streamMessage(api, adapt.numericId(current.id), { requestId, characterId: adapt.numericId(characterId), content: content.trim(), inputType, mode, tts: false }, {
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
      // Not enough credits for ADVANCED (409, nothing saved): the mode stays; the call screen asks (CreditShortNotice:
      // 「기본 모드로 계속」 switches and sends the same line again).
      throw error
    } finally { operations.delete(key) }
  }, [patch, updateAffinity])
  /** API 23 `GET /connections/{id}`: the record of an ended connection (409 `CONNECTION_IN_PROGRESS` while it runs). */
  const loadReport = useCallback(async (sessionId: string) => {
    if (stateRef.current.records.some(value => value.id === sessionId)) return
    if (!/^\d+$/.test(sessionId)) throw new ApiError('이 브라우저에 저장된 연결 기록이 없어요.', 404)
    const generation = epoch.current
    const dto = await api.request<ReportResponse>(`/connections/${adapt.numericId(sessionId)}`)
    if (generation !== epoch.current) return
    if (String(dto.connectionId) !== sessionId) throw new ApiError('연결 기록을 확인하지 못했어요.', 502)
    const record = adapt.report(dto)
    if (!getMateRooms().some(value => value.id === record.roomId)) {
      registerReportRoom({ id: record.roomId, serverRoom: true, name: record.characterName ?? '', description: '', introduction: '', contentStatus: 'preview',
        characters: [{ id: record.characterIds[0]!, name: record.characterName ?? '', description: '', serverCharacter: true }] })
    }
    try {
      const stored = JSON.parse(readSessionStorageItem(`capsule-session:${stateRef.current.profile.userId}:${sessionId}`) ?? 'null') as { focus?: FocusTotals } | null
      if (stored?.focus) record.cameraFocus = normalizeFocusTotals(stored.focus)
    } catch { /* Do not invent a camera measurement missing from the report. */ }
    patch({ records: [...stateRef.current.records.filter(value => value.id !== record.id), record] })
  }, [patch])
  return (
    <DemoContext value={{ state, dispatch, storageAvailable }}>
      <BackendContext value={{ ...meta, featurePort, betaSettings, loadMateDetail: matePort ? loadMateDetail : null, resetMateConversation: matePort?.resetConversation ? resetMateConversation : null, previewModelFactory: modelFactory, betaSignup: accountPort ? betaSignup : null, completeOnboarding: accountPort ? completeOnboarding : null, saveBetaProfile: accountPort ? saveBetaProfile : null, validateReferralCode: accountPort?.validateReferralCode ? validateReferralCode : null, live2dStage, reload, refreshHome, ensureAvatars, updateAffinity, authenticate, logout, withdrawAccount, forgetAuthentication: clear, saveProfile, createMemory, startSession, connectMate, resumeSession, finishSession, acknowledgeEndedSession, sendMessage, loadReport,
        connectionMode: connectionMode.id && connectionMode.id === state.activeSession?.id ? connectionMode.mode : 'basic', setConnectionMode, onBeforeSignOut }}>
        {children}
      </BackendContext>
    </DemoContext>
  )
}
