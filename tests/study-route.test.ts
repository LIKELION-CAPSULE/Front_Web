import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveStudyRoute } from '../src/features/session/study-route.ts'

const base = { sessionId: '9001', completedSessionIds: [], finishing: false } as const

test('successful settlement never routes home while the report navigation is still pending', () => {
  assert.equal(resolveStudyRoute({ ...base, activeSessionId: '9001' }), 'active')
  assert.equal(resolveStudyRoute({ ...base, activeSessionId: '9001', finishing: true }), 'active')
  // Model cleanup can publish the cleared session before the next route commits.
  assert.equal(resolveStudyRoute({ ...base, finishing: true }), 'finishing')
  assert.equal(resolveStudyRoute({ ...base, completedSessionIds: ['9001'], finishing: true }), 'report')
  // Even if an unrelated update releases the busy state, the saved record wins.
  assert.equal(resolveStudyRoute({ ...base, completedSessionIds: ['9001'] }), 'report')
})

test('the completed session wins over a temporarily stale active summary', () => {
  assert.equal(resolveStudyRoute({ ...base, summarySessionId: 9001, completedSessionIds: ['9001'] }), 'report')
})

test('returning to a completed study URL opens its own report, not the most recent report', () => {
  assert.equal(resolveStudyRoute({ ...base, completedSessionIds: ['9002', '9001'] }), 'report')
  assert.equal(resolveStudyRoute({ ...base, completedSessionIds: ['9002'] }), 'missing')
})

test('failed settlement leaves the active study available for retry', () => {
  assert.equal(resolveStudyRoute({ ...base, activeSessionId: '9001', finishing: false }), 'active')
})

test('a real resumable session still opens recovery without borrowing another session', () => {
  assert.equal(resolveStudyRoute({ ...base, summarySessionId: 9001 }), 'resume')
  assert.equal(resolveStudyRoute({ ...base, summarySessionId: 9002 }), 'missing')
  assert.equal(resolveStudyRoute({ ...base, activeSessionId: '9002', completedSessionIds: ['9001'] }), 'report')
})

test('missing and unknown session IDs keep the original missing-session path', () => {
  assert.equal(resolveStudyRoute(base), 'missing')
  assert.equal(resolveStudyRoute({ ...base, sessionId: undefined, summarySessionId: 9001, completedSessionIds: ['9001'] }), 'missing')
})
