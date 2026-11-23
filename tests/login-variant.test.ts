import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LOGIN_VARIANT_STORAGE_KEY,
  hasExplicitLoginVariant,
  isLoginVariantPath,
  parseLoginVariant,
  resolveLoginVariant,
} from '../src/features/auth/login-variants/login-variant.ts'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  }
}

test('parseLoginVariant accepts known variants case-insensitively and rejects others', () => {
  assert.equal(parseLoginVariant('Portrait'), 'portrait')
  assert.equal(parseLoginVariant(' illustration '), 'illustration')
  assert.equal(parseLoginVariant('video'), null)
  assert.equal(parseLoginVariant('poster'), null)
  assert.equal(parseLoginVariant(null), null)
})

test('resolveLoginVariant prefers the query, remembers it, and clears it for desktop', () => {
  const storage = memoryStorage()
  assert.equal(resolveLoginVariant('', storage), 'desktop')
  assert.equal(resolveLoginVariant('?login=illustration', storage), 'illustration')
  assert.equal(storage.map.get(LOGIN_VARIANT_STORAGE_KEY), 'illustration')
  assert.equal(resolveLoginVariant('?mode=signup', storage), 'illustration')
  assert.equal(hasExplicitLoginVariant('?mode=signup', storage), true)
  assert.equal(resolveLoginVariant('?login=desktop', storage), 'desktop')
  assert.equal(storage.map.has(LOGIN_VARIANT_STORAGE_KEY), false)
  assert.equal(hasExplicitLoginVariant('', storage), false)
})

test('resolveLoginVariant survives blocked storage', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
  }
  assert.equal(resolveLoginVariant('?login=portrait', blocked), 'portrait')
  assert.equal(resolveLoginVariant('', blocked), 'desktop')
  assert.equal(resolveLoginVariant('', null), 'desktop')
})

test('only /login switches concepts', () => {
  assert.equal(isLoginVariantPath('/login'), true)
  assert.equal(isLoginVariantPath('/login/'), true)
  assert.equal(isLoginVariantPath('/onboarding'), false)
  assert.equal(isLoginVariantPath('/password/reset'), false)
})
