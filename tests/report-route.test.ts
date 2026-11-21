import assert from 'node:assert/strict'
import test from 'node:test'
import { reportDestination } from '../src/features/backend/report-route.ts'

const base = { sessionId: '185', hasRecord: false, missing: false }

test('login returning to an ongoing report opens study recovery instead of querying an unavailable report', () => {
  assert.equal(reportDestination({ ...base, summarySessionId: 185 }), '/study/185?resume=1')
  assert.equal(reportDestination({ ...base, activeSessionId: '185' }), '/study/185')
  assert.equal(reportDestination({ ...base, summarySessionId: 186 }), null)
})

test('a settled local or server record wins over stale active-session metadata', () => {
  assert.equal(reportDestination({ ...base, hasRecord: true, summarySessionId: 185, missing: true }), null)
  assert.equal(reportDestination({ ...base, hasRecord: true, activeSessionId: '185' }), null)
})

test('a missing report returns home, while an unresolved or transient failure keeps its own route', () => {
  assert.equal(reportDestination({ ...base, missing: true }), '/')
  assert.equal(reportDestination(base), null)
  assert.equal(reportDestination({ ...base, sessionId: 'session-old', missing: true }), '/')
  assert.equal(reportDestination({ ...base, sessionId: undefined, missing: true }), null)
})
