import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeBehaviors, createBehaviorState, stepBehavior, yawFromMatrix,
  type BehaviorInput, type BehaviorState, type FaceSignal, type HandSignal,
} from '../src/features/media/behavior-rules.ts'

const face = (overrides: Partial<Extract<FaceSignal, { present: true }>> = {}): FaceSignal => ({
  present: true, eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05, jawOpen: 0.02, yaw: 0, ...overrides,
})
const noFace: FaceSignal = { present: false }

/** Runs one input per `step` milliseconds from `from` up to and including `to`. */
function run(state: BehaviorState, from: number, to: number, step: number, input: (at: number) => BehaviorInput) {
  for (let at = from; at <= to; at += step) state = stepBehavior(state, input(at), at)
  return state
}

test('closed eyes become drowsy only after two seconds', () => {
  const closed = face({ eyeBlinkLeft: 0.8, eyeBlinkRight: 0.7 })
  let state = run(createBehaviorState(), 0, 1900, 100, () => ({ face: closed }))
  assert.ok(!activeBehaviors(state, 1900).includes('drowsy'))
  state = stepBehavior(state, { face: closed }, 2000)
  assert.ok(activeBehaviors(state, 2000).includes('drowsy'))
})

test('one eye closed or an interrupted stretch restarts the drowsy timer', () => {
  let state = run(createBehaviorState(), 0, 3000, 100, () => ({ face: face({ eyeBlinkLeft: 0.9 }) }))
  assert.ok(!activeBehaviors(state, 3000).includes('drowsy'))
  const closed = face({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 })
  state = run(createBehaviorState(), 0, 1500, 100, () => ({ face: closed }))
  state = stepBehavior(state, { face: face() }, 1600)
  state = run(state, 1700, 3200, 100, () => ({ face: closed }))
  assert.ok(!activeBehaviors(state, 3200).includes('drowsy'))
})

test('a missing face becomes away only after three seconds', () => {
  let state = run(createBehaviorState(), 0, 2900, 100, () => ({ face: noFace }))
  assert.deepEqual(activeBehaviors(state, 2900), [])
  state = stepBehavior(state, { face: noFace }, 3000)
  assert.deepEqual(activeBehaviors(state, 3000), ['away'])
  state = stepBehavior(state, { face: face() }, 3100)
  assert.deepEqual(activeBehaviors(state, 3100), [])
})

test('a turned head that loses the face stays a head turn until the away time passes', () => {
  let state = run(createBehaviorState(), 0, 2500, 100, () => ({ face: face({ yaw: -40 }) }))
  assert.deepEqual(activeBehaviors(state, 2500), ['headTurn'])
  state = run(state, 2600, 3000, 100, () => ({ face: noFace }))
  assert.deepEqual(activeBehaviors(state, 3000), ['headTurn'])
  state = run(state, 3100, 5600, 100, () => ({ face: noFace }))
  assert.deepEqual(activeBehaviors(state, 5600), ['away'])
})

test('a head turn needs 25 degrees held for two seconds', () => {
  let state = run(createBehaviorState(), 0, 1900, 100, () => ({ face: face({ yaw: 30 }) }))
  assert.deepEqual(activeBehaviors(state, 1900), [])
  state = stepBehavior(state, { face: face({ yaw: 30 }) }, 2000)
  assert.deepEqual(activeBehaviors(state, 2000), ['headTurn'])
  state = run(createBehaviorState(), 0, 3000, 100, () => ({ face: face({ yaw: 20 }) }))
  assert.deepEqual(activeBehaviors(state, 3000), [])
})

test('a yawn fires once after a second of open jaw and shows for two seconds', () => {
  let state = run(createBehaviorState(), 0, 900, 100, () => ({ face: face({ jawOpen: 0.7 }) }))
  assert.deepEqual(activeBehaviors(state, 900), [])
  state = stepBehavior(state, { face: face({ jawOpen: 0.7 }) }, 1000)
  assert.deepEqual(activeBehaviors(state, 1000), ['yawn'])
  const firedAt = state.yawnAt
  state = run(state, 1100, 2900, 100, () => ({ face: face({ jawOpen: 0.7 }) }))
  assert.equal(state.yawnAt, firedAt, 'a held-open mouth is still the same yawn')
  assert.deepEqual(activeBehaviors(state, 2900), ['yawn'])
  state = stepBehavior(state, { face: face() }, 3000)
  assert.deepEqual(activeBehaviors(state, 3000), [])
})

