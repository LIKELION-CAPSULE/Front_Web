import test from 'node:test'
import assert from 'node:assert/strict'
import { accountScope } from '../src/features/backend/account-scope.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('the same account can finish a multi-step operation', async () => {
  const account = accountScope(() => 1)
  assert.equal(await account.wait(Promise.resolve('refreshed')), 'refreshed')
  assert.equal(await account.wait(Promise.resolve('finished')), 'finished')
})

test('an account switch while waiting prevents the next mutation', async () => {
  let generation = 1, mutated = false
  const account = accountScope(() => generation)
  const refresh = deferred<void>()
  const operation = (async () => {
    await account.wait(refresh.promise)
    mutated = true
  })()
  const rejection = assert.rejects(operation, { code: 'AUTH_SESSION_CHANGED', status: 401 })
  generation++
  refresh.resolve()
  await rejection
  assert.equal(mutated, false)
})

test('an old successful response cannot clear or overwrite a newly authenticated account', async () => {
  let generation = 1, cleared = false
  const account = accountScope(() => generation)
  await account.wait(Promise.resolve())
  const response = deferred<void>()
  const operation = (async () => {
    await account.wait(response.promise)
    cleared = true
  })()
  const rejection = assert.rejects(operation, { code: 'AUTH_SESSION_CHANGED' })
  generation++
  response.resolve()
  await rejection
  assert.equal(cleared, false)
})

test('network failures stay available to the original operation error handler', async () => {
  const failure = new Error('offline')
  await assert.rejects(accountScope(() => 1).wait(Promise.reject(failure)), error => error === failure)
})
