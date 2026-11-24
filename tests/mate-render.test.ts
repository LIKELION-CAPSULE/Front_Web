import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isAllowedEngineUrl,
  resolveMateSource,
} from '../src/features/mate-render/mate-source.ts'
import {
  CHAERIN_V2_LANDMARKS,
  computeAlivingLayerBox,
  BUST_FRAMING,
  computeBustCamera,
  computeFaceScreenPosition,
  computePointerGaze,
  modelPointToScreen,
} from '../src/features/mate-render/aliving-view.ts'

test('isAllowedEngineUrl accepts same-origin and VITE_API_BASE_URL origins, rejects foreign/invalid URLs', () => {
  const opts = {
    pageOrigin: 'https://app.capsule.kr',
    apiBaseUrl: 'https://api.capsule.kr/v1',
  }
  assert.equal(isAllowedEngineUrl('/__local-assets/chaerin-v2/engine/engine.js', opts), true)
  assert.equal(isAllowedEngineUrl('https://app.capsule.kr/engine/engine.js', opts), true)
  assert.equal(isAllowedEngineUrl('https://api.capsule.kr/static/engine.js', opts), true)

  assert.equal(isAllowedEngineUrl('https://evil.example/engine.js', opts), false)
  assert.equal(isAllowedEngineUrl('/\\evil.example/x.js', opts), false)
  assert.equal(isAllowedEngineUrl('/%5Cevil.example/x.js', opts), false)
  assert.equal(isAllowedEngineUrl(' //evil.example/x.js', opts), false)
  assert.equal(isAllowedEngineUrl('//evil.example/engine.js', opts), false)
  assert.equal(isAllowedEngineUrl('javascript:alert(1)', opts), false)
  assert.equal(isAllowedEngineUrl('', opts), false)
  assert.equal(isAllowedEngineUrl(null, opts), false)
})

test('resolveMateSource selects cubism, aliving, or static safely', () => {
  const opts = { pageOrigin: 'http://127.0.0.1:3100', apiBaseUrl: 'https://api.capsule.kr' }

  assert.deepEqual(
    resolveMateSource({ modelUrl: '/__local-assets/chaerin/model.model3.json' }, opts),
    { kind: 'cubism', modelUrl: '/__local-assets/chaerin/model.model3.json' },
  )

  const aliving = resolveMateSource(
    {
      modelUrl: '/__local-assets/chaerin-v2/model/model.json',
      engineUrl: '/__local-assets/chaerin-v2/engine/engine.js',
      reactionsUrl: '/__local-assets/chaerin-v2/engine/reactions.default.json',
    },
    opts,
  )
  assert.equal(aliving.kind, 'aliving')
  if (aliving.kind === 'aliving') {
    assert.equal(aliving.playerUrl, '/__local-assets/chaerin-v2/engine/player.js')
    assert.equal(aliving.reactionsUrl, '/__local-assets/chaerin-v2/engine/reactions.default.json')
  }

  // Missing engineUrl -> static
  assert.deepEqual(
    resolveMateSource({ modelUrl: '/__local-assets/chaerin-v2/model/model.json' }, opts),
    { kind: 'static' },
  )

  // Foreign engineUrl -> rejected -> static
  assert.deepEqual(
    resolveMateSource(
      {
        modelUrl: '/__local-assets/chaerin-v2/model/model.json',
        engineUrl: 'https://untrusted.cdn.example/engine.js',
      },
      opts,
    ),
    { kind: 'static' },
  )

  // Unknown format or missing modelUrl -> static
  assert.deepEqual(resolveMateSource({ modelUrl: '/foo/bar.png' }, opts), { kind: 'static' })
  assert.deepEqual(resolveMateSource({ modelUrl: null }, opts), { kind: 'static' })
})

test('modelPointToScreen / computeAlivingLayerBox share one projection', () => {
  const plan = computeBustCamera(892, 900)
  const eyes = modelPointToScreen(
    CHAERIN_V2_LANDMARKS.centerX,
    CHAERIN_V2_LANDMARKS.eyesY,
    plan.cameraW,
    plan.cameraH,
    plan.view,
  )
  const box = computeAlivingLayerBox({ x: 1920, y: 714, width: 300, height: 150 }, plan.cameraW, plan.cameraH, plan.view)
  assert.ok(Math.abs(box.left - eyes.x) < 0.5)
  assert.ok(Math.abs(box.top - eyes.y) < 0.5)
  assert.ok(Math.abs(box.width - 100 * eyes.k) < 0.5)
})

