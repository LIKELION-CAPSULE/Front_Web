import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOZE_STILL_POSE,
  DOZE_TIMINGS_MS,
  WAKE_EXPRESSION_CUES,
  dozePose,
  fallAsleepPose,
  dozeCallLine,
  parseDozeDevQuery,
  wakeGreetDelay,
  wakePose,
} from '../src/features/auth/login-variants/doze/doze-motion.ts'
import {
  DOZE_COMPACT_FRAMING,
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

test('DEV query: static=1 forces the still path, doze=awake starts awake', () => {
  assert.deepEqual(parseDozeDevQuery('?static=1'), { forceStatic: true, forceAwake: false })
  assert.deepEqual(parseDozeDevQuery('?doze=awake&static=1'), { forceStatic: true, forceAwake: true })
  assert.deepEqual(parseDozeDevQuery('?mode=login'), { forceStatic: false, forceAwake: false })
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
  assert.equal(dozeCallLine('채린'), '채린을 눌러 깨워 보세요')
  assert.equal(dozeCallLine('도하'), '도하를 눌러 깨워 보세요')
  const scene = computeDozeScene(893, 900)
  assert.ok(scene.call.y > scene.face.y + 80 * scene.k, 'below the face')
  assert.ok(scene.call.y < scene.lid.top - 40, 'above the laptop')
  assert.ok(scene.zz.x > scene.face.x, 'z z Z on the side of her head')
})

test('half screen (compact): the desk front shrinks to a sliver, so she is drawn larger; bubbles centre on her', () => {
  const [cw, ch] = [900, 540]
  const wide = computeDozeCamera(cw, ch)
  const compact = computeDozeCamera(cw, ch, true)
  assert.ok(compact.k > wide.k * 1.15, `compact k ${compact.k} vs ${wide.k}`)
  const desk = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, DOZE_FRAMING.deskTopModelY, cw, ch, compact.view)
  const front = ch - desk.y
  assert.ok(front >= DOZE_COMPACT_FRAMING.deskFrontMin - 1e-6 && front <= DOZE_COMPACT_FRAMING.deskFrontMax + 1e-6, `front ${front}`)
  const scene = computeDozeScene(cw, ch, compact)
  close(scene.mate.cx, scene.still.left + scene.still.width / 2)
  close(scene.call.x, scene.mate.cx)
  close(scene.mate.cx, cw / 2, 1e-6)
})

test('lid icon keystone: on screen its sides run parallel to the lid sides; bottom edge and centre stay put', async () => {
  const { iconKeystone } = await import('../src/features/auth/login-variants/doze/doze-view.ts')
  // A lid like the 1440 one: flat width W, the icon w × h with its bottom hb above the lid's bottom edge.
  const W = 406, w = 50, h = 48.3, hb = 75, tilt = (20 * Math.PI) / 180, P = 870
  const { m, g } = iconKeystone({ lidWidth: W, iconWidth: w, iconHeight: h, iconBottomFromLidBottom: hb, tilt, perspective: P })
  assert.ok(m > 1, 'the top of the icon is wider than its bottom')
  // Lid projection (perspective P around the lid's bottom centre, rotateX(-tilt)): height t above the bottom edge →
  // screen x scaled by S, screen y = t·cos·S.
  const lidProject = (x: number, t: number) => {
    const S = P / (P - t * Math.sin(tilt))
    return { x: x * S, y: -t * Math.cos(tilt) * S }
  }
  // Keystone in the icon's own plane, origin at its bottom centre, y up negative: x' = x/(1+g·y), y' = (y/m)/(1+g·y).
  const key = (x: number, y: number) => ({ x: x / (1 + g * y), y: y / m / (1 + g * y) })
  const iconCorner = (x: number, y: number) => {
    const k = key(x, y)
    return lidProject(k.x, hb - k.y)
  }
  const angle = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.x - a.x, a.y - b.y)
  const lidRight = angle(lidProject(W / 2, 0), lidProject(W / 2, 200))
  const iconRight = angle(iconCorner(w / 2, 0), iconCorner(w / 2, -h))
  const iconLeft = angle(iconCorner(-w / 2, 0), iconCorner(-w / 2, -h))
  assert.ok(Math.abs(iconRight - lidRight) < 1e-9, `right ${iconRight} vs lid ${lidRight}`)
  assert.ok(Math.abs(iconLeft + lidRight) < 1e-9, 'left mirrors right')
  // Bottom corners, height and centre unchanged by the keystone.
  assert.deepEqual(key(w / 2, 0), { x: w / 2, y: 0 })
  assert.ok(Math.abs(key(0, -h).y + h) < 1e-9 && key(0, -h).x === 0)
})
