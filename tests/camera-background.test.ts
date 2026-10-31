import assert from 'node:assert/strict'
import test from 'node:test'
import { cameraBackgrounds, normalizeCameraBackground } from '../src/features/media/camera-backgrounds.ts'
import { DEMO_STORAGE_KEY, loadDemoState } from '../src/features/demo/persistence.ts'
import { demoReducer } from '../src/features/demo/reducer.ts'
import { createDemoState } from '../src/features/demo/seed.ts'

function loadSaved(saved: unknown) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => key === DEMO_STORAGE_KEY ? JSON.stringify(saved) : null },
  })
  try {
    return loadDemoState()
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}

test('camera background options keep the default first and unique ids', () => {
  assert.deepEqual(cameraBackgrounds.map((option) => option.kind), ['none', 'blur', 'image', 'image', 'image'])
  assert.equal(new Set(cameraBackgrounds.map((option) => option.id)).size, cameraBackgrounds.length)
})

test('unknown camera backgrounds normalize to the plain camera', () => {
  for (const option of cameraBackgrounds) assert.equal(normalizeCameraBackground(option.id), option.id)
  for (const value of [undefined, null, '', 'removed-background', 42, {}]) assert.equal(normalizeCameraBackground(value), 'none')
})

test('loading keeps a saved camera background and normalizes missing or unknown values without resetting the save', () => {
  const source = createDemoState()
  source.profile.name = '배경 보존 확인'
  source.credits = 4321
  const cases: [unknown, string][] = [
    ['library-rainy-night', 'library-rainy-night'],
    [undefined, 'none'],
    ['removed-background', 'none'],
    [42, 'none'],
  ]
  for (const [stored, expected] of cases) {
    const loaded = loadSaved({ ...source, cameraBackground: stored })
    assert.equal(loaded.cameraBackground, expected)
    assert.equal(loaded.profile.name, source.profile.name)
    assert.equal(loaded.credits, source.credits)
    assert.deepEqual(loaded.records.map((record) => record.id), source.records.map((record) => record.id))
  }
})

test('choosing a camera background updates only that preference', () => {
  const state = createDemoState()
  const next = demoReducer(state, { type: 'CAMERA_BACKGROUND', background: 'blur' })
  assert.equal(next.cameraBackground, 'blur')
  assert.deepEqual({ ...next, cameraBackground: undefined }, { ...state, cameraBackground: undefined })
})
