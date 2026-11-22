import assert from 'node:assert/strict'
import test from 'node:test'
import { DeviceController, deviceErrorMessage } from '../src/features/media/device-controller.ts'
import { readDevicePreferences, saveDevicePreferences } from '../src/features/media/device-preferences.ts'

function fixture() {
  const track = new EventTarget() as MediaStreamTrack
  let stops = 0
  Object.assign(track, { readyState: 'live', stop: () => { stops++; Object.assign(track, { readyState: 'ended' }) } })
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  return { stream, track, stops: () => stops }
}
function deferred() {
  let resolve!: (stream: MediaStream) => void
  let reject!: (error: Error) => void
  const promise = new Promise<MediaStream>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('devices open only on request, reuse active streams, and stop both devices', async () => {
  const camera = fixture(), microphone = fixture(), calls: MediaStreamConstraints[] = []
  const controller = new DeviceController(async (constraints) => { calls.push(constraints); return constraints.video ? camera.stream : microphone.stream })
  assert.equal(calls.length, 0)
  await controller.requestBoth()
  assert.equal(controller.getSnapshot().camera.status, 'ready')
  assert.equal(controller.getSnapshot().microphone.status, 'ready')
  await controller.requestBoth()
  assert.equal(calls.length, 2)
  controller.stop()
  assert.equal(camera.stops(), 1)
  assert.equal(microphone.stops(), 1)
  assert.equal(controller.getSnapshot().camera.stream, null)
})
test('microphone denial does not close a working camera, and retry can succeed', async () => {
  const camera = fixture(), microphone = fixture()
  let deny = true
  const controller = new DeviceController(async (constraints) => {
    if (constraints.video) return camera.stream
    if (deny) throw new DOMException('denied', 'NotAllowedError')
    return microphone.stream
  })
  await controller.requestBoth()
  assert.equal(controller.getSnapshot().camera.stream, camera.stream)
  assert.equal(controller.getSnapshot().microphone.status, 'error')
  assert.match(controller.getSnapshot().microphone.error, /사이트 설정/)
  deny = false
  assert.equal(await controller.request('microphone'), true)
  controller.stop()
})
test('leaving while permission is pending releases late tracks and never prompts for the microphone', async () => {
  const camera = fixture(), pending = deferred()
  let calls = 0
  const controller = new DeviceController(() => { calls++; return pending.promise })
  const request = controller.requestBoth()
  controller.stop()
  pending.resolve(camera.stream)
  await request
  assert.equal(camera.stops(), 1)
  assert.equal(calls, 1)
  assert.equal(controller.getSnapshot().camera.status, 'idle')
})
test('pending requests are deduplicated and an obsolete failure cannot overwrite a new connection', async () => {
  const first = deferred(), second = deferred(), camera = fixture()
  let calls = 0
  const controller = new DeviceController(() => ++calls === 1 ? first.promise : second.promise)
  const old = controller.request('camera')
  assert.equal(controller.request('camera'), old)
  controller.stop('camera')
  const next = controller.request('camera')
  second.resolve(camera.stream)
  assert.equal(await next, true)
  first.reject(new DOMException('old failure', 'NotAllowedError'))
  assert.equal(await old, false)
  assert.equal(controller.getSnapshot().camera.stream, camera.stream)
  controller.stop()
})
test('device removal clears only the affected stream and notifies subscribers', async () => {
  const camera = fixture(), microphone = fixture()
  const controller = new DeviceController(async (constraints) => constraints.video ? camera.stream : microphone.stream)
  let notifications = 0
  const unsubscribe = controller.subscribe(() => notifications++)
  await controller.requestBoth()
  camera.track.dispatchEvent(new Event('ended'))
  assert.equal(controller.getSnapshot().camera.status, 'error')
  assert.equal(controller.getSnapshot().camera.stream, null)
  assert.equal(controller.getSnapshot().microphone.stream, microphone.stream)
  assert.ok(notifications >= 5)
  unsubscribe()
  controller.stop()
})
test('unsupported contexts and device failures have actionable messages', async () => {
  const controller = new DeviceController(null)
  assert.equal(await controller.request('camera'), false)
  assert.match(controller.getSnapshot().camera.error, /HTTPS/)
  assert.match(deviceErrorMessage(new DOMException('', 'NotFoundError'), 'camera'), /연결/)
  assert.match(deviceErrorMessage(new DOMException('', 'NotReadableError'), 'microphone'), /다른 앱/)
})

test('selecting idle devices stores the choice without permission requests, and requests use the exact device', async () => {
  const calls: MediaStreamConstraints[] = []
  const controller = new DeviceController(async constraints => { calls.push(constraints); return fixture().stream })
  await controller.select('camera', 'usb-camera')
  await controller.select('microphone', 'headset')
  assert.equal(calls.length, 0)
  await controller.requestBoth()
  assert.deepEqual((calls[0]!.video as MediaTrackConstraints).deviceId, { exact: 'usb-camera' })
  assert.deepEqual((calls[1]!.audio as MediaTrackConstraints).deviceId, { exact: 'headset' })
  controller.stop()
  assert.deepEqual(controller.getSelection(), { camera: 'usb-camera', microphone: 'headset' })
})

test('switching a live camera releases that camera and leaves the microphone running', async () => {
  const camera = fixture(), replacement = fixture(), microphone = fixture()
  const controller = new DeviceController(async constraints => constraints.audio ? microphone.stream
    : (constraints.video as MediaTrackConstraints).deviceId ? replacement.stream : camera.stream)
  await controller.requestBoth()
  await controller.select('camera', 'usb-camera')
  assert.equal(camera.stops(), 1)
  assert.equal(controller.getSnapshot().camera.stream, replacement.stream)
  assert.equal(controller.getSnapshot().microphone.stream, microphone.stream)
  assert.equal(microphone.stops(), 0)
  controller.stop()
})

test('changing a device during a pending request stops late tracks and preserves only the latest selection', async () => {
  const first = deferred(), second = deferred(), stale = fixture(), current = fixture()
  let calls = 0
  const controller = new DeviceController(() => ++calls === 1 ? first.promise : second.promise)
  const before = controller.request('camera')
  const after = controller.select('camera', 'usb-camera')
  second.resolve(current.stream)
  assert.equal(await after, true)
  first.resolve(stale.stream)
  assert.equal(await before, false)
  assert.equal(stale.stops(), 1)
  assert.equal(controller.getSnapshot().camera.stream, current.stream)
  controller.stop()
})

test('failed device switches report the failure without falling back to an unselected camera', async () => {
  const camera = fixture()
  const controller = new DeviceController(async constraints => {
    if ((constraints.video as MediaTrackConstraints).deviceId) throw new DOMException('', 'OverconstrainedError')
    return camera.stream
  })
  await controller.request('camera')
  assert.equal(await controller.select('camera', 'removed-camera'), false)
  assert.equal(camera.stops(), 1)
  assert.equal(controller.getSnapshot().camera.status, 'error')
  assert.equal(controller.getSnapshot().camera.stream, null)
  assert.equal(controller.getSelection().camera, 'removed-camera')
})

test('device preferences reject malformed values and keep working when storage is unavailable', () => {
  assert.deepEqual(readDevicePreferences({ getItem: () => '{' }), { camera: '', microphone: '' })
  assert.deepEqual(readDevicePreferences({ getItem: () => JSON.stringify({ camera: [], microphone: 'headset' }) }), { camera: '', microphone: 'headset' })
  assert.deepEqual(readDevicePreferences({ getItem: () => JSON.stringify({ camera: 'a'.repeat(1025), microphone: false }) }), { camera: '', microphone: '' })
  let saved = ''
  saveDevicePreferences({ setItem: (_key, value) => { saved = value } }, { camera: 'usb', microphone: 'headset' })
  assert.deepEqual(readDevicePreferences({ getItem: () => saved }), { camera: 'usb', microphone: 'headset' })
  assert.doesNotThrow(() => saveDevicePreferences({ setItem: () => { throw new Error('blocked') } }, { camera: '', microphone: '' }))
})
