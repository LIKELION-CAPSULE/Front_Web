import assert from 'node:assert/strict'
import test from 'node:test'
import { SessionModel, type SessionModelStage } from '../src/features/live2d/session-model.ts'

function fakeStage() {
  let status: ReturnType<SessionModelStage['getStatus']> = 'loading'
  let destroyed = 0
  const listeners = new Set<() => void>()
  const stage: SessionModelStage = {
    getStatus: () => status,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    attach: () => {}, detach: () => {}, setTracking: () => {}, setExpression: () => {},
    destroy: () => { destroyed++; listeners.clear() },
  }
  return {
    stage,
    setStatus(next: typeof status) { status = next; for (const listener of listeners) listener() },
    get destroyed() { return destroyed },
    get listeners() { return listeners.size },
  }
}

test('entry waits for the complete model and reuses the prepared stage on the study screen', async () => {
  const model = fakeStage()
  let creates = 0, ready = false
  const loader = new SessionModel(() => { creates++; return model.stage })
  const entry = loader.prepare({ modelJsonUrl: '/friend.model3.json' }).then(stage => { ready = true; return stage })
  await Promise.resolve()
  assert.equal(ready, false)
  model.setStatus('ready')
  assert.equal(await entry, model.stage)
  assert.equal(await loader.prepare({ modelJsonUrl: '/friend.model3.json' }), model.stage)
  assert.equal(creates, 1)
  assert.equal(model.listeners, 0)
  loader.release()
  assert.equal(model.destroyed, 1)
})

test('missing model metadata blocks entry without creating a fallback', async () => {
  let creates = 0
  const loader = new SessionModel(() => { creates++; return fakeStage().stage })
  await assert.rejects(loader.prepare(undefined), /모델 정보/)
  await assert.rejects(loader.prepare({}), /모델 정보/)
  assert.equal(creates, 0)
})

test('a failed model is destroyed and a retry prepares a fresh model', async () => {
  const failed = fakeStage(), retry = fakeStage()
  let creates = 0
  const loader = new SessionModel(() => ++creates === 1 ? failed.stage : retry.stage)
  const entry = loader.prepare({ modelJsonUrl: '/friend.model3.json' })
  const rejection = assert.rejects(entry, /불러오지 못했어요/)
  failed.setStatus('error')
  await rejection
  assert.equal(failed.destroyed, 1)
  const next = loader.prepare({ modelJsonUrl: '/friend.model3.json' })
  retry.setStatus('ready')
  assert.equal(await next, retry.stage)
  loader.release()
})

test('leaving during loading cancels the entry and releases its pending model', async () => {
  const model = fakeStage()
  const loader = new SessionModel(() => model.stage)
  const entry = loader.prepare({ modelJsonUrl: '/friend.model3.json' })
  const rejection = assert.rejects(entry, /취소/)
  loader.release()
  await rejection
  model.setStatus('ready')
  assert.equal(model.destroyed, 1)
  assert.equal(model.listeners, 0)
})

test('a stalled load times out, releases resources, and leaves the action available for retry', async () => {
  const model = fakeStage()
  const loader = new SessionModel(() => model.stage, 5)
  await assert.rejects(loader.prepare({ modelJsonUrl: '/friend.model3.json' }), /다시 시도/)
  assert.equal(model.destroyed, 1)
  assert.equal(model.listeners, 0)
})

test('changing model or layout cancels the previous preparation and uses safe layout values', async () => {
  const first = fakeStage(), second = fakeStage()
  const layouts: unknown[] = []
  const loader = new SessionModel((_url, layout) => { layouts.push(layout); return layouts.length === 1 ? first.stage : second.stage })
  const old = loader.prepare({ modelJsonUrl: '/first.model3.json' })
  const rejection = assert.rejects(old, /취소/)
  const next = loader.prepare({ modelJsonUrl: '/second.model3.json', scale: -1, offsetX: Infinity, offsetY: 12 })
  await rejection
  second.setStatus('ready')
  assert.equal(await next, second.stage)
  assert.deepEqual(layouts[1], { scale: 1, offsetX: 0, offsetY: 12 })
  assert.equal(first.destroyed, 1)
  loader.release()
})