test('the phone counts after three detections in a row and a miss resets it', () => {
  let state = createBehaviorState()
  for (const at of [0, 1000]) state = stepBehavior(state, { phoneScore: 0.8 }, at)
  assert.deepEqual(activeBehaviors(state, 1000), [])
  state = stepBehavior(state, { phoneScore: 0.6 }, 2000)
  assert.deepEqual(activeBehaviors(state, 2000), ['phone'])
  state = stepBehavior(state, { phoneScore: 0.4 }, 3000)
  assert.deepEqual(activeBehaviors(state, 3000), [])
  for (const at of [4000, 5000]) state = stepBehavior(state, { phoneScore: 0.9 }, at)
  assert.deepEqual(activeBehaviors(state, 5000), [])
})

const hand = (x: number, gesture = 'Open_Palm'): HandSignal => ({ gesture, wrist: { x, y: 400 }, palm: { x, y: 320 } })
const frames = (count: number, interval = 1000 / 15) => Array.from({ length: count }, (_, index) => index * interval)

test('a palm swinging left and right is a wave', () => {
  let state = createBehaviorState()
  let seen = false
  for (const at of frames(15)) {
    state = stepBehavior(state, { hand: hand(320 + 60 * Math.sin(at / 1000 * 2 * Math.PI * 2.5)) }, at)
    seen ||= activeBehaviors(state, at).includes('wave')
  }
  assert.ok(seen)
})

test('moving one way, a closed hand or a small jitter is not a wave', () => {
  const cases: [string, (at: number) => HandSignal][] = [
    ['one direction', (at) => hand(200 + at * 0.3)],
    ['pen grip', (at) => hand(320 + 60 * Math.sin(at / 1000 * 2 * Math.PI * 2.5), 'None')],
    ['jitter', (at) => hand(320 + 10 * Math.sin(at / 1000 * 2 * Math.PI * 4))],
  ]
  for (const [name, input] of cases) {
    let state = createBehaviorState()
    for (const at of frames(30)) {
      state = stepBehavior(state, { hand: input(at) }, at)
      assert.ok(!activeBehaviors(state, at).includes('wave'), name)
    }
  }
})

test('a wave rests for three seconds before it can fire again', () => {
  let state = createBehaviorState()
  const fired: number[] = []
  for (const at of frames(90)) {
    const before = state.waveAt
    state = stepBehavior(state, { hand: hand(320 + 60 * Math.sin(at / 1000 * 2 * Math.PI * 2.5)) }, at)
    if (state.waveAt !== before) fired.push(at)
  }
  assert.ok(fired.length >= 2)
  for (let index = 1; index < fired.length; index++) assert.ok(fired[index]! - fired[index - 1]! >= 3000)
})

test('yaw comes from the column-major transformation matrix and ignores pitch', () => {
  const matrix = (yawDegrees: number, pitchDegrees: number) => {
    const yaw = yawDegrees * Math.PI / 180, pitch = pitchDegrees * Math.PI / 180
    // R = Ry(yaw) · Rx(pitch), stored column by column like MediaPipe's MatrixData.
    const r = [
      [Math.cos(yaw), Math.sin(yaw) * Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)],
      [0, Math.cos(pitch), -Math.sin(pitch)],
      [-Math.sin(yaw), Math.cos(yaw) * Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)],
    ]
    const data = new Array<number>(16).fill(0)
    for (let column = 0; column < 3; column++) for (let row = 0; row < 3; row++) data[column * 4 + row] = r[row]![column]!
    data[15] = 1
    return data
  }
  assert.ok(Math.abs(yawFromMatrix(matrix(30, 0)) - 30) < 1e-9)
  assert.ok(Math.abs(yawFromMatrix(matrix(-40, 20)) + 40) < 1e-9)
  assert.equal(yawFromMatrix([]), 0)
})
