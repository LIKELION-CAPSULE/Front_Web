import assert from 'node:assert/strict'
import test from 'node:test'
import { createScriptLoader, type ScriptLike } from '../src/features/mate-render/script-loader.ts'
import { toV2ExpressionName } from '../src/features/mate-render/expression-map.ts'

/**
 * DOM-free fakes for the v2 renderer: windows with their own requestAnimationFrame and ResizeObserver, documents,
 * hosts, a canvas and a player. They check the renderer's bookkeeping (which window drives frames, what is released);
 * real WebGL drawing is covered by the dev-server checks, not here.
 */
class FakeWindow {
  readonly name: string
  frames = new Map<number, (now: number) => void>()
  next = 1
  devicePixelRatio = 1
  observers: { observed: unknown[]; disconnected: boolean; fire: () => void }[] = []
  ResizeObserver: unknown
  constructor(name: string) {
    this.name = name
    const observers = this.observers
    this.ResizeObserver = class {
      observed: unknown[] = []
      disconnected = false
      private readonly callback: () => void
      constructor(callback: () => void) { this.callback = callback; observers.push(this) }
      fire() { this.callback() }
      observe(target: unknown) { this.observed.push(target) }
      disconnect() { this.disconnected = true }
    }
  }
  requestAnimationFrame = (callback: (now: number) => void) => { const id = this.next++; this.frames.set(id, callback); return id }
  cancelAnimationFrame = (id: number) => { this.frames.delete(id) }
  matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  flush(now = 16) { const list = [...this.frames.values()]; this.frames.clear(); for (const callback of list) callback(now) }
}

class FakeElement {
  parentElement: FakeHost | null = null
  style: Record<string, string> = {}
  dataset: Record<string, string> = {}
  ownerDocument: FakeDocument
  width = 0
  height = 0
  src = ''
  alt = ''
  readonly tag: string
  lost = 0
  constructor(tag: string, doc: FakeDocument) { this.tag = tag; this.ownerDocument = doc }
  setAttribute() {}
  remove() { this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null }
  getContext() { return { getExtension: () => ({ loseContext: () => { this.lost++ } }) } }
}

class FakeDocument {
  hidden = false
  defaultView: FakeWindow
  listeners = new Set<() => void>()
  constructor(view: FakeWindow) { this.defaultView = view }
  createElement(tag: string) { return new FakeElement(tag, this) }
  addEventListener(_type: string, listener: () => void) { this.listeners.add(listener) }
  removeEventListener(_type: string, listener: () => void) { this.listeners.delete(listener) }
}

class FakeHost {
  children: FakeElement[] = []
  clientWidth = 800
  clientHeight = 600
  ownerDocument: FakeDocument
  constructor(doc: FakeDocument) { this.ownerDocument = doc }
  append(element: FakeElement) { element.remove(); element.parentElement = this; this.children.push(element) }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight } }
}

function fakePlayer(main: FakeWindow) {
  const calls = { frames: 0, destroyed: 0, talks: [] as number[], stops: 0, expressions: [] as string[] }
  let throwOnFrame = false
  const player = {
    model: { background: [1, 1, 1, 1] as [number, number, number, number], setView() {}, draw() {} },
    running: true, raf: 0, last: 0,
    frame() { if (throwOnFrame) throw new Error('GL lost'); calls.frames++ },
    setExpression(name: string) { calls.expressions.push(name); return true },
    playMotion() { return true },
    talk(ms: number) { calls.talks.push(ms); return true },
    stopMotion() { calls.stops++ },
    lookAt() {}, setView() {},
    tracked: [] as Record<string, number>[],
    track(params: Record<string, number>) { player.tracked.push(params) },
    destroy() { calls.destroyed++; player.running = false },
  }
  // The real player starts its own loop on the main window when it is created.
  player.raf = main.requestAnimationFrame(() => {})
  return { player, calls, breakFrames: () => { throwOnFrame = true } }
}

