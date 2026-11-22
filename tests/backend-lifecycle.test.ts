import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer, type ViteDevServer } from 'vite'
import type { BackendContextValue } from '../src/features/backend/backend-context.ts'
import type { ApiClient } from '../src/shared/api/client.ts'
import type { SessionModelFactory, SessionModelStage } from '../src/features/live2d/session-model.ts'

let server: ViteDevServer
let api: ApiClient
let ServerApiError: typeof import('../src/shared/api/client.ts').ApiError
let mount: (modelFactory?: SessionModelFactory) => BackendContextValue
let setServerRooms: (rooms: unknown[]) => void
const me = { userId: 7, nickname: '공부친구', onboardingRequired: true }
const original: Partial<Pick<ApiClient, 'request' | 'refresh' | 'waitForRefresh'>> = {}

before(async () => {
  // Load the actual TSX provider with the app's normal module resolution, without opening a browser or network listener.
  server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  const provider = await server.ssrLoadModule('/src/features/demo/DemoProvider.tsx')
  const context = await server.ssrLoadModule('/src/features/backend/backend-context.ts')
  const client = await server.ssrLoadModule('/src/shared/api/client.ts')
  api = client.api
  ServerApiError = client.ApiError
  setServerRooms = (await server.ssrLoadModule('/src/features/rooms/services/room-service.ts')).setServerRooms
  original.request = api.request
  original.refresh = api.refresh
  original.waitForRefresh = api.waitForRefresh
  mount = modelFactory => {
    let backend!: BackendContextValue
    function Capture() { backend = context.useBackend(); return null }
    renderToString(createElement(MemoryRouter, null, createElement(provider.DemoProvider, { modelFactory }, createElement(Capture))))
    return backend
  }
})
after(async () => {
  if (api) Object.assign(api, original)
  await server?.close()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function transport(paths: string[], logoutResponse: Promise<unknown> = Promise.resolve(null)) {
  api.request = async <T>(path: string) => {
    paths.push(path)
    if (path === '/auth/logout') return await logoutResponse as T
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    throw new Error(`Unexpected request: ${path}`)
  }
}

test('provider does not log out a newly authenticated account after waiting for refresh', async () => {
  const paths: string[] = [], refresh = deferred<void>(), backend = mount()
  transport(paths)
  api.waitForRefresh = () => refresh.promise
  const logout = backend.logout()
  const rejection = assert.rejects(logout, { code: 'AUTH_SESSION_CHANGED' })
  await backend.authenticate({ accessToken: 'new-account' })
  refresh.resolve()
  await rejection
  assert.equal(paths.includes('/auth/logout'), false)
})

test('provider ignores an old logout response instead of clearing the new account', async () => {
  const paths: string[] = [], response = deferred<unknown>(), backend = mount()
  transport(paths, response.promise)
  api.waitForRefresh = async () => {}
  const logout = backend.logout()
  const rejection = assert.rejects(logout, { code: 'AUTH_SESSION_CHANGED' })
  await Promise.resolve()
  await Promise.resolve()
  assert.ok(paths.includes('/auth/logout'))
  await backend.authenticate({ accessToken: 'new-account' })
  response.resolve(null)
  await rejection
  let refreshes = 0
  api.refresh = async () => { refreshes++; return false }
  paths.length = 0
  await backend.reload()
  assert.equal(refreshes, 0)
  assert.ok(paths.includes('/me'), 'the new account remains authenticated')
})

test('provider cancels a resume after the account changes during the event flush', async () => {
  const paths: string[] = [], backend = mount()
  transport(paths)
  const resume = backend.resumeSession('31')
  const rejection = assert.rejects(resume, { code: 'AUTH_SESSION_CHANGED' })
  await backend.authenticate({ accessToken: 'new-account' })
  await rejection
  assert.equal(paths.some(path => path.endsWith('/resume')), false)
})

test('acknowledging a server-ended connection releases only the matching account and model without a second end request', async () => {
  let destroyed = 0
  const paths: string[] = [], backend = mount(() => ({
    getStatus: () => 'ready', subscribe: () => () => {}, attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() { destroyed++ },
  }))
  const room = { id: 11, name: 'server room' }, character = { id: 42, name: 'server mate', modelJsonUrl: '/mate.model3.json' }
  api.request = async <T>(path: string) => {
    paths.push(path)
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path === '/home') return { rooms: [] } as T
    if (path === '/rooms/11') return { ...room, characters: [character] } as T
    if (path.endsWith('/resume')) return { sessionId: Number(path.split('/')[2]), room, character, studySeconds: 65, serverTime: new Date().toISOString() } as T
    throw new Error(`Unexpected request: ${path}`)
  }
  await backend.authenticate({ accessToken: 'isolated-ended-session' })
  await backend.resumeSession('31')
  assert.equal(backend.acknowledgeEndedSession('31', 8), false)
  assert.equal(backend.acknowledgeEndedSession('32', 7), false)
  assert.equal(destroyed, 0)
  assert.equal(backend.acknowledgeEndedSession('31', 7), true)
  assert.equal(destroyed, 1)
  assert.equal(backend.acknowledgeEndedSession('31', 7), false)
  await backend.resumeSession('32')
  assert.equal(backend.acknowledgeEndedSession('31', 7), false)
  assert.equal(destroyed, 1, 'a late end for the old connection cannot release the new model')
  assert.equal(backend.acknowledgeEndedSession('32', 7), true)
  assert.equal(destroyed, 2)
  assert.equal(paths.some(path => path.endsWith('/end')), false)
})

test('a late message failure after authentication changes cannot report the new connection as ended', async () => {
  const backend = mount(() => ({ getStatus: () => 'ready', subscribe: () => () => {}, attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() {} }))
  api.request = async <T>(path: string) => {
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path === '/home') return { rooms: [] } as T
    if (path === '/rooms/11') return { id: 11, name: 'room', characters: [{ id: 42, name: 'mate' }] } as T
    if (path.endsWith('/resume')) return { sessionId: Number(path.split('/')[2]), room: { id: 11, name: 'room' }, character: { id: 42, name: 'mate', modelJsonUrl: '/mate.model3.json' }, studySeconds: 65, serverTime: new Date().toISOString() } as T
    throw new Error(`Unexpected request: ${path}`)
  }
  await backend.authenticate({ accessToken: 'isolated-before' })
  await backend.resumeSession('31')
  const originalStream = api.stream
  let reject!: (error: Error) => void
  api.stream = () => new Promise((_resolve, fail) => { reject = fail })
  try {
    const send = backend.sendMessage('42', 'test input')
    const rejected = assert.rejects(send, { status: 401, code: 'AUTH_SESSION_CHANGED' })
    await backend.authenticate({ accessToken: 'isolated-after' })
    await backend.resumeSession('32')
    reject(Object.assign(new Error('old server ended'), { status: 409, code: 'SESSION_ENDED' }))
    await rejected
    assert.equal(backend.acknowledgeEndedSession('31', 7), false)
    assert.equal(backend.acknowledgeEndedSession('32', 7), true)
  } finally { api.stream = originalStream }
})

