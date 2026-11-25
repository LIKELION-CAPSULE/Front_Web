import test from 'node:test'
import assert from 'node:assert/strict'
import { canPrefetchModels, modelFileUrls, prefetchModels, prefetchTargets, PREFETCH_MAX_MODELS, resetModelPrefetch } from '../src/features/live2d/model-prefetch.ts'

test('prefetch targets: the choices either side of the current one (wrapping), each once, never the current one', () => {
  const urls = ['/a.model3.json', '/b.model3.json', '/c.model3.json']
  assert.deepEqual(prefetchTargets(urls, 0), ['/b.model3.json', '/c.model3.json'])
  assert.deepEqual(prefetchTargets(urls, 1), ['/c.model3.json', '/a.model3.json'])
  assert.deepEqual(prefetchTargets(['/a', '/b'], 0), ['/b'], 'two choices: the other one once')
  assert.deepEqual(prefetchTargets(['/a'], 0), [])
  assert.deepEqual(prefetchTargets(['/a', null, '/c', '/a'], 0), [], 'a static neighbour and the same model again are skipped')
  assert.deepEqual(prefetchTargets(['/a', null, '/c', '/d'], 2), ['/d'])
})

test('prefetch is off when saving data, on 2g, or with little memory or few cores', () => {
  assert.equal(canPrefetchModels({ deviceMemory: 8, hardwareConcurrency: 8, connection: { effectiveType: '4g' } }), true)
  assert.equal(canPrefetchModels({}), true, 'unknown values do not block')
  assert.equal(canPrefetchModels({ connection: { saveData: true } }), false)
  assert.equal(canPrefetchModels({ connection: { effectiveType: '2g' } }), false)
  assert.equal(canPrefetchModels({ connection: { effectiveType: 'slow-2g' } }), false)
  assert.equal(canPrefetchModels({ deviceMemory: 2 }), false)
  assert.equal(canPrefetchModels({ hardwareConcurrency: 2 }), false)
  assert.equal(canPrefetchModels(null), false, 'no navigator')
})

test('the files of a model’s first draw, resolved against its model3.json', () => {
  const urls = modelFileUrls({ FileReferences: { Moc: 'm.moc3', Textures: ['t/0.png', 't/1.png', 't/0.png'], Physics: 'p.physics3.json', Pose: '', DisplayInfo: 'd.cdi3.json' } }, 'https://cdn.example/avatars/a/a.model3.json')
  assert.deepEqual(urls, ['https://cdn.example/avatars/a/m.moc3', 'https://cdn.example/avatars/a/t/0.png', 'https://cdn.example/avatars/a/t/1.png', 'https://cdn.example/avatars/a/p.physics3.json', 'https://cdn.example/avatars/a/d.cdi3.json'])
  assert.deepEqual(modelFileUrls({}, 'https://cdn.example/a.model3.json'), [])
})

test('prefetch downloads into the cache only: each model once, one at a time, at most PREFETCH_MAX_MODELS per session', async () => {
  resetModelPrefetch()
  const requested: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    requested.push(url)
    if (url.endsWith('.model3.json')) return new Response(JSON.stringify({ FileReferences: { Moc: 'x.moc3', Textures: ['x.png'] } }))
    return new Response(new Uint8Array(4))
  }) as typeof fetch
  try {
    const models = Array.from({ length: PREFETCH_MAX_MODELS + 2 }, (_, index) => `https://cdn.example/m${index}/m.model3.json`)
    prefetchModels(models.slice(0, 2))
    prefetchModels(models.slice(0, 2)) // again: nothing new
    prefetchModels(models)
    await new Promise(resolve => setTimeout(resolve, 50))
    const modelFiles = requested.filter(url => url.endsWith('.model3.json'))
    assert.equal(modelFiles.length, PREFETCH_MAX_MODELS)
    assert.equal(new Set(modelFiles).size, modelFiles.length)
    assert.equal(requested.length, PREFETCH_MAX_MODELS * 3, 'model3.json, moc and texture per model')
  } finally {
    globalThis.fetch = original
    resetModelPrefetch()
  }
})
