import test from 'node:test'
import assert from 'node:assert/strict'
import { SettingsSaveQueue } from '../src/features/mates/settings-save-queue.ts'
import type { UserSettings, UserSettingsPatch } from '../src/shared/api/types.ts'

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
/** Manual timers: `run()` fires what is due. */
function timers() {
  const queue = new Map<number, () => void>()
  let next = 0
  return {
    timers: { set: (callback: () => void) => { queue.set(++next, callback); return next }, clear: (id: unknown) => { queue.delete(id as number) } },
    run: () => { const due = [...queue.values()]; queue.clear(); due.forEach(callback => callback()) },
    size: () => queue.size,
  }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('a late GET never overwrites what the user changed after it was sent', async () => {
  const get = deferred<UserSettings>()
  const applied: UserSettings[] = []
  const clock = timers()
  const queue = new SettingsSaveQueue({ load: () => get.promise, save: async () => null, applyServer: value => { applied.push(value) }, timers: clock.timers })
  const loading = queue.load()
  queue.change({ voiceVolume: 30 })
  clock.run()
  await tick()
  get.resolve({ voiceVolume: 70, pipSize: 'L', talkFrequency: 'OFTEN' })
  await loading
  assert.deepEqual(applied, [{ pipSize: 'L', talkFrequency: 'OFTEN' }], 'voiceVolume (changed meanwhile, even already saved) is left alone')
})

test('PATCHes go one at a time in order; changes made meanwhile follow with the newest values', async () => {
  const sent: UserSettingsPatch[] = []
  const pending: ReturnType<typeof deferred<null>>[] = []
  const clock = timers()
  const queue = new SettingsSaveQueue({ load: async () => ({}), applyServer: () => {}, timers: clock.timers,
    save: body => { sent.push(body); const call = deferred<null>(); pending.push(call); return call.promise } })
  queue.change({ voiceVolume: 10 })
  clock.run()
  queue.change({ voiceVolume: 20, pipSize: 'S' })
  clock.run()
  queue.change({ voiceVolume: 30 })
  clock.run()
  await tick()
  assert.deepEqual(sent, [{ voiceVolume: 10 }], 'nothing else while the first is in flight')
  pending[0]!.resolve(null)
  await tick(); await tick()
  assert.deepEqual(sent.at(-1), { voiceVolume: 30, pipSize: 'S' }, 'then the newest values, once')
  pending[1]!.resolve(null)
  await tick(); await tick()
  assert.equal(sent.length, 2)
  assert.equal(queue.status, 'idle')
  assert.equal(queue.pending, false)
})

test('a failed batch is kept, merged with later changes and sent again; 「다시 저장」 and one automatic retry', async () => {
  const sent: UserSettingsPatch[] = []
  let fail = true
  const statuses: string[] = []
  const clock = timers()
  const queue = new SettingsSaveQueue({ load: async () => ({}), applyServer: () => {}, timers: clock.timers, onStatus: status => { statuses.push(status) },
    save: async body => { sent.push(body); if (fail) throw new Error('offline') ; return null } })
  queue.change({ voiceVolume: 10 })
  clock.run(); await tick(); await tick()
  assert.equal(queue.status, 'error')
  assert.equal(clock.size(), 1, 'one automatic retry is scheduled')
  clock.run(); await tick(); await tick()
  assert.equal(clock.size(), 0, 'and only one')
  queue.change({ pipSize: 'L' })
  fail = false
  clock.run(); await tick(); await tick()
  assert.deepEqual(sent.at(-1), { voiceVolume: 10, pipSize: 'L' }, 'the failed key goes out with the new one')
  assert.equal(queue.status, 'idle')
  fail = true
  queue.change({ talkFrequency: 'QUIET' })
  clock.run(); await tick(); await tick()
  fail = false
  await queue.retry()
  assert.deepEqual(sent.at(-1), { talkFrequency: 'QUIET' })
  assert.deepEqual(statuses.filter((value, index) => value !== statuses[index - 1]).slice(-2), ['saving', 'idle'])
})

test('before signing out the debounced change is saved at once; another account drops what is left', async () => {
  const sent: UserSettingsPatch[] = []
  const clock = timers()
  const queue = new SettingsSaveQueue({ load: async () => ({}), applyServer: () => {}, timers: clock.timers, save: async body => { sent.push(body); return null } })
  queue.change({ defaultMode: 'ADVANCED' })
  await queue.flushNow()
  assert.deepEqual(sent, [{ defaultMode: 'ADVANCED' }], 'no 600 ms wait')
  assert.equal(clock.size(), 0)
  queue.change({ pipBubble: false })
  queue.dispose()
  clock.run(); await tick()
  assert.equal(sent.length, 1, 'nothing for the previous account after switching')
  const applied: UserSettings[] = []
  const late = new SettingsSaveQueue({ load: async () => ({ pipSize: 'L' }), applyServer: value => { applied.push(value) }, save: async () => null })
  const loading = late.load()
  late.dispose()
  await loading
  assert.deepEqual(applied, [], 'a GET answering after the switch shows nothing')
})

test('flushNow waits for changes made while a save was on its way (A saving, B changed, A done → B too)', async () => {
  const sent: UserSettingsPatch[] = []
  const pending: ReturnType<typeof deferred<null>>[] = []
  const clock = timers()
  const queue = new SettingsSaveQueue({ load: async () => ({}), applyServer: () => {}, timers: clock.timers,
    save: body => { sent.push(body); const call = deferred<null>(); pending.push(call); return call.promise } })
  queue.change({ voiceVolume: 10 })
  clock.run()
  await tick()
  queue.change({ pipSize: 'S' })
  let done = false
  const flushing = queue.flushNow().then(() => { done = true })
  const second = queue.flushNow()
  assert.equal(second, queue.flushNow(), 'every caller shares one drain')
  pending[0]!.resolve(null)
  await tick(); await tick()
  assert.equal(done, false, 'A alone does not end the drain')
  assert.deepEqual(sent.at(-1), { pipSize: 'S' }, 'B goes out right after A')
  pending[1]!.resolve(null)
  await flushing
  assert.equal(done, true)
  assert.equal(queue.pending, false)
})

test('flushNow ends (never hangs) when the save fails', async () => {
  const clock = timers()
  let calls = 0
  const pending: ReturnType<typeof deferred<null>>[] = []
  const queue = new SettingsSaveQueue({ load: async () => ({}), applyServer: () => {}, timers: clock.timers,
    save: () => { calls++; const call = deferred<null>(); pending.push(call); return call.promise } })
  queue.change({ voiceVolume: 10 })
  clock.run()
  await tick()
  queue.change({ pipSize: 'S' })
  const flushing = queue.flushNow()
  pending[0]!.reject(new Error('offline'))
  await flushing
  assert.equal(queue.status, 'error')
  assert.equal(calls, 1, 'stops at the failure; the unsaved keys stay for 「다시 저장」')
  assert.equal(queue.pending, true)
})

test('confirmed: false for a browser cache until the server copy is read or the user changes the key', async () => {
  const get = deferred<UserSettings>()
  const queue = new SettingsSaveQueue({ load: () => get.promise, save: async () => null, applyServer: () => {}, timers: timers().timers })
  const loading = queue.load()
  assert.equal(queue.confirmed('defaultMode'), false)
  get.resolve({ defaultMode: 'BASIC' })
  await loading
  assert.equal(queue.confirmed('defaultMode'), true)
  const other = new SettingsSaveQueue({ load: () => new Promise(() => {}), save: async () => null, applyServer: () => {}, timers: timers().timers })
  void other.load()
  other.change({ defaultMode: 'ADVANCED' })
  assert.equal(other.confirmed('defaultMode'), true, 'changed by the user in this session')
  assert.equal(other.confirmed('talkFrequency'), false)
})