async function setup() {
  const main = new FakeWindow('main'), pip = new FakeWindow('pip')
  const mainDoc = new FakeDocument(main), pipDoc = new FakeDocument(pip)
  const g = globalThis as Record<string, unknown>
  const saved = { window: g.window, document: g.document, ResizeObserver: g.ResizeObserver }
  g.window = main
  g.document = mainDoc
  g.ResizeObserver = main.ResizeObserver
  const restore = () => { g.window = saved.window; g.document = saved.document; g.ResizeObserver = saved.ResizeObserver }
  const { AlivingRenderer } = await import('../src/features/mate-render/AlivingRenderer.ts')
  const { AlivingSessionStage } = await import('../src/features/mate-render/AlivingSessionStage.ts')
  return { main, pip, mainDoc, pipDoc, restore, AlivingRenderer, AlivingSessionStage }
}

const source = { kind: 'aliving' as const, modelUrl: '/m/model.json', engineUrl: '/e/engine.js', playerUrl: '/e/player.js' }
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

test('the canvas moves to a PiP window and back on one player: frames and resize observation follow the host window', async () => {
  const env = await setup()
  try {
    const made = fakePlayer(env.main)
    let creates = 0
    const renderer = new env.AlivingRenderer({
      ...source, loadScript: async () => {}, getPlayer: () => ({ create: async () => { creates++; return made.player as never } }),
    })
    const mainHost = new FakeHost(env.mainDoc), pipHost = new FakeHost(env.pipDoc)
    renderer.attach(mainHost as never)
    await settle()
    assert.equal(renderer.getStatus(), 'ready')
    env.main.flush()
    assert.equal(made.calls.frames, 1, 'frames run on the main window')

    renderer.attach(pipHost as never)
    assert.equal(env.main.frames.size, 0, 'the main window loop is cancelled')
    env.pip.flush()
    env.pip.flush()
    assert.equal(made.calls.frames, 3, 'frames run on the PiP window')
    assert.equal(env.pip.observers.length, 1, 'the PiP host is observed by a PiP-window ResizeObserver')
    assert.equal(env.main.observers.at(-1)?.disconnected, true)
    // Hiding the original tab does not stop the PiP loop.
    env.mainDoc.hidden = true
    for (const listener of env.mainDoc.listeners) listener()
    env.pip.flush()
    assert.equal(made.calls.frames, 4)
    // A PiP resize reaches the renderer through the PiP window's observer.
    pipHost.clientWidth = 320
    env.pip.observers[0]!.fire()

    env.mainDoc.hidden = false
    renderer.attach(mainHost as never)
    assert.equal(env.pip.frames.size, 0, 'the PiP loop is cancelled on return')
    env.main.flush()
    assert.equal(made.calls.frames, 5)
    assert.equal(creates, 1, 'moving never recreates the player')

    // Destroy while drawing in PiP: the loop on that window is cancelled before the player is dropped.
    renderer.attach(pipHost as never)
    renderer.destroy()
    assert.equal(env.pip.frames.size, 0)
    assert.equal(made.calls.destroyed, 1)
    renderer.destroy()
    assert.equal(made.calls.destroyed, 1, 'destroy is idempotent')
  } finally { env.restore() }
})

test('track forwards a pose to the player only while ready, and never after destroy', async () => {
  const env = await setup()
  try {
    const made = fakePlayer(env.main)
    let resolveCreate: (player: never) => void = () => {}
    const renderer = new env.AlivingRenderer({
      ...source, loadScript: async () => {}, getPlayer: () => ({ create: () => new Promise(resolve => { resolveCreate = resolve }) }),
    })
    renderer.attach(new FakeHost(env.mainDoc) as never)
    await settle()
    assert.equal(renderer.canTrack(), false)
    assert.equal(renderer.track({ ParamEyeLOpen: 0 }), false, 'nothing to drive while loading')
    resolveCreate(made.player as never)
    await settle()
    assert.equal(renderer.canTrack(), true)
    assert.equal(renderer.track({ ParamEyeLOpen: 0, ParamAngleY: -20 }), true)
    assert.deepEqual(made.player.tracked, [{ ParamEyeLOpen: 0, ParamAngleY: -20 }])
    renderer.destroy()
    assert.equal(renderer.track({ ParamEyeLOpen: 1 }), false)
    assert.equal(made.player.tracked.length, 1)
  } finally {
    env.restore()
  }
})

