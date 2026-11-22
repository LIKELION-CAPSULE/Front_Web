import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { LocalBetaStore, LOCAL_CHARACTER_ID, LOCAL_ROOM_ID } from '../src/features/local-demo/store.ts'

test('local transport covers the real client boundary and never forwards API or external requests', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  try {
    const { createLocalTransport } = await server.ssrLoadModule('/src/features/local-demo/transport.ts') as typeof import('../src/features/local-demo/transport.ts')
    const store = new LocalBetaStore(null), forwarded: string[] = []
    const fetch = createLocalTransport(store, async input => { forwarded.push(String(input)); return new Response('asset') }, 'http://local.test')
    const request = (path: string, body?: object) => fetch(`http://local.test/api/backend${path}`, { method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body) } : {}) })
    const home = await (await request('/home')).json()
    assert.equal(home.success, true)
    assert.equal(home.data.rooms.length, 1)
    assert.equal(home.data.rooms[0].characters[0].name, '채린')
    assert.equal((await request('/sessions', { roomId: LOCAL_ROOM_ID, characterId: LOCAL_CHARACTER_ID })).status, 400)
    const start = await request('/sessions', { roomId: LOCAL_ROOM_ID, characterId: LOCAL_CHARACTER_ID, targetMinutes: 50 })
    assert.equal(start.status, 201)
    const { data } = await start.json(), path = `/sessions/${data.sessionId}`
    assert.equal(data.character.modelJsonUrl, '/__local-assets/chaerin/model.model3.json')
    const event = await (await request(`${path}/events`, { type: 'FOCUS', occurredAt: new Date().toISOString() })).json()
    const reaction = await (await request(`${path}/events/${event.data.eventId}/reaction`, { requestId: 'event-request', intensity: 1, tts: false })).json()
    assert.equal(reaction.data.requestId, 'event-request')
    const stream = await request(`${path}/messages/stream`, { requestId: 'message-request', characterId: LOCAL_CHARACTER_ID, content: '안녕', inputType: 'TEXT', tts: false })
    assert.match(stream.headers.get('content-type')!, /text\/event-stream/)
    const wire = await stream.text()
    assert.match(wire, /event: reply/)
    const done = JSON.parse(wire.split('event: done\ndata: ')[1]!.trim())
    assert.equal(done.requestId, 'message-request')
    assert.equal(done.success, undefined)
    assert.equal((await request(`${path}/heartbeat`, { studySeconds: 60, presentSeconds: 50 })).status, 204)
    assert.equal((await request(`${path}/heartbeat`, { studySeconds: 40, presentSeconds: 50 })).status, 400)
    const report = await (await request(`${path}/end`, { studySeconds: 60, presentSeconds: 50 })).json()
    assert.equal(report.data.sessionId, data.sessionId)
    assert.equal((await request(`${path}/report`)).status, 200)
    assert.equal((await request(`${path}/resume`)).status, 409)
    assert.equal((await request('/unknown-beta-api')).status, 404)
    await assert.rejects(fetch('https://api.capsule.ai.kr/api/me'))
    await assert.rejects(fetch('http://local.test/upload', { method: 'POST' }))
    assert.deepEqual(forwarded, [])
    await fetch('http://local.test/__local-assets/chaerin/model.model3.json')
    assert.equal(forwarded.length, 1)
    store.reset('failure')
    assert.equal((await request('/home')).status, 503)
    assert.equal((await request('/home')).status, 200)
    store.reset('loading')
    const controller = new AbortController()
    const pending = fetch('http://local.test/api/backend/home', { signal: controller.signal })
    controller.abort()
    await assert.rejects(pending)
  } finally { await server.close() }
})
