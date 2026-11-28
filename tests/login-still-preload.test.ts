import assert from 'node:assert/strict'
import test from 'node:test'
import { builtAssetFile, LOGIN_STILL_SOURCE, loginStillPreloadScript } from '../server/login-still-preload.ts'

test('login still preload: the built (hashed) file of the doze still is found in the bundle', () => {
  const bundle = {
    'assets/index-a1.js': { type: 'chunk', fileName: 'assets/index-a1.js' },
    'assets/chaerin-v2-doze-DheZY30m.webp': { type: 'asset', fileName: 'assets/chaerin-v2-doze-DheZY30m.webp', originalFileNames: [LOGIN_STILL_SOURCE] },
    'assets/chaerin-v2-doze-other-X1.webp': { type: 'asset', fileName: 'assets/chaerin-v2-doze-other-X1.webp', originalFileNames: ['src/assets/x/chaerin-v2-doze-other.webp'] },
  }
  assert.equal(builtAssetFile(bundle, LOGIN_STILL_SOURCE), 'assets/chaerin-v2-doze-DheZY30m.webp')
  assert.equal(builtAssetFile({}, LOGIN_STILL_SOURCE), null)
})

test('login still preload: only the login layout paths, CORS and high priority like the stage image', () => {
  const script = loginStillPreloadScript('/assets/chaerin-v2-doze-DheZY30m.webp')
  const pattern = new RegExp(script.match(/if \(!\/(.+)\/\.test\(location\.pathname\)\) return/)![1]!)
  for (const path of ['/login', '/login/', '/login/kakao-terms']) assert.ok(pattern.test(path), path)
  for (const path of ['/', '/mates/me', '/records', '/password/reset', '/loginx', '/onboarding']) assert.ok(!pattern.test(path), path)
  assert.match(script, /link\.href = "\/assets\/chaerin-v2-doze-DheZY30m\.webp"/)
  assert.match(script, /link\.crossOrigin = 'anonymous'/)
  assert.match(script, /link\.fetchPriority = 'high'/)
})
