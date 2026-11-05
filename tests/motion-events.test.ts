import assert from 'node:assert/strict'
import test from 'node:test'
import { MOTION_EVENT_COOLDOWN_MS, pickMotionEvents, type MotionGate } from '../src/features/backend/motion-events.ts'
import type { BehaviorKind } from '../src/features/media/behavior-rules.ts'

const open: MotionGate = { camera: true, phase: 'study', running: true, hidden: false }

test('detections map to API motion events; phone and away are never sent', () => {
  const all: BehaviorKind[] = ['away', 'drowsy', 'yawn', 'headTurn', 'phone', 'wave']
  assert.deepEqual(pickMotionEvents({}, all, 0, open).types, ['DROWSY', 'HEAD_TURN', 'YAWN', 'WAVE'])
  assert.deepEqual(pickMotionEvents({}, ['phone', 'away'], 0, open).types, [])
})

test('each type goes out at most once a minute, independently of the others', () => {
  let sentAt = pickMotionEvents({}, ['yawn'], 0, open).sentAt
  const again = pickMotionEvents(sentAt, ['yawn', 'wave'], MOTION_EVENT_COOLDOWN_MS - 1, open)
  assert.deepEqual(again.types, ['WAVE'])
  sentAt = again.sentAt
  assert.deepEqual(pickMotionEvents(sentAt, ['yawn'], MOTION_EVENT_COOLDOWN_MS, open).types, ['YAWN'])
})

test('nothing is sent with the camera off, on a break or pause, or from a hidden tab, and no cooldown starts', () => {
  for (const gate of [
    { ...open, camera: false }, { ...open, phase: 'break' as const }, { ...open, running: false }, { ...open, hidden: true },
  ]) {
    const result = pickMotionEvents({}, ['wave'], 0, gate)
    assert.deepEqual(result.types, [])
    assert.deepEqual(result.sentAt, {})
  }
  const blocked = pickMotionEvents({}, ['wave'], 0, { ...open, hidden: true })
  assert.deepEqual(pickMotionEvents(blocked.sentAt, ['wave'], 1000, open).types, ['WAVE'])
})
