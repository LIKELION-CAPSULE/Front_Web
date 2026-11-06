import test from 'node:test'
import assert from 'node:assert/strict'
import { flushSessionOutbox } from '../src/features/backend/session-outbox.ts'
import type { StateEvent } from '../src/features/backend/presence-clock.ts'

const event = (type: StateEvent['type']): StateEvent => ({ type, occurredAt: '2026-11-06T00:00:00Z' })
function fixture() { return { alive: true, outbox: [event('AWAY'), event('RETURN')], draining: null as Promise<void> | null, flow: { revision: 1 } } }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('leaving during an event request stops queued events and late account updates', async () => {
  const current = fixture(), response = deferred<string>()
  const sent: string[] = [], updated: string[] = []
  const draining = flushSessionOutbox(current, event => { sent.push(event.type); return response.promise }, result => { updated.push(result) })
  current.alive = false
  response.resolve('old-account-affinity')
  await draining
  assert.deepEqual(sent, ['AWAY'])
  assert.deepEqual(updated, [])
  assert.deepEqual(current.outbox, [event('RETURN')])
  assert.equal(current.draining, null)
})

test('a stopped runtime sends nothing even when its flush is called again', async () => {
  const current = fixture()
  current.alive = false
  await flushSessionOutbox(current, async () => assert.fail('stale request'), () => assert.fail('stale update'))
  assert.equal(current.outbox.length, 2)
})

test('concurrent flushes share one ordered queue and use each request revision', async () => {
  const current = fixture(), response = deferred<number>()
  const sent: string[] = [], revisions: number[] = []
  const send = (event: StateEvent) => { sent.push(event.type); return sent.length === 1 ? response.promise : Promise.resolve(2) }
  const onSent = (_result: number, _event: StateEvent, revision: number) => { revisions.push(revision) }
  const first = flushSessionOutbox(current, send, onSent)
  assert.equal(flushSessionOutbox(current, send, onSent), first)
  current.flow.revision++
  response.resolve(1)
  await first
  assert.deepEqual(sent, ['AWAY', 'RETURN'])
  assert.deepEqual(revisions, [1, 2])
  assert.equal(current.outbox.length, 0)
})

test('a failed event remains queued for retry without losing the following event', async () => {
  const current = fixture(), sent: string[] = []
  await assert.rejects(flushSessionOutbox(current, async () => { throw new Error('offline') }, () => {}), /offline/)
  assert.equal(current.draining, null)
  assert.equal(current.outbox.length, 2)
  await flushSessionOutbox(current, async event => { sent.push(event.type) }, () => {})
  assert.deepEqual(sent, ['AWAY', 'RETURN'])
})
