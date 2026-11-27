import test from 'node:test'
import assert from 'node:assert/strict'
import { rememberReviewIdInWindowName, reviewIdFromWindowName } from '../src/shared/lib/review-window-name.ts'

const topLevel = (name: string) => { const win = { name, self: {} as unknown, top: {} as unknown }; win.top = win.self; return win }
const framed = (name: string) => ({ name, self: {} as unknown, top: {} as unknown })

test('a review name left in a top-level tab is ignored and cleared (localhost:3000/ must not stay on the mobile notice)', () => {
  const win = topLevel('capsule-ui-review:mobile-notice')
  assert.equal(reviewIdFromWindowName(win), null)
  assert.equal(win.name, '')
})

test('inside the workbench iframe the review name keeps the scenario across navigations', () => {
  const win = framed('capsule-ui-review:mobile-notice-plain')
  assert.equal(reviewIdFromWindowName(win), 'mobile-notice-plain')
  assert.equal(win.name, 'capsule-ui-review:mobile-notice-plain')
})

test('other window names are left alone', () => {
  const win = topLevel('some-other-name')
  assert.equal(reviewIdFromWindowName(win), null)
  assert.equal(win.name, 'some-other-name')
  assert.equal(reviewIdFromWindowName(framed('')), null)
})

test('the review bootstrap writes the name only inside a frame', () => {
  const top = topLevel('')
  rememberReviewIdInWindowName('mobile-notice', top)
  assert.equal(top.name, '')
  const frame = framed('')
  rememberReviewIdInWindowName('mobile-notice', frame)
  assert.equal(frame.name, 'capsule-ui-review:mobile-notice')
})
