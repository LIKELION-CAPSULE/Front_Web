import assert from 'node:assert/strict'
import test from 'node:test'
import { Live2DStage, type Live2DLayout } from '../src/features/live2d/live2d-stage.ts'

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
  try { run(fixture(() => notify(), layout)) }
  finally {
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
    get visible() { return visible },
    get attached() { return attached },
    get resizes() { return resizes },
  }
}

test('every frame of opening and closing chat retains a painted model on the same canvas', () => {
  withStage(view => {
    for (const width of [1184, 1150, 1090, 1000, 920, 864, 820, 800, 820, 864, 920, 1000, 1090, 1150, 1184, 1200]) {
      view.events.length = 0
      view.resize(width, 800)
      // A browser paint can happen immediately after ResizeObserver, before the next ticker.
      assert.equal(view.visible, true, `blank frame at ${width}px`)
      assert.deepEqual(view.events, ['resize', 'scale', 'position', 'render'])
      assert.equal(view.pose.x, width / 2)
      assert.equal(view.pose.y, 400)
      assert.equal(view.canvas.parentElement, view.host)
      assert.equal(Reflect.get(view.stage, 'status'), 'ready')
    }
    assert.equal(view.attached, 1)
  })
})

test('size updates repaint after applying the server scale and percentage offsets', () => {
  withStage(view => {
    view.resize(900, 600)
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
    assert.equal(view.visible, true)
    assert.equal(view.pose.x, 400)
  })
})
