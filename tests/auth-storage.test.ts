import test from 'node:test'
import assert from 'node:assert/strict'
import { clearKakaoLogin, readKakaoLogin, rememberLoginProvider, saveKakaoLogin } from '../src/features/auth/auth-storage.ts'

const login = { state: 'random-state', next: '/rooms/11', redirect: 'https://front.example/oauth/kakao' }
function memoryStorage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
const blocked = () => { throw new DOMException('Storage denied', 'SecurityError') }

test('OAuth state survives the redirect and cleanup preserves unrelated tab data', () => {
  const storage = memoryStorage()
  assert.equal(saveKakaoLogin(login, () => storage), true)
  assert.deepEqual(readKakaoLogin(() => storage), login)
  rememberLoginProvider('KAKAO', () => storage)
  clearKakaoLogin(() => storage)
  assert.equal(readKakaoLogin(() => storage), null)
  assert.equal(storage.getItem('capsule-login-provider'), 'KAKAO')
})

test('denied storage prevents OAuth entry and does not break callback cleanup or successful email login', () => {
  assert.equal(saveKakaoLogin(login, blocked), false)
  assert.equal(readKakaoLogin(blocked), null)
  assert.doesNotThrow(() => clearKakaoLogin(blocked))
  assert.doesNotThrow(() => rememberLoginProvider('EMAIL', blocked))
})

test('readable storage with a failed or silently discarded write cannot start OAuth', () => {
  const storage = memoryStorage()
  storage.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') }
  assert.equal(saveKakaoLogin(login, () => storage), false)
  assert.doesNotThrow(() => rememberLoginProvider('KAKAO', () => storage))
  storage.setItem = () => {}
  assert.equal(saveKakaoLogin(login, () => storage), false)
})

test('malformed and incomplete saved OAuth state safely return to the login screen', () => {
  const storage = memoryStorage()
  for (const value of ['{', 'null', '42', '[]', '{"state":7}', '{"state":"a","next":"/","redirect":false}', '{"state":"","next":"/","redirect":"/oauth/kakao"}']) {
    storage.setItem('capsule-kakao', value)
    assert.equal(readKakaoLogin(() => storage), null)
  }
})

test('storage becoming unavailable during callback cleanup never blocks navigation', () => {
  const storage = memoryStorage()
  storage.removeItem = blocked
  assert.doesNotThrow(() => clearKakaoLogin(() => storage))
})
