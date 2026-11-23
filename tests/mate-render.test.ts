import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isAllowedEngineUrl,
  resolveMateSource,
} from '../src/features/mate-render/mate-source.ts'
import {
  CHAERIN_V2_LANDMARKS,
  computeAlivingLayerBox,
  computeAssembleCamera,
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

test('modelPointToScreen and computeAssembleCamera place Shot A skirt hem at bottom and Shot B eyes at 30%', () => {
  const cw = 892
  const ch = 900
  const plan = computeAssembleCamera(cw, ch)

  // Verify Shot A via camera transform: headTopY -> 6% height, skirtHemY -> 100% height (bottom edge)
  const headInCam = modelPointToScreen(
    CHAERIN_V2_LANDMARKS.centerX,
    CHAERIN_V2_LANDMARKS.headTopY,
    plan.cameraW,
    plan.cameraH,
    plan.view,
  )
  const skirtInCam = modelPointToScreen(
    CHAERIN_V2_LANDMARKS.centerX,
    CHAERIN_V2_LANDMARKS.skirtHemY,
    plan.cameraW,
    plan.cameraH,
    plan.view,
  )
  const headShotAY = ch / 2 + plan.shotA.ty + (headInCam.y - plan.cameraH / 2) * plan.shotA.scale
  const skirtShotAY = ch / 2 + plan.shotA.ty + (skirtInCam.y - plan.cameraH / 2) * plan.shotA.scale
  assert.ok(Math.abs(headShotAY - ch * 0.06) < 0.5, `Expected head at 6%, got ${headShotAY}`)
  assert.ok(Math.abs(skirtShotAY - ch) < 0.5, `Expected skirt hem at 100%, got ${skirtShotAY}`)

  // Verify Shot B via camera transform: eyesY -> 30% height, native scale 1, ~1.35x vs Shot A
  const eyesInCam = modelPointToScreen(
    CHAERIN_V2_LANDMARKS.centerX,
    CHAERIN_V2_LANDMARKS.eyesY,
    plan.cameraW,
    plan.cameraH,
    plan.view,
  )
  const eyesShotBY = ch / 2 + plan.shotB.ty + (eyesInCam.y - plan.cameraH / 2) * plan.shotB.scale
  assert.ok(Math.abs(eyesShotBY - ch * 0.3) < 0.5, `Expected eyes at 30%, got ${eyesShotBY}`)
  assert.ok(Math.abs(plan.kB / plan.kA - 1.35) < 0.001)

  // Verify 3x manifest box maps identically to modelPointToScreen
  const box = computeAlivingLayerBox({ x: 1920, y: 714, width: 300, height: 150 }, plan.cameraW, plan.cameraH, plan.view)
  assert.ok(Math.abs(box.left - eyesInCam.x) < 0.5)
  assert.ok(Math.abs(box.top - eyesInCam.y) < 0.5)
  assert.ok(Math.abs(box.width - 100 * eyesInCam.k) < 0.5)
})

test('computeFaceScreenPosition and computePointerGaze map pointer positions and clamp edges', () => {
  const stageRect = { left: 0, top: 0, width: 892, height: 900 }
  const plan = computeAssembleCamera(stageRect.width, stageRect.height)
  const face = computeFaceScreenPosition(stageRect, plan, plan.shotB)

  // Face eyes in Shot B sit horizontally centered and at 30% of stage height
  assert.ok(Math.abs(face.x - 446) < 0.5)
  assert.ok(Math.abs(face.y - 270) < 0.5)

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