test('a player created after the renderer was destroyed is released and never becomes ready', async () => {
  const env = await setup()
  try {
    const made = fakePlayer(env.main)
    let finish: () => void = () => {}
    const renderer = new env.AlivingRenderer({
      ...source, loadScript: async () => {},
      getPlayer: () => ({ create: () => new Promise(resolve => { finish = () => resolve(made.player as never) }) }),
    })
    renderer.attach(new FakeHost(env.mainDoc) as never)
    await settle()
    renderer.destroy()
    finish()
    await settle()
    assert.equal(made.calls.destroyed, 1)
    assert.equal(renderer.getStatus(), 'loading')
  } finally { env.restore() }
})

test('destroying while scripts load ends this renderer\'s wait through its abort signal', async () => {
  const env = await setup()
  try {
    let signal: AbortSignal | undefined
    let creates = 0
    const renderer = new env.AlivingRenderer({
      ...source,
      loadScript: (_url, s) => { signal = s; return new Promise((_resolve, reject) => s?.addEventListener('abort', () => reject(new Error('aborted')))) },
      getPlayer: () => ({ create: async () => { creates++; return fakePlayer(env.main).player as never } }),
    })
    renderer.preload()
    renderer.destroy()
    await settle()
    assert.equal(signal?.aborted, true)
    assert.equal(creates, 0)
  } finally { env.restore() }
})

test('a frame that throws stops the loop and reports error (the screen shows the still image)', async () => {
  const env = await setup()
  try {
    const made = fakePlayer(env.main)
    const renderer = new env.AlivingRenderer({ ...source, loadScript: async () => {}, getPlayer: () => ({ create: async () => made.player as never }) })
    renderer.attach(new FakeHost(env.mainDoc) as never)
    await settle()
    made.breakFrames()
    const original = console.warn
    console.warn = () => {}
    try { env.main.flush() } finally { console.warn = original }
    assert.equal(renderer.getStatus(), 'error')
    assert.equal(env.main.frames.size, 0, 'no further frame is scheduled')
    renderer.destroy()
  } finally { env.restore() }
})

test('talking follows on/off: a chunk plays once ready, turning it off stops the motion', async () => {
  const env = await setup()
  try {
    const made = fakePlayer(env.main)
    const renderer = new env.AlivingRenderer({ ...source, loadScript: async () => {}, getPlayer: () => ({ create: async () => made.player as never }) })
    renderer.setTalking(true)
    renderer.attach(new FakeHost(env.mainDoc) as never)
    await settle()
    assert.equal(made.calls.talks.length, 1, 'talking requested before ready starts when the model is ready')
    renderer.setTalking(false)
    assert.equal(made.calls.stops, 1)
    assert.equal(renderer.isTalking(), false)
    renderer.destroy()
  } finally { env.restore() }
})

