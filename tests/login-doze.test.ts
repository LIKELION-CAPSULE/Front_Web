import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOZE_STILL_POSE,
  DOZE_TIMINGS_MS,
  WAKE_EXPRESSION_CUES,
  dozePose,
  fallAsleepPose,
  dozeCallLine,
  parseDozeQuery,
  wakeGreetDelay,
  wakePose,
} from '../src/features/auth/login-variants/doze/doze-motion.ts'
import {
  DOZE_FRAMING,
  DOZE_STILL_RENDER,
  computeDozeCamera,
  computeDozeScene,
  computeStillBox,
  isPointerNearFace,
} from '../src/features/auth/login-variants/doze/doze-view.ts'
import { CHAERIN_V2_LANDMARKS, modelPointToScreen } from '../src/features/mate-render/aliving-view.ts'

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

test('the nod cycle starts on the doze still pose, so the live model fades in without a jump', () => {
  const { params, lean } = dozePose(0)
  for (const [key, value] of Object.entries(DOZE_STILL_POSE)) close(params[key as keyof typeof params] ?? NaN, value)
  close(lean, 1)
  // One full period later it is back there.
  close(dozePose(DOZE_TIMINGS_MS.nodPeriod).params.ParamAngleY ?? NaN, DOZE_STILL_POSE.ParamAngleY)
})

test('dozing keeps the eyes (almost) shut and the head within the nod range', () => {
  for (let t = 0; t < DOZE_TIMINGS_MS.nodPeriod; t += 50) {
    const { params, lean } = dozePose(t)
    assert.ok((params.ParamEyeLOpen ?? 1) <= 0.2, `eyes at ${t}`)
    assert.ok((params.ParamAngleY ?? 0) >= -30 && (params.ParamAngleY ?? 0) <= -5, `head at ${t}`)
    assert.ok(lean >= 0 && lean <= 1)
  }
})

test('waking: starts from the pose she was in, yawns with the expression, hands the face back at the greeting', () => {
  const from = dozePose(1234).params
  const first = wakePose(0, from)
  assert.ok(first)
  close(first.ParamAngleY ?? NaN, from.ParamAngleY ?? NaN)
  // During the yawn the eyes are left to the `yawn` expression.
  const yawn = wakePose((DOZE_TIMINGS_MS.wakeYawnAt + DOZE_TIMINGS_MS.wakeYawnEnd) / 2, from)
  assert.ok(yawn)
  assert.equal(yawn.ParamEyeLOpen, undefined)
  // Just before the greeting: eyes open, head level.
  const end = wakePose(DOZE_TIMINGS_MS.wakeGreetAt - 1, from)
  assert.ok(end && (end.ParamEyeLOpen ?? 0) > 0.95)
  assert.equal(wakePose(DOZE_TIMINGS_MS.wakeGreetAt, from), null)
  assert.deepEqual(
    WAKE_EXPRESSION_CUES.map((cue) => cue.expression),
    ['yawn', null, 'happy'],
  )
  // 1.5–2.5 s from the trigger to the greeting (live), shorter on the still path, quickest without motion.
  const live = wakeGreetDelay('live', false)
  assert.ok(live >= 1500 && live <= 2500)
  assert.ok(wakeGreetDelay('static', false) <= live)
  assert.ok(wakeGreetDelay('live', true) < 500)
})

test('falling asleep ends on the start of the nod cycle', () => {
  const end = fallAsleepPose(DOZE_TIMINGS_MS.fallAsleep)
  const start = dozePose(0).params
  for (const key of ['ParamAngleY', 'ParamAngleZ', 'ParamEyeLOpen'] as const) close(end[key] ?? NaN, start[key] ?? NaN, 1e-3)
  const begin = fallAsleepPose(0)
  close(begin.ParamEyeLOpen ?? NaN, 1)
  close(begin.ParamAngleY ?? NaN, 0)
})

test('DEV query: variant=doze, static only together with it', () => {
  assert.deepEqual(parseDozeQuery('?variant=doze'), { doze: true, forceStatic: false })
  assert.deepEqual(parseDozeQuery('?variant=doze&static=1'), { doze: true, forceStatic: true })
  assert.deepEqual(parseDozeQuery('?static=1'), { doze: false, forceStatic: false })
  assert.deepEqual(parseDozeQuery('?mode=login'), { doze: false, forceStatic: false })
})

test('camera: head below the top margin, desk edge leaves the dialogue room at the bottom', () => {
  for (const [cw, ch] of [
    [893, 900],
    [794, 720],
    [1280, 420],
  ] as const) {
    const { view, k } = computeDozeCamera(cw, ch)
    const head = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.headTopY, cw, ch, view)
    const desk = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, DOZE_FRAMING.deskTopModelY, cw, ch, view)
    close(head.k, k)
    close(head.x, cw / 2)
    assert.ok(head.y >= ch * DOZE_FRAMING.headMarginRatio - 1e-6, `head top at ${cw}×${ch}`)
    const front = ch - desk.y
    assert.ok(front >= DOZE_FRAMING.deskFrontMin - 1e-6 && front <= DOZE_FRAMING.deskFrontMax + 1e-6, `desk front ${front}`)
  }
})

test('stills line up with the live model: the hero render box maps model px exactly like the engine', () => {
  const cw = 893
  const ch = 900
  const { view } = computeDozeCamera(cw, ch)
  const box = computeStillBox(DOZE_STILL_RENDER, cw, ch, view)
  const kRender = (Math.min(DOZE_STILL_RENDER.size.width, DOZE_STILL_RENDER.size.height) / 1280) * DOZE_STILL_RENDER.view.zoom
  // The render's center is model (view.cx, view.cy).
  const center = modelPointToScreen(DOZE_STILL_RENDER.view.cx, DOZE_STILL_RENDER.view.cy, cw, ch, view)
  close(box.left + box.width / 2, center.x, 1e-6)
  close(box.top + box.height / 2, center.y, 1e-6)
  close(box.width, (DOZE_STILL_RENDER.size.width / kRender) * center.k, 1e-6)
})

test('scene: laptop lid between chest and desk, tap target over head and chest, proximity radius', () => {
  const scene = computeDozeScene(893, 900)
  assert.ok(scene.lid.top > scene.face.y)
  close(scene.lid.top + scene.lid.height, scene.deskTop)
  close(scene.lid.left + scene.lid.width / 2, 893 / 2)
  assert.ok(scene.hit.top < scene.face.y && scene.hit.top + scene.hit.height > scene.face.y)
  assert.ok(isPointerNearFace({ x: scene.face.x + 100, y: scene.face.y }, scene.face, 120))
  assert.ok(!isPointerNearFace({ x: scene.face.x + 300, y: scene.face.y }, scene.face, 120))
})

test('the tap bubble names her with the right particle, and sits on her chest below the face', () => {
  assert.equal(dozeCallLine('채린'), '채린이를 톡 눌러서 깨워 봐')
  assert.equal(dozeCallLine('도하'), '도하를 톡 눌러서 깨워 봐')
  const scene = computeDozeScene(893, 900)
  assert.ok(scene.call.y > scene.face.y + 80 * scene.k, 'below the face')
  assert.ok(scene.call.y < scene.lid.top - 40, 'above the laptop')
  assert.ok(scene.zz.x > scene.face.x, 'z z Z on the side of her head')
})
