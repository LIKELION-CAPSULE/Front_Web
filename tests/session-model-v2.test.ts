import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionModel, type AlivingSessionSource, type SessionModelStage } from '../src/features/live2d/session-model.ts'
import { ExpressionDirector } from '../src/features/live2d/expression-director.ts'
import { TALK_MAX_MS, TALK_MIN_MS, talkDurationMs } from '../src/features/live2d/talk-duration.ts'
import { CHAERIN_V2_LANDMARKS, CHAERIN_V2_RENDERS, computeCallView, computeContainedImageBox, modelPointToScreen } from '../src/features/mate-render/aliving-view.ts'

function fakeStage(extra: Partial<SessionModelStage> = {}) {
  let status: ReturnType<SessionModelStage['getStatus']> = 'loading'
  let destroyed = 0
  const listeners = new Set<() => void>()
  const expressions: (string | null)[] = []
  const stage: SessionModelStage = {
    getStatus: () => status,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    attach: () => {}, detach: () => {}, setTracking: () => {}, setExpression: value => { expressions.push(value) },
    destroy: () => { destroyed++; listeners.clear() },
    ...extra,
  }
  return {
    stage, expressions,
    setStatus(next: typeof status) { status = next; for (const listener of listeners) listener() },
    get destroyed() { return destroyed },
  }
}

const allowlist = () => ({ pageOrigin: 'https://app.capsule.kr', apiBaseUrl: 'https://api.capsule.kr' })
const v2 = {
  format: 'aliving2d',
  modelJsonUrl: 'https://api.capsule.kr/m/chaerin/model.json',
  engineUrl: 'https://api.capsule.kr/engine/v4/engine.js',
  reactionsUrl: 'https://api.capsule.kr/engine/v4/reactions.json',
}

test('v2 figures use the v2 factory with the resolved engine URLs and reuse the prepared stage', async () => {
  const model = fakeStage()
  const sources: AlivingSessionSource[] = []
  let legacy = 0
  const loader = new SessionModel(() => { legacy++; return fakeStage().stage }, 60_000, {
    allowlist, createAliving: source => { sources.push(source); return model.stage },
  })
  const entry = loader.prepare(v2)
  model.setStatus('ready')
  assert.equal(await entry, model.stage)
  assert.equal(await loader.prepare(v2), model.stage)
  assert.equal(sources.length, 1)
  assert.equal(legacy, 0)
  assert.deepEqual(sources[0], {
    kind: 'aliving', modelUrl: v2.modelJsonUrl, engineUrl: v2.engineUrl,
    playerUrl: 'https://api.capsule.kr/engine/v4/player.js', reactionsUrl: v2.reactionsUrl,
  })
  loader.release()
  assert.equal(model.destroyed, 1)
})

test('a v2 model that cannot load degrades to the still image (null) instead of blocking the connection', async () => {
  const failed = fakeStage()
  const loader = new SessionModel(() => fakeStage().stage, 60_000, { allowlist, createAliving: () => failed.stage })
  const entry = loader.prepare(v2)
  failed.setStatus('error')
  assert.equal(await entry, null)
  assert.equal(failed.destroyed, 1)

  const stalled = fakeStage()
  const slow = new SessionModel(() => fakeStage().stage, 60_000, { allowlist, createAliving: () => stalled.stage, alivingTimeoutMs: 5 })
  assert.equal(await slow.prepare(v2), null)
  assert.equal(stalled.destroyed, 1)
})

test('v2 without an engine URL, or with one on a foreign origin, shows the still image without loading anything', async () => {
  let creates = 0
  const loader = new SessionModel(() => { creates++; return fakeStage().stage }, 60_000, {
    allowlist, createAliving: () => { creates++; return fakeStage().stage },
  })
  assert.equal(await loader.prepare({ modelJsonUrl: v2.modelJsonUrl }), null)
  assert.equal(await loader.prepare({ ...v2, engineUrl: 'https://cdn.example.com/engine.js' }), null)
  assert.equal(await loader.prepare({ ...v2, engineUrl: 42 }), null)
  assert.equal(creates, 0)
  // No model at all still blocks entry (unchanged contract)
  await assert.rejects(loader.prepare({}), /모델 정보/)
})

