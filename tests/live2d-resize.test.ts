import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { Live2DStage, RESIZE_SETTLE_MS, type Live2DLayout } from '../src/features/live2d/live2d-stage.ts'

/** Use the real attachment/resize path without loading Cubism or opening a GPU context. */
function withStage(run: (view: ReturnType<typeof fixture>) => void, layout: Live2DLayout = { scale: 1, offsetX: 0, offsetY: 0 }) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver')
  let notify = () => {}
  class Observer {
    constructor(callback: () => void) { notify = callback }
    observe() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: Observer })
  mock.timers.enable({ apis: ['setTimeout'] })
  try { run(fixture(() => notify(), layout)) }
  finally {
    mock.timers.reset()
    if (previous) Object.defineProperty(globalThis, 'ResizeObserver', previous)
    else Reflect.deleteProperty(globalThis, 'ResizeObserver')
  }
}

function fixture(notify: () => void, layout: Live2DLayout) {
  let visible = false
  let attached = 0
  let resizes = 0
  const events: string[] = []
  const pose = { scale: 0, anchorX: 0, anchorY: 0, x: 0, y: 0 }
  const canvas = { parentElement: null as unknown, remove() { this.parentElement = null } }
  const host = {
    clientWidth: 1200, clientHeight: 800,
    append(child: typeof canvas) { attached++; child.parentElement = this },
  }
  const app = {
    canvas,
    ticker: { start() {}, stop() {} },
    renderer: {
      width: 1, height: 1,
      resize(width: number, height: number) {
        this.width = width; this.height = height
        visible = false // Writing canvas dimensions discards the previous frame.
        resizes++
        events.push('resize')
      },
    },
    render() {
      events.push('render')
      assert.ok(pose.scale > 0)
      visible = true
    },
  }
  const model = {
    internalModel: { originalWidth: 1000, originalHeight: 1500 },
    scale: { set(value: number) { pose.scale = value; events.push('scale') } },
    anchor: { set(x: number, y: number) { pose.anchorX = x; pose.anchorY = y } },
    position: { set(x: number, y: number) { pose.x = x; pose.y = y; events.push('position') } },
  }
  // Constructor bootstrapping is covered by session-model tests; inject a prepared stage.
  const stage = Object.create(Live2DStage.prototype) as Live2DStage
  Object.assign(stage, {
    app, model, layout, hosts: [], observer: null, status: 'ready', listeners: new Set(),
  })
  stage.attach(host as unknown as HTMLElement)
  return {
    stage, host, canvas, app, pose, events,
    resize(width: number, height: number) { host.clientWidth = width; host.clientHeight = height; notify() },
    settle() { mock.timers.tick(RESIZE_SETTLE_MS) },
    get visible() { return visible },
    get attached() { return attached },
    get resizes() { return resizes },
  }
}

test('every frame of opening and closing chat retains a painted model without reallocating the buffer', () => {
  withStage(view => {
    const resized = view.resizes
    for (const width of [1184, 1150, 1090, 1000, 920, 864, 820, 800, 820, 864, 920, 1000, 1090, 1150, 1184, 1200]) {
      view.events.length = 0
      view.resize(width, 800)
      // A browser paint can happen immediately after ResizeObserver, before the next ticker.
      assert.equal(view.visible, true, `blank frame at ${width}px`)
      assert.deepEqual(view.events, ['scale', 'position', 'render'], `buffer reallocated at ${width}px`)
      // The kept 1200px buffer is centered on the tile, so the model stays on the tile's center.
      assert.equal(view.pose.x, 600)
      assert.equal(view.pose.y, 400)
      assert.equal(view.canvas.parentElement, view.host)
      assert.equal(Reflect.get(view.stage, 'status'), 'ready')
    }
    assert.equal(view.resizes, resized)
    assert.equal(view.attached, 1)
  })
})

test('the buffer resizes once after the size settles and repaints in the same step', () => {
  withStage(view => {
    const resized = view.resizes
    view.resize(1000, 800)
    view.resize(820, 800)
    view.events.length = 0
    view.settle()
    assert.equal(view.resizes, resized + 1)
    assert.deepEqual(view.events, ['resize', 'scale', 'position', 'render'])
    assert.equal(view.visible, true)
    assert.equal(view.pose.x, 410)
    assert.equal(view.app.renderer.width, 820)
  })
})

test('size updates repaint after applying the server scale and percentage offsets', () => {
  withStage(view => {
    view.resize(900, 600)
    view.settle()
    assert.equal(view.pose.scale, Math.min(900 / 1000, 600 / 1500) * 1.2)
    assert.equal(view.pose.anchorX, 0.5)
    assert.equal(view.pose.anchorY, 0.5)
    assert.equal(view.pose.x, 900 / 2 + 90)
    assert.equal(view.pose.y, 600 / 2 - 30)
    assert.equal(view.visible, true)
  }, { scale: 1.2, offsetX: 10, offsetY: -5 })
})

test('duplicate size notifications do not clear the canvas again', () => {
  withStage(view => {
    const resized = view.resizes
    for (let i = 0; i < 5; i++) view.resize(1200, 800)
    assert.equal(view.resizes, resized)
    assert.equal(view.visible, true)
  })
})

test('a transient hidden host keeps its last frame until its next nonzero size', () => {
  withStage(view => {
    const resized = view.resizes
    const pose = { ...view.pose }
    view.resize(0, 0)
    view.resize(0, 800)
    view.resize(1200, 0)
    assert.equal(view.resizes, resized)
    assert.deepEqual(view.pose, pose)
    assert.equal(view.visible, true)
    view.resize(800, 600)
    view.settle()
    assert.equal(view.visible, true)
    assert.equal(view.pose.x, 400)
  })
})

test('PiP moves the same canvas and drives its ticker on the PiP window, then restores the original ticker', () => {
  withStage(view => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0, updates = 0, starts = 0
    const pipWindow = {
      requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++id, callback); return id },
      cancelAnimationFrame(value: number) { frames.delete(value) },
    }
    const pipHost = {
      clientWidth: 360, clientHeight: 400,
      ownerDocument: { defaultView: pipWindow },
      append(canvas: typeof view.canvas) { canvas.parentElement = this },
    } as unknown as HTMLElement
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
    Object.assign(view.app.ticker, { start() { starts++ }, update() { updates++ } })
    try {
      view.stage.attach(pipHost)
      assert.equal(view.canvas.parentElement, pipHost)
      assert.equal(frames.size, 1)
      const frameId = frames.keys().next().value!
      const frame = frames.get(frameId)!
      frames.delete(frameId)
      frame(performance.now())
      assert.equal(updates, 1)
      assert.equal(frames.size, 1)
      view.stage.detach(pipHost)
      assert.equal(view.canvas.parentElement, view.host)
      assert.equal(frames.size, 0)
      assert.equal(starts, 1)
      frame(performance.now())
      assert.equal(updates, 1, 'an obsolete PiP frame must not restart the loop')
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
      else Reflect.deleteProperty(globalThis, 'window')
    }
  })
})