test('a model-failed connection that ended on the server is discarded before the next fresh start', async () => {
  let starts = 0, resumes = 0, prepared = 0, destroyed = 0
  const backend = mount(() => { prepared++; return { getStatus: () => 'ready', subscribe: () => () => {}, attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() { destroyed++ } } })
  const room = { id: 11, name: 'room' }, character = { id: 42, name: 'mate' }
  api.request = async <T>(path: string) => {
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path === '/home') return { rooms: [] } as T
    if (path === '/sessions') {
      starts++
      return { sessionId: 30 + starts, room, character: { ...character, ...(starts > 1 ? { modelJsonUrl: '/mate.model3.json' } : {}) }, startedAt: new Date().toISOString(), serverTime: new Date().toISOString() } as T
    }
    if (path === '/sessions/31/resume') { resumes++; throw new ServerApiError('이미 종료된 연결이에요. 연결 기록을 확인해 주세요.', 409, 'SESSION_ENDED') }
    throw new Error(`Unexpected request: ${path}`)
  }
  await backend.authenticate({ accessToken: 'isolated-model-retry' })
  setServerRooms([{ id: '11', name: room.name, serverRoom: true, characters: [{ id: '42', name: character.name, serverCharacter: true }] }])
  await assert.rejects(backend.startSession('11', '42'), /모델/)
  assert.equal(prepared, 0)
  await assert.rejects(backend.startSession('11', '42'), { code: 'SESSION_ENDED', sessionId: '31' })
  assert.equal((await backend.startSession('11', '42')).id, '32')
  assert.equal(starts, 2); assert.equal(resumes, 1); assert.equal(prepared, 1)
  assert.equal(backend.acknowledgeEndedSession('31', 7), false)
  assert.equal(destroyed, 0)
  assert.equal(backend.acknowledgeEndedSession('32', 7), true)
})

