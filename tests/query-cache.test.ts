import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryCache } from '../src/shared/api/query-cache.ts'

test('overlapping resource loads share work and freshness starts when the response arrives', async () => {
  let now = 0, calls = 0
  let finish!: (value: string) => void
  const cache = new QueryCache(() => now)
  const fetcher = () => { calls++; return new Promise<string>(resolve => { finish = resolve }) }
  const first = cache.load('home', fetcher, 10_000)
  const second = cache.load('home', fetcher, 10_000)
  await Promise.resolve()
  assert.equal(calls, 1)
  now = 30_000
  finish('fresh')
  assert.deepEqual(await Promise.all([first, second]), ['fresh', 'fresh'])
  now = 39_999
  assert.equal(await cache.load('home', async () => 'too soon', 10_000), 'fresh')
  now = 40_000
  assert.equal(await cache.load('home', async () => 'updated', 10_000), 'updated')
})

test('failed queries are never retained and can be retried immediately', async () => {
  const cache = new QueryCache()
  await assert.rejects(cache.load('avatars', async () => { throw new Error('network') }, 300_000))
  assert.deepEqual(await cache.load('avatars', async () => [1], 300_000), [1])
})

test('invalidation after a save prevents a late read from replacing the new cached value', async () => {
  const cache = new QueryCache()
  let finish!: (value: string[]) => void
  const old = cache.load('memories', () => new Promise<string[]>(resolve => { finish = resolve }), 10_000)
  await Promise.resolve()
  cache.invalidate('memories')
  assert.deepEqual(await cache.load('memories', async () => ['saved'], 10_000), ['saved'])
  finish([])
  await old
  assert.deepEqual(await cache.load('memories', async () => ['wrong'], 10_000), ['saved'])
})

test('clearing an account drops all resources and rejects stale cache refills', async () => {
  const cache = new QueryCache()
  await cache.load('avatars', async () => ['account-a'], 300_000)
  let finish!: (value: string) => void
  const old = cache.load('home', () => new Promise<string>(resolve => { finish = resolve }), 10_000)
  await Promise.resolve()
  cache.clear()
  finish('account-a')
  await old
  assert.equal(await cache.load('home', async () => 'account-b', 10_000), 'account-b')
  assert.deepEqual(await cache.load('avatars', async () => ['account-b'], 300_000), ['account-b'])
})
