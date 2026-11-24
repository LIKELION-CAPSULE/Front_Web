import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  detectModelFormat,
  resolveMateSource,
  resolvePreviewSource,
} from '../src/features/mate-render/mate-source.ts'
import {
  CHAERIN_V2_LANDMARKS,
  CHAERIN_V2_RENDERS,
  computeContainedImageBox,
  computePreviewView,
  computeStillMatchedView,
  modelPointToScreen,
} from '../src/features/mate-render/aliving-view.ts'
import {
  CUBISM_TO_V2_EXPRESSION,
  V2_EXPRESSIONS,
  toV2ExpressionName,
} from '../src/features/mate-render/expression-map.ts'
import { checkedMateDetail } from '../src/features/mates/mate-contract.ts'

const opts = { pageOrigin: 'https://app.capsule.kr', apiBaseUrl: 'https://api.capsule.kr' }
const v2 = {
  modelJsonUrl: 'https://api.capsule.kr/assets/chaerin-v2/model/model.json',
  engineUrl: 'https://api.capsule.kr/assets/engine/engine.js',
}

test('resolvePreviewSource: v2 -> aliving, other models -> legacy, missing or blocked v2 fields -> static', () => {
  assert.deepEqual(resolvePreviewSource(undefined, opts), { kind: 'static' })
  assert.deepEqual(resolvePreviewSource({}, opts), { kind: 'static' })
  assert.deepEqual(resolvePreviewSource({ modelJsonUrl: '  ' }, opts), { kind: 'static' })

  assert.deepEqual(resolvePreviewSource(v2, opts), {
    kind: 'aliving',
    modelUrl: v2.modelJsonUrl,
    engineUrl: v2.engineUrl,
    playerUrl: 'https://api.capsule.kr/assets/engine/player.js',
    reactionsUrl: undefined,
  })
  // api mode without the engine field (or on a foreign origin) -> v2 still image, never the legacy loader
  assert.deepEqual(resolvePreviewSource({ modelJsonUrl: v2.modelJsonUrl }, opts), { kind: 'static' })
  assert.deepEqual(
    resolvePreviewSource({ ...v2, engineUrl: 'https://cdn.example.com/engine.js' }, opts),
    { kind: 'static' },
  )
  // Cubism and the review workbench's image stage stay on the injected legacy factory
  assert.deepEqual(resolvePreviewSource({ modelJsonUrl: '/m/model.model3.json' }, opts), {
    kind: 'legacy',
    modelUrl: '/m/model.model3.json',
  })
  assert.deepEqual(resolvePreviewSource({ modelJsonUrl: '/review/chaerin.webp' }, opts), {
    kind: 'legacy',
    modelUrl: '/review/chaerin.webp',
  })
  // Format hint wins over hashed CDN file names
  assert.equal(
    resolvePreviewSource({ ...v2, modelJsonUrl: 'https://api.capsule.kr/a/chaerin.3f9a.json', format: 'aliving2d' }, opts).kind,
    'aliving',
  )
})

test('detectModelFormat uses the hint first, then the URL suffix (query/hash ignored)', () => {
  assert.equal(detectModelFormat('/a/model.json?sig=1'), 'aliving2d')
  assert.equal(detectModelFormat('/a/model.model3.json#x'), 'cubism')
  assert.equal(detectModelFormat('/a/x.json'), null)
  assert.equal(detectModelFormat('/a/x.json', 'Aliving2D'), 'aliving2d')
  assert.equal(detectModelFormat('/a/model.json', 'cubism'), 'cubism')
  assert.equal(detectModelFormat('/a/model.json', 'unknown'), 'aliving2d')
  assert.equal(detectModelFormat(''), null)
  // Existing resolveMateSource behaviour is unchanged without a hint
  assert.equal(resolveMateSource({ modelUrl: '/a/model.model3.json' }, opts).kind, 'cubism')
})

