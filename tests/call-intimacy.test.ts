import assert from 'node:assert/strict'
import test from 'node:test'
import { callIntimacy, recallCallIntimacy, rememberCallIntimacy } from '../src/features/mates/call-intimacy.ts'

test('the chip starts from 16 relation: stage 1 reads 처음 만남 (a missing name takes the table name)', () => {
  assert.deepEqual(callIntimacy({ stage: 1, stageName: null }, null), { stage: 1, stageName: '처음 만남' })
  assert.deepEqual(callIntimacy({ stage: 1 }, null), { stage: 1, stageName: '처음 만남' })
})

test('a stage name decides the number (the one stage table)', () => {
  assert.deepEqual(callIntimacy({ stage: 2, stageName: '친구' }, null), { stage: 3, stageName: '친구' })
})

test('a 21 stageUp raises the chip at once', () => {
  assert.deepEqual(callIntimacy({ stage: 1, stageName: '처음 만남' }, { stage: 2, stageName: '아는 사이' }), { stage: 2, stageName: '아는 사이' })
  // No 16 relation (resume): the stageUp alone.
  assert.deepEqual(callIntimacy(null, { stage: 3 }), { stage: 3, stageName: '친구' })
})

test('a lower or broken stageUp never lowers the chip', () => {
  assert.deepEqual(callIntimacy({ stage: 4 }, { stage: 2 }), { stage: 4, stageName: '친한 친구' })
  assert.deepEqual(callIntimacy({ stage: 2 }, { stage: 9 }), { stage: 2, stageName: '아는 사이' })
})

test('nothing known: no chip value (「—」)', () => {
  assert.equal(callIntimacy(null, null), null)
  assert.equal(callIntimacy({}, {}), null)
})

test('20 / 28 affinity (호감도) is not an input: only 16 relation and 21 stageUp count', () => {
  // The old chip showed the message reply's affinity stage (e.g. 4 「친한 사이」) with 16 relation at 1.
  assert.deepEqual(callIntimacy({ stage: 1 }, null), { stage: 1, stageName: '처음 만남' })
})

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

test('a reload mid-call (17 has no relation) keeps the stage this tab showed, never a lower one', () => {
  const storage = memoryStorage()
  assert.equal(recallCallIntimacy('77', storage), null)
  rememberCallIntimacy('77', { stage: 2, stageName: '아는 사이' }, storage)
  rememberCallIntimacy('77', { stage: 1, stageName: '처음 만남' }, storage)
  assert.deepEqual(recallCallIntimacy('77', storage), { stage: 2, stageName: '아는 사이' })
  assert.equal(recallCallIntimacy('78', storage), null)
})

test('storage that throws only loses the recall', () => {
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.doesNotThrow(() => rememberCallIntimacy('1', { stage: 1, stageName: '처음 만남' }, broken))
  assert.equal(recallCallIntimacy('1', broken), null)
})
