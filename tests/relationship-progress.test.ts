import assert from 'node:assert/strict'
import test from 'node:test'
import { createDemoState } from '../src/features/demo/seed.ts'
import { relationship } from '../src/features/demo/selectors.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'

const record = (minutes: number, characterIds = ['chaerin']): StudyRecord => ({
  id: 'relationship-study',
  roomId: 'dawn-library',
  characterIds,
  tier: 'basic',
  startedAt: 0,
  endedAt: minutes * 60000,
  studySeconds: minutes * 60,
  focusSeconds: minutes * 60,
  awaySeconds: 0,
  returns: 0,
  completed: true,
  automatic: false,
})

test('relationship progress follows level boundaries and stays complete after reaching Lv.5', () => {
  for (const [minutes, level, next, progress] of [
    [0, 1, 600, 0],
    [599, 1, 1, 599 / 6],
    [600, 2, 600, 0],
    [1199, 2, 1, 599 / 6],
    [1500, 3, 300, 50],
    [2100, 4, 300, 50],
    [2399, 4, 1, 599 / 6],
    [2400, 5, 0, 100],
    [3000, 5, 0, 100],
  ]) {
    const state = { ...createDemoState(), records: minutes ? [record(minutes!)] : [] }
    const actual = relationship(state, 'chaerin')
    assert.equal(actual.minutes, minutes)
    assert.equal(actual.level, level)
    assert.equal(actual.next, next)
    assert.ok(Math.abs(actual.progress - progress!) < 0.0001)
  }
})

test('group study contributes each friend’s share to their next-level progress', () => {
  const state = { ...createDemoState(), records: [record(900, ['chaerin', 'sua', 'dahee'])] }
  for (const friend of ['chaerin', 'sua', 'dahee']) {
    assert.deepEqual(relationship(state, friend), { level: 1, minutes: 300, next: 300, progress: 50 })
  }
  assert.deepEqual(relationship(state, 'moru'), { level: 1, minutes: 0, next: 600, progress: 0 })
})