test('the session stage keeps one model across PiP moves and swaps in the still image if drawing breaks later', async () => {
  const env = await setup()
  try {
    const made = fakePlayer(env.main)
    let creates = 0
    const stage = new env.AlivingSessionStage(source, {
      stillImage: '/still.webp', loadScript: async () => {},
      getPlayer: () => ({ create: async () => { creates++; return made.player as never } }),
    })
    await settle()
    assert.equal(stage.getStatus(), 'ready', 'preloads before any host')
    const mainHost = new FakeHost(env.mainDoc), pipHost = new FakeHost(env.pipDoc)
    stage.attach(mainHost as never)
    stage.attach(pipHost as never)
    assert.equal(pipHost.children.length, 1)
    assert.equal(mainHost.children.length, 0)
    assert.equal(env.pip.observers.length >= 1, true, 'the stage observes the PiP host from the PiP window')
    stage.detach(pipHost as never)
    assert.equal(mainHost.children.length, 1)
    assert.equal(creates, 1)

    let notified = 0
    stage.subscribe(() => notified++)
    made.breakFrames()
    const original = console.warn
    console.warn = () => {}
    try { env.main.flush() } finally { console.warn = original }
    assert.equal(stage.getStatus(), 'ready', 'a live model that broke keeps the stage visible')
    assert.equal(stage.isDegraded(), true)
    assert.equal(notified, 0)
    assert.deepEqual(mainHost.children.map(child => [child.tag, child.src]), [['img', '/still.webp']])
    // The still follows the stage into PiP and back.
    stage.attach(pipHost as never)
    assert.deepEqual(pipHost.children.map(child => child.tag), ['img'])
    assert.equal(mainHost.children.length, 0)
    stage.destroy()
    assert.equal(pipHost.children.length, 0)
    assert.equal(made.calls.destroyed, 1)
  } finally { env.restore() }
})

test('the script loader times out a stalled request, forgets it, and a retry starts a fresh script', async () => {
  const scripts: (ScriptLike & { removed: boolean })[] = []
  const timers: (() => void)[] = []
  const loader = createScriptLoader({
    host: () => ({
      createScript: () => {
        const script = { src: '', async: true, onload: null, onerror: null, removed: false, remove() { this.removed = true } } as ScriptLike & { removed: boolean }
        scripts.push(script)
        return script
      },
      append() {},
    }),
    setTimer: callback => { timers.push(callback); return timers.length },
    clearTimer: () => {},
  })
  const first = loader.load('/engine.js')
  const again = loader.load('/engine.js')
  assert.equal(scripts.length, 1, 'concurrent callers share one request')
  timers[0]!()
  await assert.rejects(first, /제한 시간/)
  await assert.rejects(again, /제한 시간/)
  assert.equal(scripts[0]!.removed, true)
  assert.equal(loader.pending('/engine.js'), false)

  const retry = loader.load('/engine.js')
  assert.equal(scripts.length, 2, 'the retry does not reuse the stalled promise')
  scripts[1]!.onload?.()
  await retry
  // A late timer for a finished load does nothing; the success stays shared.
  timers[1]!()
  await loader.load('/engine.js')
  assert.equal(scripts.length, 2)
  assert.equal(scripts[1]!.removed, false)

  // An error is forgotten too.
  const failed = loader.load('/player.js')
  scripts[2]!.onerror?.()
  await assert.rejects(failed, /불러오지 못했어요/)
  assert.equal(loader.pending('/player.js'), false)

  // A caller's abort ends only that caller's wait.
  const controller = new AbortController()
  const mine = loader.load('/reactions.js', controller.signal)
  const other = loader.load('/reactions.js')
  controller.abort()
  await assert.rejects(mine, /취소/)
  scripts[3]!.onload?.()
  await other
  await assert.rejects(loader.load('/x.js', controller.signal), /취소/)
})

test('toV2ExpressionName ignores non-string and prototype-named values instead of throwing', () => {
  for (const value of [42, {}, [], true, Symbol('x')]) assert.equal(toV2ExpressionName(value), undefined)
  for (const value of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'files/constructor']) {
    assert.equal(toV2ExpressionName(value), undefined, value)
  }
  assert.equal(toV2ExpressionName(undefined), null)
  assert.equal(toV2ExpressionName(null), null)
  assert.equal(toV2ExpressionName(' 삐짐 '), 'sulky')
  assert.equal(toV2ExpressionName('files/004.exp3.json'), 'sulky')
})
