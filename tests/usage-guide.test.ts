import assert from 'node:assert/strict'
import test from 'node:test'
import { damp, fillDistance, GUIDE, GUIDE_STEP_RANGES, guidePose, stepAt } from '../src/features/usage-guide/guide-timeline.ts'
import { GUIDE_STEPS } from '../src/features/usage-guide/guide-steps.ts'
import { markGuideSeen, readGuideSeen } from '../src/features/usage-guide/guide-seen.ts'
import { homography, project, rectQuad, toMatrix3d, type Quad } from '../src/features/usage-guide/scene/screen-projection.ts'

const close = (a: number, b: number, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≉ ${b}`)

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values }
}

test('every step has copy and a scroll range, and the ranges move forward', () => {
  assert.equal(GUIDE_STEPS.length, GUIDE_STEP_RANGES.length)
  GUIDE_STEP_RANGES.forEach((range, i) => {
    assert.ok(range.from <= range.settle)
    if (i > 0) assert.ok(range.from > GUIDE_STEP_RANGES[i - 1]!.settle)
    // "다음" scrolls to a step's settle point, which must show that very step.
    assert.equal(stepAt(range.settle), i)
  })
  assert.equal(GUIDE_STEP_RANGES.at(-1)!.settle, 1)
})

test('the desk turns, the camera dives to the monitor, then pulls back for the notebook', () => {
  const start = guidePose(0)
  close(start.yaw, (GUIDE.rotateDeg * Math.PI) / 180)
  close(start.cameraDistance, GUIDE.farDistance)
  assert.equal(start.screenStep, 0)
  const turned = guidePose(GUIDE.rotateEnd)
  close(turned.yaw, 0)
  const zoomed = guidePose(GUIDE.zoomEnd)
  close(zoomed.cameraDistance, fillDistance() / GUIDE.zoomFill)
  close(zoomed.cameraHeight, 0)
  assert.equal(zoomed.screenStep, 1)
  const focused = guidePose(GUIDE.focusEnd)
  close(focused.cameraDistance, GUIDE.focusDistance)
  close(focused.floatScale, GUIDE.focusFloatScale)
  close(focused.screenDim, GUIDE.focusScreenDim)
  assert.equal(focused.screenStep, 2)
  const end = guidePose(1)
  close(end.cameraDistance, GUIDE.focusDistance + GUIDE.finishPullBack)
  close(end.screenDim, 0)
  // Out-of-range progress holds the ends instead of overshooting.
  assert.deepEqual(guidePose(-0.5), start)
  assert.deepEqual(guidePose(1.5), end)
})

test('the yaw only decreases and the camera only approaches until the notebook step', () => {
  let previous = guidePose(0)
  for (let p = 0.02; p <= GUIDE.zoomEnd + 1e-9; p += 0.01) {
    const pose = guidePose(p)
    assert.ok(pose.yaw <= previous.yaw + 1e-12)
    assert.ok(pose.cameraDistance <= previous.cameraDistance + 1e-12)
    previous = pose
  }
})

test('at fill distance a screen of the configured height spans the whole field of view', () => {
  const d = fillDistance(0.62, 30)
  close(2 * d * Math.tan((30 * Math.PI) / 360), 0.62)
})

test('damping approaches the target independent of frame rate and settles exactly', () => {
  const sixty = Array.from({ length: 60 }).reduce<number>((value) => damp(value, 1, GUIDE.damping, 1 / 60), 0)
  const thirty = Array.from({ length: 30 }).reduce<number>((value) => damp(value, 1, GUIDE.damping, 1 / 30), 0)
  close(sixty, thirty, 1e-9)
  assert.equal(damp(0.99995, 1, GUIDE.damping, 1 / 60), 1)
})

test('the guide is remembered per account, and an unknown account never opens it by itself', () => {
  const storage = memoryStorage()
  assert.equal(readGuideSeen(7, storage), false)
  assert.equal(markGuideSeen(7, storage), true)
  assert.equal(readGuideSeen(7, storage), true)
  assert.equal(readGuideSeen(8, storage), false)
  assert.equal(readGuideSeen(undefined, storage), true)
  assert.equal(markGuideSeen(undefined, storage), false)
  assert.equal(readGuideSeen(9, { getItem: () => { throw new Error('blocked') } }), true)
  assert.equal(markGuideSeen(9, { setItem: () => { throw new Error('full') } }), false)
})

test('the homography maps each corner and reduces to identity for the same rectangle', () => {
  const from = rectQuad(-40, 0, 1280, 800)
  const to: Quad = [[612, 210], [1010, 240], [1002, 488], [606, 470]]
  const matrix = homography(from, to)!
  from.forEach((point, i) => {
    const [x, y] = project(matrix, point)
    close(x, to[i]![0], 1e-6)
    close(y, to[i]![1], 1e-6)
  })
  const identity = homography(from, from)!
  ;[1, 0, 0, 0, 1, 0, 0, 0, 1].forEach((value, i) => close(identity[i]!, value, 1e-9))
  assert.equal(toMatrix3d(identity), 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)')
})

test('a degenerate target has no homography', () => {
  assert.equal(homography(rectQuad(0, 0, 10, 10), [[0, 0], [0, 0], [0, 0], [0, 0]]), null)
})
