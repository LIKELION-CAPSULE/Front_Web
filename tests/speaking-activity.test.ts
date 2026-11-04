import assert from 'node:assert/strict'
import test from 'node:test'
import { MicrophoneActivity, microphoneRms } from '../src/features/media/microphone-activity.ts'
import { updateSpeakingMessages } from '../src/features/session/speaking-activity.ts'

test('microphone input requires sufficient volume and holds across short syllable gaps', () => {
  const activity = new MicrophoneActivity()
  assert.equal(activity.sample(0.01, 0), false)
  assert.equal(activity.sample(0.03, 50), true)
  assert.equal(activity.sample(0, 100), true)
  assert.equal(activity.sample(0.02, 200), true)
  assert.equal(activity.sample(0, 499), true)
  assert.equal(activity.sample(0, 500), false)
  assert.equal(activity.sample(0.02, 550), false)
})

test('muting or disconnecting resets microphone activity without a stale release tail', () => {
  const activity = new MicrophoneActivity()
  activity.sample(0.05, 100)
  activity.reset()
  assert.equal(activity.sample(0, 101), false)
  activity.sample(0.05, 200)
  assert.equal(activity.sample(NaN, 201), false)
  assert.equal(activity.sample(0, 202), false)
  assert.equal(microphoneRms(new Float32Array([0.5, -0.5, 0.5, -0.5])), 0.5)
  assert.equal(microphoneRms(new Float32Array(0)), 0)
})

test('finishing or cancelling one message does not clear another message or a different friend', () => {
  const empty = {}
  const first = updateSpeakingMessages(empty, 'chaerin', 'intro', true)
  const second = updateSpeakingMessages(first, 'chaerin', 'reply', true)
  const third = updateSpeakingMessages(second, 'sua', 'sua-reply', true)
  assert.equal(updateSpeakingMessages(third, 'chaerin', 'reply', true), third)
  assert.equal(updateSpeakingMessages(third, 'sua', 'reply', false), third)
  const finished = updateSpeakingMessages(third, 'chaerin', 'intro', false)
  assert.deepEqual(finished, { reply: 'chaerin', 'sua-reply': 'sua' })
  assert.deepEqual(empty, {})
  assert.deepEqual(updateSpeakingMessages(updateSpeakingMessages(finished, 'chaerin', 'reply', false), 'sua', 'sua-reply', false), {})
})
