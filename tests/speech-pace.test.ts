import assert from 'node:assert/strict'
import test from 'node:test'
import { speechPace } from '../src/features/session/speech-pace.ts'

test('speech bubble typing pauses longest at an ellipsis, then sentence ends, then commas', () => {
  assert.deepEqual(['…', '?', '.', '!', ',', ' ', '가', 'a'].map(speechPace), [500, 380, 380, 380, 220, 20, 45, 45])
})
