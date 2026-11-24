import test from 'node:test'
import assert from 'node:assert/strict'
import { localAssetsPlugin } from '../server/local-assets.ts'

type Handler = (req: { url?: string; method?: string }, res: { statusCode: number; end: () => void; setHeader: () => void }, next: () => void) => void

function mounts() {
  const used: { prefix: string; handler: Handler }[] = []
  const plugin = localAssetsPlugin() as unknown as { configureServer: (server: unknown) => void }
  plugin.configureServer({ middlewares: { use: (prefix: string, handler: Handler) => used.push({ prefix, handler }) } })
  return used
}

test('chaerin-v3 and chaerin-v2 are mounted before /chaerin, so neither is swallowed by the shorter prefix', () => {
  const order = mounts().map((m) => m.prefix)
  const at = (prefix: string) => order.indexOf(prefix)
  assert.ok(at('/__local-assets/chaerin-v3') >= 0, 'v3 is served')
  assert.ok(at('/__local-assets/chaerin-v2') >= 0, 'v2 is still served')
  assert.ok(at('/__local-assets/chaerin-v3') < at('/__local-assets/chaerin'))
  assert.ok(at('/__local-assets/chaerin-v2') < at('/__local-assets/chaerin'))
})

test('a /chaerin-v3 request that reaches the /chaerin mount is passed on, not answered', () => {
  const chaerin = mounts().find((m) => m.prefix === '/__local-assets/chaerin')!
  let passed = false
  let status = 0
  // connect strips the mount prefix: '/__local-assets/chaerin-v3/model/model.json' arrives as '-v3/model/model.json'.
  chaerin.handler({ url: '-v3/model/model.json', method: 'GET' }, { statusCode: 0, end: () => { status = 404 }, setHeader: () => {} }, () => { passed = true })
  assert.equal(passed, true)
  assert.equal(status, 0)
})

test('the v3 mount answers only the bundle allowlist', () => {
  const v3 = mounts().find((m) => m.prefix === '/__local-assets/chaerin-v3')!
  const res = { statusCode: 200, end: () => {}, setHeader: () => {} }
  v3.handler({ url: '/model/../../secret.txt', method: 'GET' }, res, () => {})
  assert.equal(res.statusCode, 404)
})