test('checkedMateDetail keeps well-formed v2 model fields and drops malformed ones without failing', () => {
  const detail = checkedMateDetail(
    {
      characterId: 7,
      model: { ...v2, playerUrl: 'https://api.capsule.kr/assets/engine/player.js', reactionsUrl: 'javascript:alert(1)', format: ' aliving2d ' },
    },
    7,
  )
  assert.deepEqual(detail.model, {
    modelJsonUrl: v2.modelJsonUrl,
    engineUrl: v2.engineUrl,
    playerUrl: 'https://api.capsule.kr/assets/engine/player.js',
    format: 'aliving2d',
  })
  const loose = checkedMateDetail(
    { characterId: 7, model: { modelJsonUrl: v2.modelJsonUrl, engineUrl: 42 as unknown as string } },
    7,
  )
  assert.deepEqual(loose.model, { modelJsonUrl: v2.modelJsonUrl })
  assert.equal(resolvePreviewSource(loose.model, opts).kind, 'static')
})

test('CHAERIN_V2_RENDERS mirrors renders.json (1x size = file size / 2)', () => {
  const renders = JSON.parse(
    readFileSync(new URL('../src/assets/characters/chaerin-v2/renders.json', import.meta.url), 'utf8'),
  ) as Record<string, { size: [number, number]; view: { zoom: number; cx: number; cy: number } }>
  for (const [key, render] of Object.entries(CHAERIN_V2_RENDERS)) {
    const source = renders[`chaerin-v2-${key}`]
    assert.ok(source, key)
    assert.deepEqual(render.view, source.view, key)
    assert.deepEqual([render.size.width * 2, render.size.height * 2], source.size, key)
  }
})

test('computeStillMatchedView reproduces the still render at its own size and stays aligned when contained', () => {
  const hero = CHAERIN_V2_RENDERS.hero
  const same = computeStillMatchedView(760, 900, hero, { left: 0, top: 0, width: 760, height: 900 })
  assert.ok(Math.abs(same.zoom - hero.view.zoom) < 1e-9)
  assert.ok(Math.abs(same.cx - hero.view.cx) < 1e-9)
  assert.ok(Math.abs(same.cy - hero.view.cy) < 1e-9)

  // For any stage size, the model's eyes land where they are in the contained (center-bottom) still image.
  for (const [cw, ch] of [[360, 480], [300, 400], [640, 300], [1000, 360]]) {
    const view = computePreviewView(cw!, ch!)
    const box = computeContainedImageBox(cw!, ch!, hero.size.width, hero.size.height, 1)
    const live = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.eyesY, cw!, ch!, view)
    // Same point inside the still: render projection scaled into the box
    const inRender = modelPointToScreen(CHAERIN_V2_LANDMARKS.centerX, CHAERIN_V2_LANDMARKS.eyesY, 760, 900, hero.view)
    const scale = box.width / 760
    assert.ok(Math.abs(live.x - (box.left + inRender.x * scale)) < 1e-6, `x at ${cw}x${ch}`)
    assert.ok(Math.abs(live.y - (box.top + inRender.y * scale)) < 1e-6, `y at ${cw}x${ch}`)
    // Bottom-aligned: the image bottom touches the stage bottom
    assert.ok(Math.abs(box.top + box.height - ch!) < 1e-9)
  }
})

test('expression table: every legacy Cubism file maps to an existing v2 expression', () => {
  const v2Names = new Set<string>(V2_EXPRESSIONS.map((item) => item.name))
  const files = Object.keys(CUBISM_TO_V2_EXPRESSION)
  assert.deepEqual(files, Array.from({ length: 8 }, (_, i) => `files/${String(i + 4).padStart(3, '0')}.exp3.json`))
  for (const file of files) assert.ok(v2Names.has(CUBISM_TO_V2_EXPRESSION[file]!), file)
  // One-to-one
  assert.equal(new Set(Object.values(CUBISM_TO_V2_EXPRESSION)).size, files.length)

  assert.equal(toV2ExpressionName('files/009.exp3.json'), 'laugh')
  assert.equal(toV2ExpressionName('/__local-assets/chaerin/files/005.exp3.json?v=1'), 'happy')
  assert.equal(toV2ExpressionName('happy'), 'happy')
  assert.equal(toV2ExpressionName('삐짐'), 'sulky')
  assert.equal(toV2ExpressionName(''), null)
  assert.equal(toV2ExpressionName(null), null)
  assert.equal(toV2ExpressionName('neutral'), null)
  assert.equal(toV2ExpressionName('files/012.exp3.json'), undefined)
  assert.equal(toV2ExpressionName('exp/smile.exp3.json'), undefined)
})
