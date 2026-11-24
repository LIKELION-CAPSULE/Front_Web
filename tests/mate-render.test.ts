import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isAllowedEngineUrl,
  resolveMateSource,
} from '../src/features/mate-render/mate-source.ts'
import {
  CHAERIN_V2_LANDMARKS,
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

test('modelPointToScreen follows the engine projection (k = min(cw, ch) / 1280 × zoom)', () => {
  const view = { zoom: 2, cx: 640, cy: 300 }
  const center = modelPointToScreen(640, 300, 800, 600, view)
  assert.deepEqual(center, { x: 400, y: 300, k: (600 / 1280) * 2 })
  const eyes = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.eyesY, 800, 600, view)
  assert.ok(Math.abs(eyes.y - (300 + (CHAERIN_V2_LANDMARKS.eyesY - 300) * center.k)) < 1e-9)
})

test('computePointerGaze maps pointer positions around the face and clamps edges', () => {
  const stageRect = { left: 0, top: 0, width: 892, height: 900 }
  const face = { x: 446, y: 351 }

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
