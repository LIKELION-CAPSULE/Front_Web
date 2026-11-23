import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSEMBLE_SEEN_STORAGE_KEY,
  ASSEMBLE_TIMINGS_MS,
  createInitialAssembleState,
  getAssembleStepDurationMs,
  readAssembleSeen,
  transitionAssembleState,
  writeAssembleSeen,
} from '../src/features/auth/login-variants/assemble/assemble-machine.ts'
import { parsePolySvg } from '../src/features/auth/login-variants/assemble/poly-mesh.ts'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  }
}

test('full happy path: idle -> dragging -> dropped -> exploding -> meshing -> assembling -> live', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'loading' })
  assert.equal(state.phase, 'idle')
  assert.equal(getAssembleStepDurationMs(state), null)

  state = transitionAssembleState(state, { type: 'DRAG_START' })
  assert.equal(state.phase, 'dragging')

  state = transitionAssembleState(state, { type: 'DRAG_CANCEL' })
  assert.equal(state.phase, 'idle')

  state = transitionAssembleState(state, { type: 'DRAG_START' })
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'drag', reducedMotion: false })
  assert.equal(state.phase, 'dropped')
  assert.equal(state.method, 'drag')
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.dropped)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' })
  assert.equal(state.phase, 'exploding')
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.exploding)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' })
  assert.equal(state.phase, 'meshing')
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.meshing)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' })
  assert.equal(state.phase, 'assembling')
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.assembling)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'ready' })
  assert.equal(state.phase, 'live')
  assert.equal(state.waitingForLive2D, false)
  assert.equal(getAssembleStepDurationMs(state), null)
})

test('waits in assembling until Live2D becomes ready or errors to static', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'loading' })
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'click', reducedMotion: false })
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // exploding
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // meshing
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // assembling
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // waiting!

  assert.equal(state.phase, 'assembling')
  assert.equal(state.waitingForLive2D, true)
  assert.equal(getAssembleStepDurationMs(state), null)

  const live = transitionAssembleState(state, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'ready' })
  assert.equal(live.phase, 'live')
  assert.equal(live.waitingForLive2D, false)

  const fallback = transitionAssembleState(state, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'error' })
  assert.equal(fallback.phase, 'static')
  assert.equal(fallback.waitingForLive2D, false)
})

test('reduced-motion skips exploding/meshing/assembling and crossfades in 300ms', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'ready' })
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'keyboard', reducedMotion: true })
  assert.equal(state.phase, 'dropped')
  assert.equal(state.reducedMotion, true)
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.reducedCrossfade)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'ready' })
  assert.equal(state.phase, 'live')
})

test('revisit (seen=true) skips intro and replay returns to idle', () => {
  const readyInit = createInitialAssembleState({ seen: true, live2dStatus: 'ready' })
  assert.equal(readyInit.phase, 'live')

  const errorInit = createInitialAssembleState({ seen: true, live2dStatus: 'error' })
  assert.equal(errorInit.phase, 'static')

  const loadingInit = createInitialAssembleState({ seen: true, live2dStatus: 'loading' })
  assert.equal(loadingInit.phase, 'assembling')
  assert.equal(loadingInit.waitingForLive2D, true)

  const replayed = transitionAssembleState(readyInit, { type: 'REPLAY' })
  assert.equal(replayed.phase, 'idle')
})

test('storage helpers persist seen flag and survive blocked storage', () => {
  const store = memoryStorage()
  assert.equal(readAssembleSeen(store), false)
  writeAssembleSeen(store, true)
  assert.equal(store.map.get(ASSEMBLE_SEEN_STORAGE_KEY), '1')
  assert.equal(readAssembleSeen(store), true)

  const blocked = {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
  }
  assert.equal(readAssembleSeen(blocked), false)
  assert.doesNotThrow(() => writeAssembleSeen(blocked, true))
  assert.equal(readAssembleSeen(null), false)
})

test('parsePolySvg extracts mesh-edges path and splits vertices into 4 Y-bands', () => {
  const sample = `<svg viewBox="0 0 100 100"><path class="mesh-edges" d="M0 0L10 10"/><g class="mesh-verts"><circle cx="10" cy="5" r="4"/><circle cx="20" cy="35" r="4"/><circle cx="30" cy="65" r="4"/><circle cx="40" cy="95" r="4"/></g></svg>`
  const parsed = parsePolySvg(sample)
  assert.equal(parsed.viewBox, '0 0 100 100')
  assert.equal(parsed.edgesD, 'M0 0L10 10')
  assert.equal(parsed.vertRadius, 4)
  assert.equal(parsed.vertBands.length, 4)
  assert.equal(parsed.vertBands[0], 'M10 5h0.01')
  assert.equal(parsed.vertBands[1], 'M20 35h0.01')
  assert.equal(parsed.vertBands[2], 'M30 65h0.01')
  assert.equal(parsed.vertBands[3], 'M40 95h0.01')
})
