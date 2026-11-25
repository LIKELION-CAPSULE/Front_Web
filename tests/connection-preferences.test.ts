import test from 'node:test'
import assert from 'node:assert/strict'
import { PipSpeechPreference, pipSpeechKey } from '../src/features/mates/connection-preferences.ts'
import { removeAccountSnapshots } from '../src/features/auth/account-storage.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

test('PIP bubble preferences survive reopening and remain isolated by account', () => {
  const storage = memoryStorage()
  const first = new PipSpeechPreference(storage, 7)
  assert.equal(first.getSnapshot(), true)
  first.setVisible(false)
  assert.equal(new PipSpeechPreference(storage, 7).getSnapshot(), false)
  assert.equal(new PipSpeechPreference(storage, 8).getSnapshot(), true)
  assert.equal(new PipSpeechPreference(storage, null).getSnapshot(), true)
  assert.deepEqual([...storage.values.keys()], [pipSpeechKey(7)])
})

test('invalid or unavailable storage keeps the visible default and allows an in-memory toggle', () => {
  for (const value of ['{', 'null', '0', '"false"', '{"visible":false}']) {
    const storage = memoryStorage(); storage.setItem(pipSpeechKey(7), value)
    assert.equal(new PipSpeechPreference(storage, 7).getSnapshot(), true)
  }
  const preference = new PipSpeechPreference({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }, 7)
  preference.setVisible(false)
  assert.equal(preference.getSnapshot(), false)
  preference.setVisible(true)
  assert.equal(preference.getSnapshot(), true)
})

test('only changed PIP preferences notify subscribers, and removed listeners stay removed', () => {
  const preference = new PipSpeechPreference(null, null)
  let count = 0
  const unsubscribe = preference.subscribe(() => { count++ })
  preference.setVisible(true); assert.equal(count, 0)
  preference.setVisible(false); assert.equal(count, 1)
  unsubscribe(); preference.setVisible(true); assert.equal(count, 1)
})

test('withdrawal removes the selected account PIP preference while retaining other accounts', () => {
  const storage = memoryStorage()
  new PipSpeechPreference(storage, 7).setVisible(false)
  new PipSpeechPreference(storage, 8).setVisible(false)
  removeAccountSnapshots({ get length() { return storage.values.size }, key: index => [...storage.values.keys()][index] ?? null, removeItem: key => { storage.values.delete(key) } }, 7)
  assert.equal(new PipSpeechPreference(storage, 7).getSnapshot(), true)
  assert.equal(new PipSpeechPreference(storage, 8).getSnapshot(), false)
})

import { ConnectionSettingsStore, connectionSettingsKey, DEFAULT_CONNECTION_SETTINGS, mateVoicePlayback, parseConnectionSettings, PIP_WINDOW_SIZE } from '../src/features/mates/connection-preferences.ts'

test('connection settings: defaults, kept per account, broken values fall back field by field', () => {
  const storage = memoryStorage()
  const store = new ConnectionSettingsStore(storage, 7)
  assert.deepEqual(store.getSnapshot(), DEFAULT_CONNECTION_SETTINGS)
  assert.deepEqual(DEFAULT_CONNECTION_SETTINGS, { talk: 'sometimes', voice: true, voiceOptIn: false, volume: 70, speed: 'normal', mode: 'basic', holdToTalk: true, pipSize: 'normal', gaze: true })
  store.update({ talk: 'often', volume: 35, speed: 'fast', mode: 'advanced', pipSize: 'large', gaze: false, holdToTalk: false, voice: false })
  const reopened = new ConnectionSettingsStore(storage, 7).getSnapshot()
  assert.deepEqual(reopened, { talk: 'often', voice: false, voiceOptIn: false, volume: 35, speed: 'fast', mode: 'advanced', holdToTalk: false, pipSize: 'large', gaze: false })
  assert.deepEqual(new ConnectionSettingsStore(storage, 8).getSnapshot(), DEFAULT_CONNECTION_SETTINGS)
  assert.ok(storage.values.has(connectionSettingsKey(7)))
  assert.deepEqual(parseConnectionSettings({ talk: 'loud', volume: 250, speed: 3, gaze: 'yes' }), { ...DEFAULT_CONNECTION_SETTINGS, volume: 100 })
  storage.setItem(connectionSettingsKey(9), '{broken')
  assert.deepEqual(new ConnectionSettingsStore(storage, 9).getSnapshot(), DEFAULT_CONNECTION_SETTINGS)
})

test('connection settings survive blocked storage in memory and notify only on change', () => {
  const store = new ConnectionSettingsStore({ getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }, 7)
  let count = 0
  store.subscribe(() => { count++ })
  store.update({ volume: 70 })
  assert.equal(count, 0)
  store.update({ volume: 10 })
  assert.equal(store.getSnapshot().volume, 10)
  assert.equal(count, 1)
})

test('voice playback and PIP sizes read from the settings', () => {
  assert.deepEqual(mateVoicePlayback({ volume: 70, speed: 'normal' }), { volume: 0.7, playbackRate: 1 })
  assert.deepEqual(mateVoicePlayback({ volume: 0, speed: 'slow' }), { volume: 0, playbackRate: 0.85 })
  assert.equal(mateVoicePlayback({ volume: 100, speed: 'fast' }).playbackRate, 1.2)
  assert.deepEqual(PIP_WINDOW_SIZE.normal, { width: 360, height: 520 })
  assert.ok(PIP_WINDOW_SIZE.small.width < 360 && PIP_WINDOW_SIZE.large.width > 360)
})

test('withdrawal removes the connection settings of that account too', () => {
  const storage = memoryStorage()
  new ConnectionSettingsStore(storage, 7).update({ volume: 5 })
  new ConnectionSettingsStore(storage, 8).update({ volume: 6 })
  removeAccountSnapshots({ get length() { return storage.values.size }, key: index => [...storage.values.keys()][index] ?? null, removeItem: key => { storage.values.delete(key) } }, 7)
  assert.equal(new ConnectionSettingsStore(storage, 7).getSnapshot().volume, 70)
  assert.equal(new ConnectionSettingsStore(storage, 8).getSnapshot().volume, 6)
})
