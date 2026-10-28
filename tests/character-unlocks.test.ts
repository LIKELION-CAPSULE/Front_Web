import assert from 'node:assert/strict'
import test from 'node:test'
import { characterUnlocks } from '../src/features/characters/unlocks.ts'
import { dayKey } from '../src/shared/lib/format.ts'
import type { StudyRecord } from '../src/features/demo/types.ts'

const record = (endedAt: number, characterIds = ['chaerin'], studySeconds = 120): StudyRecord => ({
  id: String(endedAt), roomId: 'dawn-library', characterIds, tier: 'basic',
  startedAt: endedAt - studySeconds * 1000, endedAt, studySeconds,
  focusSeconds: 0, awaySeconds: 0, returns: 0, completed: false, automatic: false,
})

test('introductory unlock dates come from the earliest finished study, including group study', () => {
  const earliest = Date.parse('2026-10-10T12:00:00+09:00')
  const records = [record(earliest + 86400000), record(earliest, ['chaerin', 'sua']), record(earliest - 86400000, ['moru']), record(earliest - 172800000, ['chaerin'], 0)]
  const before = records.map((item) => item.id)
  const unlocks = characterUnlocks(records, 'chaerin')
  assert.equal(unlocks.length, 6)
  assert.deepEqual(unlocks.filter((item) => item.unlockedAt !== null).map((item) => item.unlockedAt), [earliest, earliest])
  assert.deepEqual(records.map((item) => item.id), before)
  assert.equal(characterUnlocks(records, 'sua')[0]!.unlockedAt, earliest)
})

test('missing or invalid study history never creates a fictional unlock date', () => {
  for (const records of [[], [record(Date.now(), ['moru'])], [record(Date.now(), ['chaerin'], 0)], [record(Infinity)], [record(Date.now(), ['chaerin'], NaN)]]) {
    const unlocks = characterUnlocks(records, 'chaerin')
    assert.equal(unlocks.filter((item) => item.unlockedAt !== null).length, 0)
    assert.equal(unlocks[0]!.description, '함께 공부하면 열려요')
  }
})

test('unlock dates use a recorded study end even before reaching the goal, with Seoul date boundaries', () => {
  const endedAt = Date.parse('2026-10-27T15:01:00Z')
  const unlock = characterUnlocks([record(endedAt)], 'chaerin')[0]!
  assert.equal(unlock.unlockedAt, endedAt)
  assert.equal(dayKey(unlock.unlockedAt!).slice(2).replaceAll('-', '.'), '26.10.28')
})
