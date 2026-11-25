import test from 'node:test'
import assert from 'node:assert/strict'
import {
  choosePreview,
  currentMounted,
  emptyPreview,
  mountedPreviews,
  previewFailed,
  previewReleased,
  previewShown,
  standInVisible,
  type PreviewView,
} from '../src/features/profile/avatar-preview-state.ts'

type E = { key: string }
const A = { key: 'A' }, B = { key: 'B' }, C = { key: 'C' }
const mounted = (view: PreviewView<E>) => mountedPreviews(view).map(({ entry, leaving }) => `${entry.key}${leaving ? ' (leaving)' : ''}`)
/** What is visible: a drawn current model, or the stand-in still; leaving models only while fading (never with another). */
function visible(view: PreviewView<E>) {
  const shown = view.current && currentMounted(view) && view.settled === view.current.key ? [view.current.key] : []
  const standIn = standInVisible(view) ? [`${view.current!.key} still`] : []
  return [...view.leaving.map((entry) => `${entry.key} fading`), ...standIn, ...shown]
}

test('switching: the previous model fades out and is released before the next one mounts; its still stands in', () => {
  let view: PreviewView<E> = emptyPreview()
  view = choosePreview(view, A, false)
  assert.deepEqual(mounted(view), ['A'])
  assert.ok(standInVisible(view), 'A\'s still while A loads')
  view = previewShown(view, 'A')
  assert.deepEqual(visible(view), ['A'])

  view = choosePreview(view, B, false)
  assert.deepEqual(mounted(view), ['A (leaving)'], 'B does not mount while A fades out')
  assert.deepEqual(visible(view), ['A fading'], 'no stand-in of B over A')
  view = previewReleased(view, 'A')
  assert.deepEqual(mounted(view), ['B'])
  assert.deepEqual(visible(view), ['B still'])
  view = previewShown(view, 'B')
  assert.deepEqual(visible(view), ['B'])
})

test('quick picks: models passed over before they mount are dropped; at most one fading and one loading', () => {
  let view: PreviewView<E> = previewShown(choosePreview(emptyPreview<E>(), A, false), 'A')
  view = choosePreview(view, B, false)
  view = choosePreview(view, C, false)
  assert.deepEqual(mounted(view), ['A (leaving)'], 'B never mounted')
  view = previewReleased(view, 'A')
  assert.deepEqual(mounted(view), ['C'])
  // C is loading (mounted, not drawn) and A is chosen again: C leaves, A waits.
  view = choosePreview(view, A, false)
  assert.deepEqual(mounted(view), ['C (leaving)'])
  view = previewReleased(view, 'C')
  assert.deepEqual(mounted(view), ['A'])
  for (const step of [view]) assert.ok(mountedPreviews(step).length <= 2)
})

test('reduced motion: no fade, the previous model goes at once', () => {
  let view: PreviewView<E> = previewShown(choosePreview(emptyPreview<E>(), A, false), 'A')
  view = choosePreview(view, B, true)
  assert.deepEqual(mounted(view), ['B'])
})

test('a failed model: its own still and 「다시 시도」 take over (the stand-in goes); a retry that draws it settles too', () => {
  let view: PreviewView<E> = previewShown(choosePreview(emptyPreview<E>(), A, false), 'A')
  view = previewReleased(choosePreview(view, B, false), 'A')
  view = previewFailed(view, 'B')
  assert.ok(!standInVisible(view))
  assert.deepEqual(mounted(view), ['B'])
  assert.equal(previewShown(view, 'B'), view)
  // Reports about a model that is no longer chosen change nothing.
  assert.equal(previewFailed(view, 'A'), view)
  assert.equal(previewReleased(view, 'Z'), view)
})

test('waiting for a model: only the light first, a pulse after 0.6 s, the still only after 4 s (a fallback)', async () => {
  const { waitingPhase, AVATAR_WAIT_PULSE_MS, AVATAR_STILL_FALLBACK_MS, awaitingModel, emptyPreview, choosePreview, previewShown, previewReleased } = await import('../src/features/profile/avatar-preview-state.ts')
  assert.equal(AVATAR_WAIT_PULSE_MS, 600); assert.equal(AVATAR_STILL_FALLBACK_MS, 4000)
  assert.equal(waitingPhase(0), 'quiet'); assert.equal(waitingPhase(599), 'quiet')
  assert.equal(waitingPhase(600), 'pulse'); assert.equal(waitingPhase(3999), 'pulse')
  assert.equal(waitingPhase(4000), 'still')
  // The wait counts from the choice (while the previous model is still leaving) until the new one is drawn.
  let view = previewShown(emptyPreview({ key: 'a' }), 'a')
  assert.equal(awaitingModel(view), false)
  view = choosePreview(view, { key: 'b' }, false)
  assert.equal(awaitingModel(view), true, 'leaving a, waiting for b')
  view = previewReleased(view, 'a')
  assert.equal(awaitingModel(view), true)
  view = previewShown(view, 'b')
  assert.equal(awaitingModel(view), false)
  assert.equal(awaitingModel(emptyPreview(null)), false, 'a static avatar waits for nothing')
})
