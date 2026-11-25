import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'
import type { BackendContextValue } from '../src/features/backend/backend-context.ts'
import type { ApiClient } from '../src/shared/api/client.ts'
import type { LoginResponse, ReportResponse } from '../src/shared/api/types.ts'

test('the provider sends 11-25 connection requests and reads wrapped JSON and raw SSE payloads', async () => {
  const seen: string[] = []
  const mate = { id: 42, name: '말포이', cardImageUrl: '/malfoy.webp' }
  const now = new Date().toISOString()
  let nickname = '공부친구'
  const me = () => ({ userId: 7, nickname, onboardingRequired: false })
  const figures = () => ({ connectionId: 31, mate: { id: 42, name: '말포이', format: 'CUBISM', modelJsonUrl: '/malfoy.model3.json' }, serverTime: now })
  const report = { connectionId: 31, mate: { id: 42, name: '말포이' }, startedAt: now, endedAt: now,
    connectedSeconds: 60, presentSeconds: 50, cameraOnSeconds: 55, awaySeconds: 5, returnCount: 1, messageCount: 1 }
  const success = (data: unknown, status = 200) => Response.json({ success: true, data }, { status })
  const transport: typeof fetch = async (input, init) => {
    const path = String(input).replace('/api/backend', '')
    seen.push(`${init?.method} ${path}`)
    if (path === '/auth/email/login') return success({ accessToken: 'test-access', ...me() })
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-access')
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    if (path === '/me' && init?.method === 'PATCH') { nickname = String(body.nickname); return success(me()) }
    if (path === '/me') return success(me())
    if (path === '/avatars') return success({ avatars: [] })
    if (path === '/home') return success({ todayPresentSeconds: 0, todayConnectedSeconds: 0, activeConnection: null, lastMate: null, mates: [mate] })
    if (path === '/connections') {
      assert.deepEqual(body, { mateId: 42 })
      return success({ ...figures(), startedAt: now }, 201)
    }
    if (path === '/connections/31/resume') return success({ ...figures(), connectedSeconds: 60, presentSeconds: 50, cameraOnSeconds: 55, pipSeconds: 0 })
    if (path === '/connections/31/messages/stream') {
      assert.equal(body.mode, 'BASIC')
      const message = { requestId: body.requestId, characterId: body.characterId, content: '같이 집중하자!', mode: 'BASIC', charged: 0 }
      return new Response(`event: reply\ndata: ${JSON.stringify({ content: '같이' })}\n\nevent: done\ndata: ${JSON.stringify(message)}\n\n`,
        { headers: { 'content-type': 'text/event-stream' } })
    }
    if (path === '/connections/31/end' || path === '/connections/32') return success({ ...report, connectionId: path.endsWith('/32') ? 32 : 31 })
    throw new Error(`Unexpected API request: ${init?.method} ${path}`)
  }
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  const originalFetch = globalThis.fetch
  try {
    // ApiClient captures its transport at construction. Subsequent requests stay inside this in-memory server.
    globalThis.fetch = transport
    const provider = await server.ssrLoadModule('/src/features/demo/DemoProvider.tsx')
    const context = await server.ssrLoadModule('/src/features/backend/backend-context.ts')
    const api = (await server.ssrLoadModule('/src/shared/api/client.ts')).api as ApiClient
    globalThis.fetch = originalFetch
    let backend!: BackendContextValue
    function Capture() { backend = context.useBackend(); return null }
    const prepared: string[] = []
    renderToString(createElement(MemoryRouter, null, createElement(provider.DemoProvider, {
      modelFactory: (url: string) => {
        prepared.push(url)
        return { getStatus: () => 'ready', subscribe: () => () => {}, attach() {}, detach() {}, setTracking() {}, setExpression() {}, destroy() {} }
      },
    }, createElement(Capture))))
    const login = await api.request<LoginResponse>('/auth/email/login', { method: 'POST', auth: false, body: {} })
    assert.equal((await backend.authenticate(login)).userId, 7)
    await backend.saveProfile('새 닉네임')
    assert.equal((await api.request<{ nickname: string }>('/me')).nickname, '새 닉네임')
    await assert.rejects(backend.createMemory({ kind: '목표', title: '함께 공부하기', date: '', time: '' }), {status:410})
    assert.equal(seen.some(path=>path.includes('/me/memories')),false)
    const active = await backend.startSession('42', '42', 55)
    assert.equal(active.id, '31')
    assert.equal(active.targetSeconds, undefined)
    assert.equal(active.serverSession, true)
    assert.equal((await backend.sendMessage('42', '같이 공부하자')).content, '같이 집중하자!')
    const resumed = await backend.resumeSession('31')
    assert.equal(resumed.studySeconds, 60)
    assert.deepEqual(resumed.initialTotals, { presentSeconds: 50, cameraOnSeconds: 55, pipSeconds: 0 })
    // Server rendering does not mount the presence clock required by finishSession; check its transport directly.
    const reportData = await api.request<ReportResponse>('/connections/31/end', { method: 'POST', body: { connectedSeconds: 60, presentSeconds: 50, cameraOnSeconds: 55, pipSeconds: 0, endType: 'NORMAL' } })
    assert.equal(reportData.connectionId, 31)
    assert.equal(reportData.connectedSeconds, 60)
    await backend.loadReport('32')
    assert.ok(seen.includes('GET /connections/32'))
    assert.equal(seen.some(path => path.includes('/sessions') || path.includes('/rooms')), false)
    assert.deepEqual(prepared, ['/malfoy.model3.json'])
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