test('session creation uses the existing 50-minute wire default and validates explicit targets before sending', async () => {
  const bodies: unknown[] = []
  const backend = mount(() => ({ getStatus: () => 'ready', subscribe: () => () => {}, attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() {} }))
  const room = { id: 11, name: 'room' }, character = { id: 42, name: 'mate', modelJsonUrl: '/mate.model3.json' }
  api.request = async <T>(path: string, options?: { body?: unknown }) => {
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path === '/home') return { rooms: [] } as T
    if (path === '/sessions') {
      bodies.push(options?.body)
      return { sessionId: 31, room, character, startedAt: new Date().toISOString(), serverTime: new Date().toISOString() } as T
    }
    throw new Error(`Unexpected request: ${path}`)
  }
  await backend.authenticate({ accessToken: 'isolated-api-target' })
  setServerRooms([{ id: '11', name: room.name, serverRoom: true, characters: [{ id: '42', name: character.name, serverCharacter: true }] }])
  for (const target of [0, 2, 4, 52, 185, 5.5, NaN, Infinity]) {
    await assert.rejects(backend.startSession('11', '42', target), { status: 400, code: 'INVALID_TARGET_MINUTES' })
  }
  assert.deepEqual(bodies, [])
  for (const target of [undefined, 3, 5, 55, 180]) {
    const connection = await backend.startSession('11', '42', target)
    assert.deepEqual(bodies.at(-1), { roomId: 11, characterId: 42, targetMinutes: target ?? 50 })
    assert.equal(connection.targetSeconds, undefined, 'the wire target never becomes a beta UI countdown')
    assert.equal(backend.acknowledgeEndedSession('31', 7), true)
  }
  assert.equal(bodies.length, 5)
})

test('confirmed start and resume responses invalidate home even when the model cannot load', async () => {
  let homeReads = 0, prepared = 0
  const backend = mount(() => { prepared++; throw new Error('A missing model must not be prepared') })
  const room = { id: 11, name: 'room' }, character = { id: 42, name: 'mate' }
  api.request = async <T>(path: string) => {
    if (path === '/me') return { ...me, onboardingRequired: false } as T
    if (path === '/home') { homeReads++; return { rooms: [{ id: room.id }] } as T }
    if (path === '/rooms/11') return { ...room, characters: [character] } as T
    if (path === '/sessions') return { sessionId: 31, room, character, startedAt: new Date().toISOString(), serverTime: new Date().toISOString() } as T
    if (path === '/sessions/31/resume') return { sessionId: 31, room, character, studySeconds: 0, serverTime: new Date().toISOString() } as T
    throw new Error(`Unexpected request: ${path}`)
  }
  await backend.authenticate({ accessToken: 'isolated-home-invalidation' })
  assert.equal(homeReads, 1)
  await backend.refreshHome()
  assert.equal(homeReads, 1, 'an unchanged home uses its cache')
  await assert.rejects(backend.startSession('11', '42'), /모델/)
  await backend.refreshHome()
  assert.equal(homeReads, 2, 'the successful server start invalidates home before model preparation')
  await backend.refreshHome()
  assert.equal(homeReads, 2)
  await assert.rejects(backend.resumeSession('31'), /모델/)
  await backend.refreshHome()
  assert.equal(homeReads, 3, 'the successful server resume also invalidates home')
  assert.equal(prepared, 0)
})

