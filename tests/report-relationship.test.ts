import assert from 'node:assert/strict'
import test from 'node:test'
import { reportRelationship } from '../src/features/reports/report-relationship.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'

const record = (id: string, minutes: number, endedAt: number, characterIds = ['chaerin']): StudyRecord => ({ id, roomId: 'dawn-library', characterIds, tier: 'basic', startedAt: endedAt - 1000, endedAt, studySeconds: minutes * 60, focusSeconds: 0, awaySeconds: 0, returns: 0, completed: true, automatic: false })
test('report gain uses this session’s group share and excludes later records', () => {
  const prior = record('prior', 590, 1000), current = record('current', 60, 2000, ['chaerin', 'sua', 'dahee']), future = record('future', 2000, 3000)
  const gain = reportRelationship([future, current, prior], current, 'chaerin')
  assert.equal(gain.gainSeconds, 1200)
  assert.equal(gain.before.level, 1)
  assert.equal(gain.after.level, 2)
  assert.equal(gain.after.next, 590)
  assert.deepEqual(gain.steps, [{ level: 1, from: 590 / 600 * 100, to: 100, nextLevel: 2 }, { level: 2, from: 0, to: 10 / 600 * 100, nextLevel: undefined }])
})
test('landing exactly at a level boundary fills the old bar and ends at the new level', () => {
  const current = record('current', 1, 2000)
  const gain = reportRelationship([record('prior', 599, 1000), current], current, 'chaerin')
  assert.equal(gain.steps.length, 1)
  assert.equal(gain.steps[0]!.nextLevel, 2)
  assert.deepEqual(gain.after, { level: 2, progress: 0, next: 600 })
})
test('multiple crossed levels remain separate animation steps', () => {
  const current = record('current', 1250, 1000)
  const gain = reportRelationship([current], current, 'chaerin')
  assert.deepEqual(gain.steps.map(step => step.nextLevel), [2, 3, undefined])
  assert.equal(gain.after.level, 3)
  assert.equal(gain.after.next, 550)
})
test('the maximum level stays full and does not create a sixth level', () => {
  const current = record('current', 50, 2000)
  const gain = reportRelationship([record('prior', 2400, 1000), current], current, 'chaerin')
  assert.equal(gain.after.level, 5)
  assert.equal(gain.after.progress, 100)
  assert.deepEqual(gain.steps, [])
})
test('sub-minute study still makes a proportional increase', () => {
  const current = record('current', 0.5, 1000)
  const gain = reportRelationship([current], current, 'chaerin')
  assert.equal(gain.gainSeconds, 30)
  assert.equal(gain.after.progress, 30 / 36000 * 100)
})
test('a friend outside the session gains no time', () => {
  const current = record('current', 90, 1000)
  const gain = reportRelationship([current], current, 'sua')
  assert.equal(gain.gainSeconds, 0)
  assert.deepEqual(gain.steps, [])
})