test('computeFaceScreenPosition and computePointerGaze map pointer positions and clamp edges', () => {
  const stageRect = { left: 0, top: 0, width: 892, height: 900 }
  const plan = computeBustCamera(stageRect.width, stageRect.height)
  const face = computeFaceScreenPosition(stageRect, plan)

  // Face eyes in the bust shot sit horizontally centered, in the upper half (~39% of stage height)
  assert.ok(Math.abs(face.x - 446) < 0.5)
  assert.ok(face.y > 900 * 0.3 && face.y < 900 * 0.45, `eyes at ${face.y}`)

  // Pointer directly on face -> (0, 0)
  assert.deepEqual(
    computePointerGaze({
      pointerX: face.x,
      pointerY: face.y,
      faceX: face.x,
      faceY: face.y,
      stageWidth: stageRect.width,
      stageHeight: stageRect.height,
    }),
    { x: 0, y: 0 },
  )

  // Pointer on right login form -> looks right (x > 0)
  const rightForm = computePointerGaze({
    pointerX: 1120,
    pointerY: 420,
    faceX: face.x,
    faceY: face.y,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
  })
  assert.equal(rightForm.x, 1)
  assert.ok(rightForm.y < 0 && rightForm.y > -1)

  // Extreme top-left and bottom-right clamp strictly to [-1, 1]
  const topLeft = computePointerGaze({
    pointerX: -500,
    pointerY: -500,
    faceX: face.x,
    faceY: face.y,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
  })
  assert.deepEqual(topLeft, { x: -1, y: 1 })

  const bottomRight = computePointerGaze({
    pointerX: 3000,
    pointerY: 3000,
    faceX: face.x,
    faceY: face.y,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
  })
  assert.deepEqual(bottomRight, { x: 1, y: -1 })
})

test('computeBustCamera frames head margin at the top and the chest (never the waist) at the bottom edge', () => {
  for (const [cw, ch] of [
    [892, 900],
    [1100, 720],
    [390, 440],
    [635, 1280], // tall & narrow: width-limited zoom must still keep the waist off-screen
    [500, 1400],
    [360, 900],
  ] as const) {
    const plan = computeBustCamera(cw, ch)
    // Single shot: camera == stage, all shots identity (layers, Live2D canvas and static image stay aligned).
    assert.equal(plan.cameraW, cw)
    assert.equal(plan.cameraH, ch)
    assert.equal(plan.offsetLeft, 0)
    assert.equal(plan.offsetTop, 0)

    const at = (my: number) => modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, my, cw, ch, plan.view).y
    const headY = at(CHAERIN_V2_LANDMARKS.headTopY)
    const waistY = at(CHAERIN_V2_LANDMARKS.waistY)
    const bottomY = at(BUST_FRAMING.bottomModelY)
    const widthLimited = Math.abs(plan.k - cw / BUST_FRAMING.minVisibleModelWidth) < 1e-9
    if (!widthLimited) {
      assert.ok(headY > 0 && headY < ch * 0.2, `head top should leave a small margin, got ${headY}/${ch}`)
    } else {
      assert.ok(headY > 0, `head must stay on stage, got ${headY}`)
    }
    assert.ok(waistY > ch, `waist must be below the stage bottom (waist ${waistY}, stage ${ch})`)
    // Never reveal anything below the chest line, whether height- or width-limited.
    assert.ok(bottomY >= ch - 0.5, `bottom landmark must not rise above the stage bottom (${bottomY} < ${ch})`)

    // Face position math follows the bust framing (eyes land where modelPointToScreen puts them).
    const stageRect = { left: 0, top: 0, width: cw, height: ch }
    const face = computeFaceScreenPosition(stageRect, plan)
    assert.ok(Math.abs(face.y - at(CHAERIN_V2_LANDMARKS.eyesY)) < 0.5)
    assert.ok(Math.abs(face.x - cw / 2) < 0.5)
  }

  const wide = computeBustCamera(892, 900)
  const bottomWide = modelPointToScreen(640, BUST_FRAMING.bottomModelY, 892, 900, wide.view).y
  assert.ok(Math.abs(bottomWide - 900) < 0.5, `bottom model y should sit on the stage bottom, got ${bottomWide}`)
  const headWide = modelPointToScreen(640, CHAERIN_V2_LANDMARKS.headTopY, 892, 900, wide.view).y
  assert.ok(Math.abs(headWide - 900 * BUST_FRAMING.headMarginRatio) < 0.5)
})
