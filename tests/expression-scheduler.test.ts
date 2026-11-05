import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceExpression, cancelPendingExpression, createExpressionSchedule, expressionRequest, nextExpressionDeadline,
  requestExpression, speechHold, type ExpressionRequest, type ExpressionSchedule,
} from '../src/features/live2d/expression-scheduler.ts'
import {
  EXPRESSION_MIN_HOLD_MS, NOTICE_HOLD_MS, SPEECH_HOLD_MAX_MS, SPEECH_HOLD_MIN_MS,
} from '../src/features/live2d/live2d-constants.ts'

const motion = (file: string): ExpressionRequest => ({ file, priority: 'motion', hold: { ms: NOTICE_HOLD_MS } })
const speech = (file: string, ms = 5000): ExpressionRequest => ({ file, priority: 'speech', hold: { ms } })
const state = (file: string): ExpressionRequest => ({ file, priority: 'state', hold: { ms: NOTICE_HOLD_MS } })
const sticky = (file: string): ExpressionRequest => ({ file, priority: 'state', hold: 'sticky' })
const release: ExpressionRequest = { file: null, priority: 'state', hold: 'release' }

/** Applies requests and timer ticks in order, collecting the faces sent to the model. */
function play(steps: [number, ExpressionRequest | 'tick' | 'cancel'][]) {
  let schedule: ExpressionSchedule = createExpressionSchedule()
  const shown: [number, string | null][] = []
  for (const [at, step] of steps) {
    if (step === 'cancel') { schedule = cancelPendingExpression(schedule); continue }
    const result = step === 'tick' ? advanceExpression(schedule, at) : requestExpression(schedule, step, at)
    schedule = result.schedule
    if (result.command) shown.push([at, result.command.file])
  }
  return { schedule, shown }
}

test('a lower priority never replaces a higher one, and higher or equal replaces it', () => {
  assert.deepEqual(play([[0, speech('a')], [2000, motion('b')]]).shown, [[0, 'a']])
  assert.deepEqual(play([[0, state('a')], [2000, speech('b')]]).shown, [[0, 'a']])
  assert.deepEqual(play([[0, motion('a')], [2000, speech('b')], [4000, state('c')]]).shown, [[0, 'a'], [2000, 'b'], [4000, 'c']])
  assert.deepEqual(play([[0, speech('a')], [2000, speech('b')]]).shown, [[0, 'a'], [2000, 'b']], 'equal priority: newest wins')
})

test('a face stays at least the minimum hold; the latest waiting face shows when it ends', () => {
  const { shown, schedule } = play([[0, motion('a')], [500, speech('b')], [900, speech('c')], [EXPRESSION_MIN_HOLD_MS, 'tick']])
  assert.deepEqual(shown, [[0, 'a'], [EXPRESSION_MIN_HOLD_MS, 'c']])
  assert.equal(schedule.pending, null)
  assert.equal(nextExpressionDeadline(play([[0, motion('a')], [500, speech('b')]]).schedule), EXPRESSION_MIN_HOLD_MS)
  // A weaker newcomer cannot push out a stronger face that is already waiting.
  assert.deepEqual(play([[0, motion('a')], [500, state('b')], [700, speech('c')], [EXPRESSION_MIN_HOLD_MS, 'tick']]).shown, [[0, 'a'], [EXPRESSION_MIN_HOLD_MS, 'b']])
})

test('timed faces return to the default face; sticky faces wait for the next state change', () => {
  assert.deepEqual(play([[0, motion('a')], [NOTICE_HOLD_MS - 1, 'tick'], [NOTICE_HOLD_MS, 'tick']]).shown, [[0, 'a'], [NOTICE_HOLD_MS, null]])
  const away = play([[0, sticky('away')], [600_000, 'tick'], [600_000, speech('line')], [600_000, motion('yawn')]])
  assert.deepEqual(away.shown, [[0, 'away']], 'away holds through lines and gestures')
  assert.equal(nextExpressionDeadline(away.schedule), null)
  assert.deepEqual(play([[0, sticky('away')], [60_000, sticky('away-2')]]).shown, [[0, 'away'], [60_000, 'away-2']])
  assert.deepEqual(play([[0, sticky('away')], [70_000, release]]).shown, [[0, 'away'], [70_000, null]])
  assert.deepEqual(play([[0, sticky('away')], [70_000, state('return')]]).shown, [[0, 'away'], [70_000, 'return']])
})

test('a release only ends a sticky face, and waits for the minimum hold like any change', () => {
  assert.deepEqual(play([[0, motion('a')], [2000, release], [NOTICE_HOLD_MS, 'tick']]).shown, [[0, 'a'], [NOTICE_HOLD_MS, null]])
  assert.deepEqual(play([[0, sticky('away')], [500, release], [EXPRESSION_MIN_HOLD_MS, 'tick']]).shown, [[0, 'away'], [EXPRESSION_MIN_HOLD_MS, null]])
})

test('cancelling drops the waiting face but keeps the one on screen', () => {
  const { shown, schedule } = play([[0, state('break')], [400, speech('late')], [500, 'cancel'], [EXPRESSION_MIN_HOLD_MS, 'tick']])
  assert.deepEqual(shown, [[0, 'break']])
  assert.equal(schedule.shown?.file, 'break')
})

test('server cues map to requests by source, never by emotion name', () => {
  const face = { name: '하품', file: 'exp/expression4.exp3.json' }
  assert.deepEqual(expressionRequest({ characterId: 1, expression: face, event: 'YAWN', stage: 'notice' }), motion(face.file))
  assert.equal(expressionRequest({ characterId: 1, expression: face, event: 'YAWN', stage: 'speech', text: '졸려?' })?.priority, 'speech')
  assert.deepEqual(expressionRequest({ characterId: 1, expression: face, event: 'AWAY', stage: 'notice' }), sticky(face.file))
  assert.deepEqual(expressionRequest({ characterId: 1, expression: face, event: 'AWAY', stage: 'speech', text: '어디 가?' }), sticky(face.file))
  assert.deepEqual(expressionRequest({ characterId: 1, expression: face, event: 'RETURN', stage: 'notice' }), state(face.file))
  assert.equal(expressionRequest({ characterId: 1, expression: face, event: 'RETURN', stage: 'speech', text: '왔네' })?.priority, 'state')
  assert.deepEqual(expressionRequest({ characterId: 1, expression: null, event: 'RETURN', stage: 'notice' }), release)
  assert.equal(expressionRequest({ characterId: 1, expression: null, event: 'RETURN', stage: 'speech' }), null)
  assert.equal(expressionRequest({ characterId: 1, expression: null, event: 'WAVE', stage: 'notice' }), null)
  assert.equal(expressionRequest({ characterId: 1, expression: { name: '웃음' }, event: 'MESSAGE', stage: 'speech' }), null, 'a name without a file draws nothing')
  assert.deepEqual(expressionRequest({ characterId: 1, expression: face, event: 'MESSAGE', stage: 'speech', text: '응' }), speech(face.file, SPEECH_HOLD_MIN_MS))
})

test('a line keeps its face long enough to read, within bounds', () => {
  assert.equal(speechHold(''), SPEECH_HOLD_MIN_MS)
  assert.equal(speechHold('가'.repeat(500)), SPEECH_HOLD_MAX_MS)
  assert.ok(speechHold('가'.repeat(30)) > speechHold('가'.repeat(10)))
})