test('resume rejects a different session, room or character before replacing the current model', async () => {
  let mismatch = '', prepared = 0, destroyed = 0
  const backend = mount(() => { prepared++; return { getStatus: () => 'ready', subscribe: () => () => {}, attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() { destroyed++ } } })
  api.request = async <T>(path: string) => {
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path === '/home') return { rooms: [] } as T
    if (path === '/sessions/31/resume') return { sessionId: mismatch === 'session' ? 32 : 31, room: { id: mismatch === 'room' ? 12 : 11, name: 'room' }, character: { id: mismatch === 'character' ? 43 : 42, name: 'mate', modelJsonUrl: '/mate.model3.json' }, studySeconds: 65, serverTime: new Date().toISOString() } as T
    throw new Error(`Unexpected request: ${path}`)
  }
  await backend.authenticate({ accessToken: 'isolated-resume-identity' })
  setServerRooms([{ id: '11', name: 'room', serverRoom: true, characters: [{ id: '42', name: 'mate', serverCharacter: true }] }])
  await backend.resumeSession('31')
  for (const field of ['session', 'room', 'character']) { mismatch = field; await assert.rejects(backend.resumeSession('31'), { status: 502 }) }
  assert.equal(prepared, 1); assert.equal(destroyed, 0)
  assert.equal(backend.acknowledgeEndedSession('31', 7), true)
})

test('an old pending-model resume rejection cannot clear a new authentication and connection', async () => {
  let starts = 0, destroyed = 0, reject!: (error: Error) => void
  const requested = deferred<void>()
  const newRequested = deferred<void>()
  let releaseNew!: () => void
  const backend = mount(() => ({ getStatus: () => 'ready', subscribe: () => () => {}, attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() { destroyed++ } }))
  api.request = async <T>(path: string) => {
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path === '/home') return { rooms: [] } as T
    if (path === '/sessions') {
      starts++
      const dto = { sessionId: 30 + starts, room: { id: 11, name: 'room' }, character: { id: 42, name: 'mate', ...(starts > 1 ? { modelJsonUrl: '/mate.model3.json' } : {}) }, startedAt: new Date().toISOString(), serverTime: new Date().toISOString() }
      if (starts === 2) return new Promise(resolve => { releaseNew = () => resolve(dto as T); newRequested.resolve() })
      return dto as T
    }
    if (path === '/sessions/31/resume') { requested.resolve(); return new Promise((_resolve, fail) => { reject = fail }) }
    throw new Error(`Unexpected request: ${path}`)
  }
  const rooms = [{ id: '11', name: 'room', serverRoom: true, characters: [{ id: '42', name: 'mate', serverCharacter: true }] }]
  await backend.authenticate({ accessToken: 'isolated-pending-before' }); setServerRooms(rooms)
  await assert.rejects(backend.startSession('11', '42'), /모델/)
  const retry = backend.startSession('11', '42')
  const rejected = assert.rejects(retry, { code: 'AUTH_SESSION_CHANGED' })
  await requested.promise
  await backend.authenticate({ accessToken: 'isolated-pending-after' }); setServerRooms(rooms)
  const newEntry = backend.startSession('11', '42')
  await newRequested.promise
  reject(new ServerApiError('이미 종료된 연결이에요.', 409, 'SESSION_ENDED'))
  await rejected
  await assert.rejects(backend.startSession('11', '42'), { status: 409 })
  assert.equal(starts, 2, 'the old finally cannot unlock a new account operation')
  releaseNew()
  assert.equal((await newEntry).id, '32')
  assert.equal(destroyed, 0)
  assert.equal(backend.acknowledgeEndedSession('32', 7), true)
  assert.equal(destroyed, 1)
})

for (const entry of ['start', 'resume'] as const) {
  test(`Malfoy ${entry} prepares the server-provided Live2D model`, async () => {
    const prepared: string[] = []
    const backend = mount(url => {
      prepared.push(url)
      return {
        getStatus: () => 'ready', subscribe: () => () => {},
        attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() {},
      }
    })
    const room = { id: 11, name: 'room' }
    const character = { id: 42, name: '말포이 TS', modelJsonUrl: '/malfoy.model3.json' }
    setServerRooms([{ id: '11', name: 'room', serverRoom: true, characters: [{ id: '42', name: character.name, serverCharacter: true }] }])
    api.request = async <T>(path: string) => {
      if (path !== '/sessions' && path !== '/sessions/31/resume') throw new Error(`Unexpected request: ${path}`)
      const now = new Date().toISOString()
      return { sessionId: 31, room, character, targetMinutes: 3, serverTime: now,
        ...(entry === 'start' ? { startedAt: now } : { studySeconds: 65 }),
      } as T
    }
    const active = entry === 'start' ? await backend.startSession('11', '42', 3) : await backend.resumeSession('31')
    assert.equal(active.id, '31')
    assert.equal(active.serverSession, true)
    assert.deepEqual(active.characterIds, ['42'])
    assert.deepEqual(prepared, ['/malfoy.model3.json'])
  })
}

