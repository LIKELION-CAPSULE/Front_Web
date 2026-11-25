import test from 'node:test'
import assert from 'node:assert/strict'
import { listenAll, startFrameLoop, watchShaderCanvas } from '../src/features/auth/login-variants/doze/doze-runtime.ts'
import { recoverFromLiveLoss } from '../src/features/auth/login-variants/doze/doze-motion.ts'
import { ChunkBoundary } from '../src/features/auth/login-variants/doze/ChunkBoundary.ts'

class FakeFrames {
  next = 1
  pending = new Map<number, (now: number) => void>()
  requestAnimationFrame = (callback: (now: number) => void) => {
    const id = this.next++
    this.pending.set(id, callback)
    return id
  }
  cancelAnimationFrame = (id: number) => {
    this.pending.delete(id)
  }
  flush(now: number) {
    const due = [...this.pending.values()]
    this.pending.clear()
    for (const callback of due) callback(now)
  }
}

class FakeTarget {
  listeners = new Map<string, Set<EventListener>>()
  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }
  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }
  count() {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0)
  }
  dispatch(type: string) {
    let prevented = false
    const event = { type, preventDefault: () => { prevented = true } } as unknown as Event
    for (const listener of this.listeners.get(type) ?? []) listener(event)
    return prevented
  }
}

class FakeTimers {
  next = 1
  pending = new Map<number, () => void>()
  setTimeout = (callback: () => void) => {
    const id = this.next++
    this.pending.set(id, callback)
    return id
  }
  clearTimeout = (id: number) => {
    this.pending.delete(id)
  }
  runAll() {
    const due = [...this.pending.values()]
    this.pending.clear()
    for (const callback of due) callback()
  }
}

test('frame loop: a frame per animation frame, and nothing (no pending frame) after stop — the stage unmounted', () => {
  const frames = new FakeFrames()
  const seen: number[] = []
  const stop = startFrameLoop(frames, (now) => seen.push(now))
  frames.flush(16)
  frames.flush(32)
  assert.deepEqual(seen, [16, 32])
  assert.equal(frames.pending.size, 1)
  stop()
  assert.equal(frames.pending.size, 0, 'the next frame is cancelled')
  frames.flush(48)
  assert.deepEqual(seen, [16, 32])
})

test('frame loop: stopping from inside a frame leaves no frame behind', () => {
  const frames = new FakeFrames()
  let stop = () => {}
  let calls = 0
  stop = startFrameLoop(frames, () => {
    calls++
    stop()
  })
  frames.flush(16)
  frames.flush(32)
  assert.equal(calls, 1)
  assert.equal(frames.pending.size, 0)
})

test('listenAll: one handler on several event types, all removed by the returned function', () => {
  const target = new FakeTarget()
  let hits = 0
  const off = listenAll(target, ['pointermove', 'pointerdown', 'keydown', 'wheel'], () => { hits++ })
  assert.equal(target.count(), 4)
  target.dispatch('keydown')
  target.dispatch('wheel')
  assert.equal(hits, 2)
  off()
  assert.equal(target.count(), 0)
  target.dispatch('keydown')
  assert.equal(hits, 2)
})

test('shader canvas watch: ready once the canvas exists, context loss reported, cleanup removes timer and listener', () => {
  const timers = new FakeTimers()
  const canvas = new FakeTarget()
  let present: FakeTarget | null = null
  const calls: string[] = []
  const stop = watchShaderCanvas(() => present, {
    onReady: () => calls.push('ready'),
    onLost: () => calls.push('lost'),
    onGiveUp: () => calls.push('give-up'),
  }, timers)
  timers.runAll() // not created yet: retries
  assert.deepEqual(calls, [])
  assert.equal(timers.pending.size, 1)
  present = canvas
  timers.runAll()
  assert.deepEqual(calls, ['ready'])
  assert.equal(canvas.count(), 1)
  assert.equal(canvas.dispatch('webglcontextlost'), true, 'the lost context is claimed (preventDefault)')
  assert.deepEqual(calls, ['ready', 'lost'])
  stop()
  assert.equal(canvas.count(), 0, 'unmount removes the context-loss listener before the mount disposes')
  assert.equal(timers.pending.size, 0)
})

test('shader canvas watch: unmount before the canvas appears cancels the wait; no canvas at all gives up', () => {
  const timers = new FakeTimers()
  const calls: string[] = []
  const callbacks = { onReady: () => calls.push('ready'), onLost: () => calls.push('lost'), onGiveUp: () => calls.push('give-up') }
  const stop = watchShaderCanvas(() => null, callbacks, timers)
  stop()
  assert.equal(timers.pending.size, 0)
  timers.runAll()
  assert.deepEqual(calls, [])

  watchShaderCanvas(() => null, callbacks, timers, { maxTries: 2 })
  for (let i = 0; i < 5; i++) timers.runAll()
  assert.deepEqual(calls, ['give-up'])
  assert.equal(timers.pending.size, 0)
})

test('live model lost after it was shown: the stills carry on in the state she is in', () => {
  assert.deepEqual(recoverFromLiveLoss('dozing'), { phase: 'dozing', still: 'doze', finishWake: false })
  assert.deepEqual(recoverFromLiveLoss('falling'), { phase: 'dozing', still: 'doze', finishWake: false })
  // Mid wake-up the live cues are dropped: jump to the smile and greet.
  assert.deepEqual(recoverFromLiveLoss('waking'), { phase: 'awake', still: 'happy', finishWake: true })
  assert.deepEqual(recoverFromLiveLoss('awake'), { phase: 'awake', still: 'happy', finishWake: false })
})

test('chunk boundary: a failed lazy chunk renders nothing (static logo stays) and is reported once', () => {
  let reported = 0
  const child = { marker: 'heatmap' }
  const boundary = new ChunkBoundary({ onError: () => { reported++ }, children: child as never })
  assert.equal(boundary.render(), child)
  boundary.state = { ...boundary.state, ...ChunkBoundary.getDerivedStateFromError() }
  boundary.componentDidCatch()
  assert.equal(boundary.render(), null)
  assert.equal(reported, 1)
})
