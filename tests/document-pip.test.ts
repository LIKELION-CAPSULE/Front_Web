import assert from 'node:assert/strict'
import test from 'node:test'
import { DocumentPipController, connectionInterval, connectionVisible, type DocumentPipApi } from '../src/features/mates/document-pip.ts'

function windowFixture() {
  const target = new EventTarget()
  let closed = false, focuses = 0, nextTimer = 0
  const timers = new Map<number, () => void>()
  const view = Object.assign(target, {
    get closed() { return closed }, document: { hidden: false },
    focus() { focuses++ },
    close() { closed = true; target.dispatchEvent(new Event('pagehide')) },
    setInterval(callback: () => void) { timers.set(++nextTimer, callback); return nextTimer },
    clearInterval(id: number) { timers.delete(id) },
  })
  // Object.assign evaluates accessors; keep closed observable as a native Window would.
  Object.defineProperty(view, 'closed', { get: () => closed })
  return { view: view as unknown as Window, timers, focuses: () => focuses }
}
function deferred() {
  let resolve!: (view: Window) => void
  const promise = new Promise<Window>(yes => { resolve = yes })
  return { promise, resolve }
}

test('PiP requests are initiated synchronously from the gesture and are deduplicated while pending/open', async () => {
  const next = deferred(), native = windowFixture()
  const calls: unknown[] = []
  const controller = new DocumentPipController({ requestWindow: options => { calls.push(options); return next.promise } })
  const first = controller.open()
  assert.deepEqual(calls, [{ width: 360, height: 520 }])
  assert.equal(controller.getSnapshot().status, 'opening')
  assert.equal(controller.open(), first)
  next.resolve(native.view)
  assert.equal(await first, true)
  assert.equal(await controller.open(), true)
  assert.equal(calls.length, 1)
  assert.equal(native.focuses(), 1)
  native.view.close()
  assert.equal(controller.getSnapshot().status, 'closed')
  assert.equal(controller.getSnapshot().window, null)
})

test('leaving during a PiP request closes late windows without replacing a newer PiP', async () => {
  const late = deferred(), old = windowFixture(), current = windowFixture()
  let calls = 0
  const controller = new DocumentPipController({ requestWindow: () => ++calls === 1 ? late.promise : Promise.resolve(current.view) })
  const before = controller.open()
  controller.close()
  assert.equal(await controller.open(), true)
  late.resolve(old.view)
  assert.equal(await before, false)
  assert.equal(old.view.closed, true)
  assert.equal(controller.getSnapshot().window, current.view)
  controller.close()
  assert.equal(current.view.closed, true)
})

test('unsupported PiP does not create a popup, and a rejected native request can be retried', async () => {
  const unavailable = new DocumentPipController(null)
  assert.equal(await unavailable.open(), false)
  assert.match(unavailable.getSnapshot().error, /지원하지 않는/)
  let reject = true
  const native = windowFixture()
  const controller = new DocumentPipController({ requestWindow: async () => {
    if (reject) throw new DOMException('', 'NotAllowedError')
    return native.view
  } })
  assert.equal(await controller.open(), false)
  assert.equal(controller.getSnapshot().status, 'closed')
  assert.ok(controller.getSnapshot().error)
  reject = false
  assert.equal(await controller.open(), true)
  assert.equal(controller.getSnapshot().error, '')
  controller.close()
})

test('camera sampling moves to the native PiP window timer, returns on close, and removes every timer', () => {
  const main = windowFixture(), pip = windowFixture()
  let active: Window | null = null, samples = 0
  const api = Object.assign(new EventTarget(), { requestWindow: async () => pip.view }) as DocumentPipApi & EventTarget
  Object.defineProperty(api, 'window', { get: () => active })
  Object.assign(main.view, { documentPictureInPicture: api })
  const stop = connectionInterval(() => { samples++ }, 100, main.view)
  assert.equal(main.timers.size, 1)
  active = pip.view
  api.dispatchEvent(new Event('enter'))
  assert.equal(main.timers.size, 0)
  assert.equal(pip.timers.size, 1)
  pip.timers.values().next().value!()
  assert.equal(samples, 1)
  active = null
  pip.view.close()
  assert.equal(pip.timers.size, 0)
  assert.equal(main.timers.size, 1)
  stop()
  assert.equal(main.timers.size, 0)
  api.dispatchEvent(new Event('enter'))
  assert.equal(main.timers.size, 0)
})

test('only a visible main document or visible open PiP allows face time to be observed', () => {
  assert.equal(connectionVisible({ hidden: false }, null), true)
  assert.equal(connectionVisible({ hidden: true }, null), false)
  assert.equal(connectionVisible({ hidden: true }, { closed: false, document: { hidden: false } }), true)
  assert.equal(connectionVisible({ hidden: true }, { closed: true, document: { hidden: false } }), false)
  assert.equal(connectionVisible({ hidden: true }, { closed: false, document: { hidden: true } }), false)
})