test('a cancelled entry cannot destroy the pending model reused by a newer entry in the same account', async () => {
  let ready = false, destroyed = 0
  const listeners = new Set<() => void>()
  const stage: SessionModelStage = {
    getStatus: () => ready ? 'ready' : 'loading',
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() { destroyed++ },
  }
  const backend = mount(() => stage)
  const room = { id: 11, name: 'room' }, character = { id: 42, name: 'friend', modelJsonUrl: '/friend.model3.json' }
  const roomInfo = [{ id: '11', name: 'room', characters: [], serverRoom: true }]
  const resumed = deferred<void>()
  let requests = 0
  api.request = async <T>(path: string) => {
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path.endsWith('/resume')) {
      if (++requests === 2) resumed.resolve()
      return { sessionId: 31, room, character, studySeconds: 0, targetMinutes: 3, serverTime: new Date().toISOString() } as T
    }
    throw new Error(`Unexpected request: ${path}`)
  }
  setServerRooms(roomInfo)
  const oldEntry = backend.resumeSession('31')
  const oldRejection = assert.rejects(oldEntry, /취소/)
  // Wait until the first entry is preparing its model, rather than still awaiting the resume request.
  for (let turn = 0; !listeners.size && turn < 20; turn++) await Promise.resolve()
  assert.equal(listeners.size, 1)
  setServerRooms(roomInfo)
  const newEntry = backend.resumeSession('31')
  await resumed.promise
  // The second entry shares the same pending model load.
  for (let turn = 0; turn < 5; turn++) await Promise.resolve()
  ready = true
  for (const listener of listeners) listener()
  await oldRejection
  assert.equal((await newEntry).id, '31')
  assert.equal(destroyed, 0, 'the successful entry must retain a live model')
})

test('changing accounts releases the old model and its late completion cannot destroy the new model', async () => {
  const stages: { ready: boolean; destroyed: number; listeners: Set<() => void>; stage: SessionModelStage }[] = []
  const backend = mount(() => {
    const model = { ready: false, destroyed: 0, listeners: new Set<() => void>(), stage: null as unknown as SessionModelStage }
    model.stage = {
      getStatus: () => model.ready ? 'ready' : 'loading',
      subscribe: listener => { model.listeners.add(listener); return () => { model.listeners.delete(listener) } },
      attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() { model.destroyed++ },
    }
    stages.push(model)
    return model.stage
  })
  const roomInfo = [{ id: '11', name: 'room', characters: [], serverRoom: true }]
  api.request = async <T>(path: string) => {
    if (path === '/me') return me as T
    if (path === '/avatars') return { avatars: [] } as T
    if (path.endsWith('/resume')) return { sessionId: 31, room: { id: 11, name: 'room' }, character: { id: 42, modelJsonUrl: '/friend.model3.json' }, studySeconds: 0, serverTime: new Date().toISOString() } as T
    throw new Error(`Unexpected request: ${path}`)
  }
  setServerRooms(roomInfo)
  const oldEntry = backend.resumeSession('31')
  const oldRejection = assert.rejects(oldEntry, /취소/)
  for (let turn = 0; !stages[0]?.listeners.size && turn < 20; turn++) await Promise.resolve()
  assert.equal(stages.length, 1)
  const lateCallbacks = [...stages[0]!.listeners]
  await backend.authenticate({ accessToken: 'new-account' })
  await oldRejection
  assert.equal(stages[0]!.destroyed, 1)
  assert.equal(stages[0]!.listeners.size, 0)
  setServerRooms(roomInfo)
  const newEntry = backend.resumeSession('31')
  for (let turn = 0; !stages[1]?.listeners.size && turn < 20; turn++) await Promise.resolve()
  assert.equal(stages.length, 2, 'a different account receives a fresh model even when the URL is identical')
  stages[0]!.ready = true
  lateCallbacks.forEach(callback => callback())
  stages[1]!.ready = true
  stages[1]!.listeners.forEach(callback => callback())
  assert.equal((await newEntry).id, '31')
  assert.equal(stages[1]!.destroyed, 0)
})
