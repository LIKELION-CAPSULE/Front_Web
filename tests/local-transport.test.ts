import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { LocalBetaStore, LOCAL_CHARACTER_ID, LOCAL_DOHYUN_CHARACTER_ID, LOCAL_DOHYUN_ROOM_ID, LOCAL_ROOM_ID } from '../src/features/local-demo/store.ts'

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
    // Two mates, one room each (as the published API): 채린 and 서도현.
    assert.equal(home.data.rooms.length, 2)
    assert.deepEqual(home.data.rooms.map((room: { characters: { name: string }[] }) => room.characters[0]!.name), ['채린', '서도현'])
    assert.equal((await request('/sessions', { roomId: LOCAL_ROOM_ID, characterId: LOCAL_CHARACTER_ID })).status, 400)
    const start = await request('/sessions', { roomId: LOCAL_ROOM_ID, characterId: LOCAL_CHARACTER_ID, targetMinutes: 50 })
    assert.equal(start.status, 201)
    const { data } = await start.json(), path = `/sessions/${data.sessionId}`
    // v2 (Aliving2D) model in the draft contract shape (docs/MATE_MODEL_V2_CONTRACT.md)
    assert.equal(data.character.format, 'aliving2d')
    assert.equal(data.character.modelJsonUrl, '/__local-assets/chaerin-v2/model/model.json')
    assert.equal(data.character.engineUrl, '/__local-assets/chaerin-v2/engine/engine.js')
    const event = await (await request(`${path}/events`, { type: 'FOCUS', occurredAt: new Date().toISOString() })).json()
    // Faces come as the v2 Korean label, like the backend seed (live2d_expressions.name)
    assert.deepEqual(event.data.characters[0].expression, { name: '집중' })
    const reaction = await (await request(`${path}/events/${event.data.eventId}/reaction`, { requestId: 'event-request', intensity: 1, tts: false })).json()
    assert.equal(reaction.data.requestId, 'event-request')
    assert.equal(reaction.data.characters[0].expression.name, '집중')
    assert.ok(reaction.data.characters[0].content)
    // A message for a mate who is not in this connection is refused.
    assert.equal((await request(`${path}/messages`, { requestId: 'wrong-mate', characterId: LOCAL_DOHYUN_CHARACTER_ID, content: '안녕', inputType: 'TEXT', tts: false })).status, 400)
    const stream = await request(`${path}/messages/stream`, { requestId: 'message-request', characterId: LOCAL_CHARACTER_ID, content: '안녕', inputType: 'TEXT', tts: false })
    assert.match(stream.headers.get('content-type')!, /text\/event-stream/)
    const wire = await stream.text()
    assert.match(wire, /event: reply/)
    const done = JSON.parse(wire.split('event: done\ndata: ')[1]!.trim())
    assert.equal(done.requestId, 'message-request')
    assert.deepEqual(done.expression, { name: '웃음' })
    assert.equal(done.success, undefined)
    assert.equal((await request(`${path}/heartbeat`, { studySeconds: 60, presentSeconds: 50 })).status, 204)
    assert.equal((await request(`${path}/heartbeat`, { studySeconds: 40, presentSeconds: 50 })).status, 400)
    const report = await (await request(`${path}/end`, { studySeconds: 60, presentSeconds: 50 })).json()
    assert.equal(report.data.sessionId, data.sessionId)
    assert.equal((await request(`${path}/report`)).status, 200)
    assert.equal((await request(`${path}/resume`)).status, 409)

    // 서도현: his own room, model (the seojin bundle), reactions, reply and closing line; never 채린's.
    assert.equal((await request('/sessions', { roomId: LOCAL_ROOM_ID, characterId: LOCAL_DOHYUN_CHARACTER_ID, targetMinutes: 50 })).status, 400)
    const second = await (await request('/sessions', { roomId: LOCAL_DOHYUN_ROOM_ID, characterId: LOCAL_DOHYUN_CHARACTER_ID, targetMinutes: 50 })).json()
    assert.equal(second.data.character.name, '서도현')
    assert.equal(second.data.character.modelJsonUrl, '/__local-assets/seojin/model/model.json')
    assert.equal(second.data.character.engineUrl, '/__local-assets/seojin/engine/engine.js')
    const secondPath = `/sessions/${second.data.sessionId}`
    const away = await (await request(`${secondPath}/events`, { type: 'AWAY', occurredAt: new Date().toISOString() })).json()
    assert.equal(away.data.characters[0].characterId, LOCAL_DOHYUN_CHARACTER_ID)
    const awayLine = await (await request(`${secondPath}/events/${away.data.eventId}/reaction`, { requestId: 'dohyun-away', intensity: 1, tts: false })).json()
    assert.equal(awayLine.data.characters[0].content, '어디 가냐. 금방 올 거지?')
    const answer = await (await request(`${secondPath}/messages`, { requestId: 'dohyun-message', characterId: LOCAL_DOHYUN_CHARACTER_ID, content: '이거 모르겠어', inputType: 'TEXT', tts: false })).json()
    assert.equal(answer.data.content, '잠깐 봐봐. …아, 이거네. 여기부터 다시 해.')
    const secondReport = await (await request(`${secondPath}/end`, { studySeconds: 60, presentSeconds: 60 })).json()
    assert.equal(secondReport.data.character.id, LOCAL_DOHYUN_CHARACTER_ID)
    assert.equal(secondReport.data.closingLine, '다 했네. 오늘 좀 열심히 했다? 수고했어.')
    assert.equal(store.data.records[0]!.characterIds[0], String(LOCAL_DOHYUN_CHARACTER_ID))
    assert.equal(store.data.records[0]!.roomId, String(LOCAL_DOHYUN_ROOM_ID))
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
