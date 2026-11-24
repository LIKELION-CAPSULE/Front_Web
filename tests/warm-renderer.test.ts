import test from 'node:test'
import assert from 'node:assert/strict'
import { canPrewarm, createWarmPool, warmKey, type AlivingSource, type WarmableRenderer } from '../src/features/mate-render/warm-renderer.ts'

const source: AlivingSource = { kind: 'aliving', modelUrl: '/m/model.json', engineUrl: '/e/engine.js', playerUrl: '/e/player.js' }

class FakeRenderer implements WarmableRenderer {
  status: 'loading' | 'ready' | 'error' = 'loading'
  calls: string[] = []
  getStatus() { return this.status }
  preload() { this.calls.push('preload') }
  detach() { this.calls.push('detach') }
  destroy() { this.calls.push('destroy') }
  setExpression(name: string | null) { this.calls.push(`expression:${name}`) }
  lookAt(x: number, y: number) { this.calls.push(`look:${x},${y}`) }
  setTalking(active: boolean) { this.calls.push(`talking:${active}`) }
}

function harness() {
  const created: FakeRenderer[] = []
  const timers = new Map<number, () => void>()
  let next = 0
  const pool = createWarmPool<FakeRenderer>({
    create: () => { const renderer = new FakeRenderer(); created.push(renderer); return renderer },
    ttlMs: 1000,
    setTimer: (callback) => { timers.set(++next, callback); return next },
    clearTimer: (timer) => { timers.delete(timer as number) },
  })
  return { pool, created, timers, fire: () => { for (const callback of [...timers.values()]) callback() } }
}

test('prewarm loads once offscreen and the same source claims it', () => {
  const { pool, created } = harness()
  const key = warmKey(source)
  assert.equal(pool.prewarm(source), true)
  assert.equal(pool.prewarm(source), false, 'already warm')
  assert.equal(created.length, 1)
  assert.deepEqual(created[0]!.calls.slice(0, 2), ['preload', 'detach'])
  assert.equal(pool.claim(warmKey({ ...source, modelUrl: '/other.json' })), null, 'another model never takes it')
  assert.equal(pool.claim(key), created[0])
  assert.equal(pool.claim(key), null, 'claimed once')
  assert.ok(!created[0]!.calls.includes('destroy'))
})

test('a warm renderer nobody claims is destroyed after the TTL, on discard, and when replaced', () => {
  const { pool, created, fire } = harness()
  pool.prewarm(source)
  fire()
  assert.ok(created[0]!.calls.includes('destroy'))
  assert.equal(pool.parkedKey(), null)

  pool.prewarm(source)
  pool.discard()
  assert.ok(created[1]!.calls.includes('destroy'))

  pool.prewarm(source)
  pool.prewarm({ ...source, modelUrl: '/second.json' })
  assert.ok(created[2]!.calls.includes('destroy'), 'one warm renderer at most')
  assert.equal(pool.parkedKey(), warmKey({ ...source, modelUrl: '/second.json' }))
})

test('a parked preview is reset to the neutral face; a broken one is destroyed instead of parked', () => {
  const { pool } = harness()
  const used = new FakeRenderer()
  used.status = 'ready'
  pool.park('k', used)
  assert.deepEqual(used.calls, ['detach', 'talking:false', 'expression:null', 'look:0,0'])
  assert.equal(pool.claim('k'), used)

  const broken = new FakeRenderer()
  broken.status = 'error'
  pool.park('k', broken)
  assert.deepEqual(broken.calls, ['destroy'])
  assert.equal(pool.claim('k'), null)
})

test('a source a preview is showing right now is not prewarmed again', () => {
  const { pool, created } = harness()
  const release = pool.markActive(warmKey(source))
  assert.equal(pool.prewarm(source), false)
  release()
  assert.equal(pool.prewarm(source), true)
  assert.equal(created.length, 1)
})

test('prewarming is skipped on phones, touch-first devices, Data Saver and reduced motion', () => {
  const env = (matches: string[], saveData = false) => ({ saveData, matchMedia: (query: string) => ({ matches: matches.includes(query) }) })
  assert.equal(canPrewarm(env([])), true)
  assert.equal(canPrewarm(env(['(max-width: 767px)'])), false)
  assert.equal(canPrewarm(env(['(pointer: coarse)'])), false)
  assert.equal(canPrewarm(env(['(prefers-reduced-motion: reduce)'])), false)
  assert.equal(canPrewarm(env([], true)), false)
  assert.equal(canPrewarm({}), false)
})
