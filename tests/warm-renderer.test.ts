import test from 'node:test'
import assert from 'node:assert/strict'
import { accountEnded, accountKey, canPrewarm, createWarmPool, warmKey, type AlivingSource, type WarmableRenderer } from '../src/features/mate-render/warm-renderer.ts'
import { resolveMateSource, resolvePreviewSource } from '../src/features/mate-render/mate-source.ts'

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

test('login hand-over: the wake-up renderer is parked and the mate preview with the same source takes it', () => {
  const { pool, created, fire } = harness()
  const v2 = {
    modelJsonUrl: '/__local-assets/chaerin-v2/model/model.json',
    engineUrl: '/__local-assets/chaerin-v2/engine/engine.js',
    playerUrl: '/__local-assets/chaerin-v2/engine/player.js',
    reactionsUrl: '/__local-assets/chaerin-v2/engine/reactions.default.json',
  }
  const options = { pageOrigin: 'http://local.test' }
  // Login resolves its source with resolveMateSource; the mate screens with resolvePreviewSource (API `model`).
  const login = resolveMateSource({ modelUrl: v2.modelJsonUrl, engineUrl: v2.engineUrl, playerUrl: v2.playerUrl, reactionsUrl: v2.reactionsUrl }, options)
  const mate = resolvePreviewSource({ ...v2, format: 'aliving2d' }, options)
  assert.equal(login.kind, 'aliving')
  assert.equal(mate.kind, 'aliving')
  if (login.kind !== 'aliving' || mate.kind !== 'aliving') return
  assert.equal(warmKey(login), warmKey(mate), 'same files → same key')

  const wakeUp = new FakeRenderer()
  wakeUp.status = 'ready'
  wakeUp.calls.push('expression:happy', 'look:0.22,0') // what the login screen left on it
  pool.park(warmKey(login), wakeUp)
  assert.deepEqual(wakeUp.calls.slice(2), ['detach', 'talking:false', 'expression:null', 'look:0,0'], 'detached and reset')
  assert.equal(pool.prewarm(mate), false, 'home does not load a second copy')
  assert.equal(created.length, 0)
  assert.equal(pool.claim(warmKey(mate)), wakeUp, 'the mate preview takes the login renderer')
  assert.ok(!wakeUp.calls.includes('destroy'))

  // Different API files (another model or engine build): nothing is taken; home's prewarm replaces it and the login
  // renderer is destroyed (or the TTL does it when nothing prewarms).
  const other = { ...mate, engineUrl: '/cdn/engine-2.js' }
  const leftOver = new FakeRenderer()
  pool.park(warmKey(login), leftOver)
  assert.equal(pool.claim(warmKey(other)), null)
  pool.prewarm(other)
  assert.ok(leftOver.calls.includes('destroy'), 'replaced by the API model')
  const unclaimed = new FakeRenderer()
  pool.park(warmKey(login), unclaimed)
  fire()
  assert.ok(unclaimed.calls.includes('destroy'), 'TTL')

  // Logging out drops it.
  const loggedOut = new FakeRenderer()
  pool.park(warmKey(login), loggedOut)
  pool.discard()
  assert.ok(loggedOut.calls.includes('destroy'))
})

test('logout drops the warm renderer at once and refuses parks from previews created before it', () => {
  const { pool, created } = harness()
  // Signed in: the home prewarm and a 내 메이트 preview, both of generation 0.
  pool.prewarm(source)
  const owner = pool.generation()
  const preview = pool.claim(warmKey(source))!
  // RequireDemo sees the account end (logout routing swaps the screens for <Navigate>) and invalidates first …
  pool.invalidate()
  assert.equal(pool.parkedKey(), null)
  // … then the unmounted preview's cleanup tries to park: refused and destroyed, nothing stays for the next account.
  pool.park(warmKey(source), preview, owner)
  assert.ok(preview.calls.includes('destroy'))
  assert.equal(pool.parkedKey(), null)
  assert.equal(pool.claim(warmKey(source)), null)
  // A renderer of the new generation (the next login screen) parks normally.
  const next = new FakeRenderer()
  pool.park(warmKey(source), next, pool.generation())
  assert.equal(pool.claim(warmKey(source)), next)
  assert.equal(created.length, 1)
})

test('only the end of a signed-in account invalidates, not signing in', () => {
  const signedOut = accountKey({ loggedIn: false, userId: 7 })
  const signedIn = accountKey({ loggedIn: true, userId: 7 })
  assert.equal(signedOut, null)
  assert.equal(accountEnded(signedOut, signedIn), false, 'login keeps the login screen hand-over')
  assert.equal(accountEnded(signedIn, signedIn), false)
  assert.equal(accountEnded(signedIn, signedOut), true, 'logout / withdrawal / expired session')
  assert.equal(accountEnded(signedIn, accountKey({ loggedIn: true, userId: 8 })), true, 'another account')
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
