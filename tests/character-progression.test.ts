import assert from 'node:assert/strict'
import test from 'node:test'
import { affectionScore, migrateAffection } from '../src/features/characters/affection.ts'
import { demoReducer } from '../src/features/demo/reducer.ts'
import { createDemoState } from '../src/features/demo/seed.ts'
import { studyLevel } from '../src/features/demo/selectors.ts'
import type { DemoState, StudyRecord } from '../src/features/demo/types.ts'
import { loadDemoState } from '../src/features/demo/persistence.ts'

const record = (minutes: number): StudyRecord => ({
  id: 'prior-study', roomId: 'dawn-library', characterIds: ['chaerin'], tier: 'basic',
  startedAt: 0, endedAt: minutes * 60000, studySeconds: minutes * 60, focusSeconds: 0,
  awaySeconds: 0, returns: 0, completed: true, automatic: false,
})

test('study history never invents an initial affection score', () => {
  const state = { ...createDemoState(), records: [record(3000)] }
  assert.equal(studyLevel(state, 'chaerin').level, 5)
  assert.equal(affectionScore(state, 'chaerin'), null)
  assert.deepEqual(state.affection, {})
})

test('affection can rise or fall independently for each character without changing levels', () => {
  const initial = { ...createDemoState(), records: [] }
  const high = demoReducer(initial, { type: 'SET_AFFECTION', characterId: 'chaerin', score: 100 })
  const low = demoReducer(high, { type: 'SET_AFFECTION', characterId: 'chaerin', score: 17 })
  assert.equal(affectionScore(high, 'chaerin'), 100)
  assert.equal(affectionScore(low, 'chaerin'), 17)
  assert.equal(affectionScore(low, 'sua'), null)
  assert.deepEqual(studyLevel(high, 'chaerin'), studyLevel(low, 'chaerin'))
  assert.equal(studyLevel(high, 'chaerin').level, 1)
  const maxLevel = { ...low, records: [record(3000)], affection: { chaerin: 0 } }
  assert.equal(studyLevel(maxLevel, 'chaerin').level, 5)
  assert.equal(affectionScore(maxLevel, 'chaerin'), 0)
})

test('only finite backend scores are accepted and scores stay within zero and one hundred', () => {
  const initial = createDemoState()
  for (const [value, expected] of [[-30, 0], [150, 100], [42.5, 42.5]]) {
    const state = demoReducer(initial, { type: 'SET_AFFECTION', characterId: 'chaerin', score: value! })
    assert.equal(affectionScore(state, 'chaerin'), expected)
    assert.equal(state.records, initial.records)
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(demoReducer(initial, { type: 'SET_AFFECTION', characterId: 'chaerin', score: value }), initial)
  }
})

test('study, chat and gifts never apply frontend affection changes', () => {
  let state: DemoState = { ...createDemoState(), records: [], affection: { chaerin: 37 } }
  const scores = state.affection
  state = demoReducer(state, { type: 'START_MVP', now: 1000 })
  state = demoReducer(state, { type: 'MESSAGE', characterId: 'chaerin', name: '채린', text: '고마워', now: 2000 })
  state = demoReducer(state, { type: 'GIFT', characterId: 'chaerin', characterName: '채린', productId: 'name', now: 3000 })
  state = demoReducer(state, { type: 'FINISH', now: 181000 })
  assert.equal(state.affection, scores)
  assert.equal(affectionScore(state, 'chaerin'), 37)
  assert.equal(studyLevel(state, 'chaerin').minutes, 3)
  assert.equal(state.gifts[0]!.productId, 'name')
})

test('legacy and malformed affection data migrate without resetting study or profile data', () => {
  const source = createDemoState()
  const legacy = { ...source }
  delete legacy.affection
  const migrated = migrateAffection(legacy)
  assert.deepEqual(migrated.affection, {})
  assert.equal(migrated.records, source.records)
  assert.equal(migrated.profile, source.profile)
  assert.equal(migrated.ledger, source.ledger)
  const malformed = { ...source, affection: { chaerin: 110, sua: -8, dahee: 'invalid', moru: null } } as unknown as DemoState
  const repaired = migrateAffection(malformed)
  assert.deepEqual(repaired.affection, { chaerin: 100, sua: 0 })
  assert.equal(repaired.records, source.records)
  assert.deepEqual(migrateAffection(JSON.parse(JSON.stringify(repaired))).affection, repaired.affection)
})

test('invalid study durations cannot put the level below one or outside its range', () => {
  for (const seconds of [-360000, NaN, Infinity]) {
    const state = { ...createDemoState(), records: [{ ...record(0), studySeconds: seconds }] }
    assert.deepEqual(studyLevel(state, 'chaerin'), { level: 1, minutes: 0, next: 600, progress: 0 })
  }
})

test('loading old and backend-populated saves preserves both independent metrics and account data', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const source = { ...createDemoState(), records: [record(600)], affection: { chaerin: 64 } }
  source.profile.name = '테스트친구'
  const saved = { ...source } as DemoState
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify(saved) } })
  try {
    const loaded = loadDemoState()
    assert.equal(loaded.profile.name, source.profile.name)
    assert.deepEqual(loaded.records, source.records)
    assert.equal(studyLevel(loaded, 'chaerin').level, 2)
    assert.equal(affectionScore(loaded, 'chaerin'), 64)
    delete saved.affection
    const legacy = loadDemoState()
    assert.equal(affectionScore(legacy, 'chaerin'), null)
    assert.equal(studyLevel(legacy, 'chaerin').level, 2)
    assert.equal(legacy.profile.name, source.profile.name)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