test('a newer preparation cancels a pending v2 stage: the old entry rejects and the stage is destroyed', async () => {
  const first = fakeStage(), second = fakeStage()
  let calls = 0
  const loader = new SessionModel(() => second.stage, 60_000, { allowlist, createAliving: () => (++calls === 1 ? first.stage : second.stage) })
  const old = loader.prepare(v2)
  const rejection = assert.rejects(old, /취소/)
  const next = loader.prepare({ modelJsonUrl: '/friend.model3.json' })
  await rejection
  second.setStatus('ready')
  assert.equal(await next, second.stage)
  assert.equal(first.destroyed, 1)
  loader.release()
})

test('the director keys v2 faces by name, keeps Cubism keyed by file, and talks while a line shows', () => {
  const g = globalThis as unknown as { window?: unknown }
  const hadWindow = 'window' in g
  if (!hadWindow) g.window = globalThis
  try {
    const talks: number[] = []
    const v2Stage = fakeStage({
      expressionKey: expression => (expression?.name === '삐짐' ? 'sulky' : expression?.file === 'files/009.exp3.json' ? 'laugh' : null),
      talk: ms => { talks.push(ms) },
    })
    let now = 0
    const director = new ExpressionDirector(() => now)
    director.setStage(v2Stage.stage)
    director.cue({ characterId: 1, expression: { name: '삐짐' }, event: 'MESSAGE', stage: 'speech', text: '어디 갔어?' })
    assert.equal(v2Stage.expressions.at(-1), 'sulky')
    assert.deepEqual(talks, [talkDurationMs('어디 갔어?')])
    now = 10_000
    director.cue({ characterId: 1, expression: { file: 'files/009.exp3.json' }, event: 'MESSAGE', stage: 'speech', text: '좋아' })
    assert.equal(v2Stage.expressions.at(-1), 'laugh')
    // A notice (no line) never talks
    director.cue({ characterId: 1, expression: { name: '삐짐' }, event: 'WAVE', stage: 'notice' })
    assert.equal(talks.length, 2)
    director.dispose()

    const cubism = fakeStage()
    const legacy = new ExpressionDirector(() => 0)
    legacy.setStage(cubism.stage)
    legacy.cue({ characterId: 1, expression: { name: '삐짐' }, event: 'MESSAGE', stage: 'speech', text: '응' })
    assert.deepEqual(cubism.expressions, [null], 'a name without a file draws nothing on Cubism')
    legacy.cue({ characterId: 1, expression: { file: 'exp/a.exp3.json' }, event: 'MESSAGE', stage: 'speech', text: '응' })
    assert.equal(cubism.expressions.at(-1), 'exp/a.exp3.json')
    legacy.dispose()
  } finally {
    if (!hadWindow) delete g.window
  }
})

test('talkDurationMs follows the bubble typing pace and stays within bounds', () => {
  assert.equal(talkDurationMs(''), 0)
  assert.equal(talkDurationMs(null), 0)
  assert.equal(talkDurationMs('응'), TALK_MIN_MS)
  assert.equal(talkDurationMs('안녕하세요 반가워요'), Math.max(TALK_MIN_MS, 9 * 45 + 20))
  assert.equal(talkDurationMs('가'.repeat(500)), TALK_MAX_MS)
})

test('computeCallView matches the card still (contain, bottom) on wide call tiles and small PiP windows', () => {
  const card = CHAERIN_V2_RENDERS.card
  for (const [cw, ch] of [[1200, 600], [880, 560], [320, 240], [300, 420]]) {
    const view = computeCallView(cw!, ch!)
    const box = computeContainedImageBox(cw!, ch!, card.size.width, card.size.height, 1)
    const live = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.eyesY, cw!, ch!, view)
    const still = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.eyesY, card.size.width, card.size.height, card.view)
    const scale = box.width / card.size.width
    assert.ok(Math.abs(live.x - (box.left + still.x * scale)) < 1e-6, `x ${cw}x${ch}`)
    assert.ok(Math.abs(live.y - (box.top + still.y * scale)) < 1e-6, `y ${cw}x${ch}`)
  }
})
