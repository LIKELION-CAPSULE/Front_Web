import test from 'node:test'
import assert from 'node:assert/strict'
import { choosePreview, mountedPreviews, previewFailed, previewShown, type PreviewView } from '../src/features/profile/avatar-preview-state.ts'

const A = { key: 'A' }, B = { key: 'B' }, C = { key: 'C' }
const keys = (view: PreviewView<{ key: string }>) => mountedPreviews(view).map(entry => entry.key)

test('the drawn avatar stays while the next one loads, then is released', () => {
  let view: PreviewView<{ key: string }> = { current: null, shown: null }
  view = choosePreview(view, A, false)
  view = previewShown(view, 'A')
  assert.deepEqual(keys(view), ['A'])
  view = choosePreview(view, B, false)
  assert.deepEqual(keys(view), ['A', 'B'], 'A stays under B while B loads')
  view = choosePreview(view, C, false)
  assert.deepEqual(keys(view), ['A', 'C'], 'B, passed over before it was drawn, is released at once')
  view = previewShown(view, 'C')
  assert.deepEqual(keys(view), ['C'])
  assert.deepEqual(keys(choosePreview(view, A, true)), ['A'], 'reduced motion: no overlap')
})

test('A ready → B fails → A is released at once → B retried and drawn', () => {
  let view: PreviewView<{ key: string }> = { current: null, shown: null }
  view = previewShown(choosePreview(view, A, false), 'A')
  view = choosePreview(view, B, false)
  assert.deepEqual(keys(view), ['A', 'B'])
  view = previewFailed(view, 'B')
  assert.deepEqual(keys(view), ['B'], 'the stage no longer shows A while B (name, saved choice) failed')
  assert.equal(view.shown, null)
  // 「다시 시도」 reloads B in place (same key); when it is drawn it becomes the shown model.
  view = previewShown(view, 'B')
  assert.deepEqual(keys(view), ['B'])
  assert.equal(view.shown?.key, 'B')
  // A failure report from a model that is no longer chosen changes nothing.
  assert.equal(previewFailed(view, 'A'), view)
})
