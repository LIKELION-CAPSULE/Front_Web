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

test('engine storage allowlist: the exact Supabase project and its live2d-model bucket only', async () => {
  const { isAllowedEngineUrl, resolveMateSource, ENGINE_SOURCES, parseEngineSources } = await import('../src/features/mate-render/mate-source.ts')
  const base = 'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/aliving2d/v2'
  const options = { pageOrigin: 'https://capsule.example', apiBaseUrl: 'https://api.capsule.example', sources: ENGINE_SOURCES }
  for (const url of [`${base}/engine.js`, `${base}/player.js`, `${base}/engine.js?v=3`]) assert.equal(isAllowedEngineUrl(url, options), true, url)
  for (const url of [
    'https://otherproject.supabase.co/storage/v1/object/public/live2d-model/aliving2d/v2/engine.js', // another project
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/avatars/engine.js', // another bucket
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/../avatars/engine.js', // dot segments
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/%2e%2e/avatars/engine.js', // encoded
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/%252e%252e/avatars/engine.js',
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/a%2Fb.js',
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model\\..\\avatars/engine.js', // backslash
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model//engine.js',
    'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/', // the prefix itself
    'http://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/aliving2d/v2/engine.js', // http
    'https://user:pass@belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/engine.js',
    'https://belbmclzeenlntgpekww.supabase.co.evil.example/storage/v1/object/public/live2d-model/engine.js',
    '//belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/engine.js'.replace('//', 'http://'),
  ]) assert.equal(isAllowedEngineUrl(url, options), false, url)
  // Without the sources (the old options) the storage is not allowed; same-origin still is.
  assert.equal(isAllowedEngineUrl(`${base}/engine.js`, { pageOrigin: 'https://capsule.example' }), false)
  assert.equal(isAllowedEngineUrl('/engine/engine.js', { pageOrigin: 'https://capsule.example', sources: ENGINE_SOURCES }), true)
  // The real 채린 entry resolves to the live v2 renderer.
  const live = resolveMateSource({ modelUrl: 'https://belbmclzeenlntgpekww.supabase.co/storage/v1/object/public/live2d-model/aliving2d/chaerin/model.json', engineUrl: `${base}/engine.js`, playerUrl: `${base}/player.js`, format: 'ALIVING2D_V2' }, options)
  assert.equal(live.kind, 'aliving')
  // VITE_ENGINE_ALLOWLIST: exact https prefixes only; wildcards and malformed entries are dropped (default kept).
  assert.deepEqual(parseEngineSources(undefined), ENGINE_SOURCES)
  assert.deepEqual(parseEngineSources('https://cdn.example/engines/'), [{ origin: 'https://cdn.example', pathPrefix: '/engines/' }])
  for (const raw of ['https://*.supabase.co/', 'http://cdn.example/engines/', 'https://cdn.example/engines', 'https://cdn.example/a/%2e%2e/', 'https://cdn.example/e/?x=1', 'nonsense']) {
    assert.deepEqual(parseEngineSources(raw), ENGINE_SOURCES, raw)
  }
})
