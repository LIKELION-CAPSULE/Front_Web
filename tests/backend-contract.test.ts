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

test('the provider sends runtime-valid session requests and reads wrapped JSON and raw SSE payloads', async () => {
  const seen: string[] = []
  const room = { id: 11, name: '시험용 룸', characters: [{ id: 42, name: '말포이 TS' }] }
  const now = new Date().toISOString()
  let nickname = '공부친구', targetMinutes = 50
  const me = () => ({ userId: 7, nickname, onboardingRequired: false })
  const session = () => ({ sessionId: 31, room, character: { id: 42, name: '말포이 TS', modelJsonUrl: '/malfoy.model3.json' },
    targetMinutes, serverTime: now })
  const report = { sessionId: 31, roomName: room.name, character: room.characters[0], startedAt: now, endedAt: now,
    studySeconds: 60, presentSeconds: 50, awaySeconds: 10, returnCount: 1 }
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
    if (path === '/home') return success({ todayStudySeconds: 0, rooms: [room] })
    if (path === '/rooms/11') return success(room)
    if (path === '/me/memories' && init?.method === 'POST') return success({ ...body, memoryId: 9 }, 201)
    if (path === '/me/memories?status=ALL') return success({ memories: [] })
    if (path === '/sessions') {
      // SessionService.start requires this even though OpenAPI omits it from `required`.
      const minutes = body.targetMinutes
      if (typeof minutes !== 'number' || !Number.isInteger(minutes) || !(minutes === 3 || minutes >= 5 && minutes <= 180 && minutes % 5 === 0)) {
        return Response.json({ success: false, code: 'INVALID_TARGET_MINUTES', message: 'INVALID_TARGET_MINUTES' }, { status: 400 })
      }
      assert.deepEqual(body, { roomId: 11, characterId: 42, targetMinutes: 55 })
      targetMinutes = minutes
      return success({ ...session(), startedAt: now }, 201)
    }
    if (path === '/sessions/31/resume') return success({ ...session(), studySeconds: 60, presentSeconds: 50, breakSeconds: 0 })
    if (path === '/sessions/31/messages/stream') {
      const message = { requestId: body.requestId, characterId: body.characterId, content: '같이 집중하자!' }
      return new Response(`event: reply\ndata: ${JSON.stringify({ content: '같이' })}\n\nevent: done\ndata: ${JSON.stringify(message)}\n\n`,
        { headers: { 'content-type': 'text/event-stream' } })
    }
    if (path === '/sessions/31/end' || path === '/sessions/32/report') return success({ ...report, sessionId: path.endsWith('/report') ? 32 : 31 })
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
    const active = await backend.startSession('11', '42', 55)
    assert.equal(active.targetSeconds, undefined)
    assert.equal(active.serverSession, true)
    assert.equal((await backend.sendMessage('42', '같이 공부하자')).content, '같이 집중하자!')
    assert.equal((await backend.resumeSession('31')).studySeconds, 60)
    // Server rendering does not mount the presence clock required by finishSession; check its transport directly.
    const reportData = await api.request<ReportResponse>('/sessions/31/end', { method: 'POST', body: { studySeconds: 60, presentSeconds: 50 } })
    assert.equal(reportData.sessionId, 31)
    assert.equal(reportData.studySeconds, 60)
    await backend.loadReport('32')
    assert.ok(seen.includes('GET /sessions/32/report'))
    assert.deepEqual(prepared, ['/malfoy.model3.json'])
  } finally {
    globalThis.fetch = originalFetch
    await server.close()
  }
})
