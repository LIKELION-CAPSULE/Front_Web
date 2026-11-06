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
let mount: (modelFactory?: SessionModelFactory) => BackendContextValue
let setServerRooms: (rooms: unknown[]) => void
const me = { userId: 7, nickname: '공부친구', onboardingRequired: true }
const original: Partial<Pick<ApiClient, 'request' | 'refresh' | 'waitForRefresh'>> = {}

before(async () => {
  // Load the actual TSX provider with the app's normal module resolution, without opening a browser or network listener.
  server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  const provider = await server.ssrLoadModule('/src/features/demo/DemoProvider.tsx')
  const context = await server.ssrLoadModule('/src/features/backend/backend-context.ts')
  api = (await server.ssrLoadModule('/src/shared/api/client.ts')).api
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

test('a cancelled entry cannot destroy the model reused by a newer account entry', async () => {
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
  // Wait until the old account is preparing its model, rather than still awaiting the resume request.
  for (let turn = 0; !listeners.size && turn < 20; turn++) await Promise.resolve()
  assert.equal(listeners.size, 1)
  await backend.authenticate({ accessToken: 'new-account' })
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
