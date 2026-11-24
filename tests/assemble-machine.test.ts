import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSEMBLE_GREET_DELAY_MS,
  ASSEMBLE_SEEN_STORAGE_KEY,
  ASSEMBLE_TIMINGS_MS,
  assembleGreetDelayMs,
  createInitialAssembleState,
  getAssembleStepDurationMs,
  isMateAwake,
  parseAssembleForcePhase,
  resolveClickActivation,
  readAssembleSeen,
  transitionAssembleState,
  writeAssembleSeen,
} from '../src/features/auth/login-variants/assemble/assemble-machine.ts'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  }
}

test('full happy path: idle -> dragging -> dropped -> streaming -> filling -> settling -> live', () => {
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
  assert.equal(state.phase, 'streaming')
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.streaming)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' })
  assert.equal(state.phase, 'filling')
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.filling)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' })
  assert.equal(state.phase, 'settling')
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.settling)

  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'ready' })
  assert.equal(state.phase, 'live')
  assert.equal(state.waitingForLive2D, false)
  assert.equal(getAssembleStepDurationMs(state), null)
})

test('waits in settling until Live2D becomes ready or errors to static', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'loading' })
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'drag', reducedMotion: false })
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // streaming
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // filling
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // settling
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'loading' }) // waiting!

  assert.equal(state.phase, 'settling')
  assert.equal(state.waitingForLive2D, true)
  assert.equal(getAssembleStepDurationMs(state), null)

  const live = transitionAssembleState(state, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'ready' })
  assert.equal(live.phase, 'live')
  assert.equal(live.waitingForLive2D, false)

  const fallback = transitionAssembleState(state, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'error' })
  assert.equal(fallback.phase, 'static')
  assert.equal(fallback.waitingForLive2D, false)
})

test('reduced-motion skips streaming/filling/settling and crossfades in 300ms', () => {
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
  assert.equal(loadingInit.phase, 'settling')
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

test('the sequence is ~2.2s: dropped -> streaming -> filling -> settling -> live', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'loading' })
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'drag', reducedMotion: false })
  const seen: Array<[string, number | null]> = []
  for (let i = 0; i < 4; i++) {
    seen.push([state.phase, getAssembleStepDurationMs(state)])
    state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'ready' })
  }
  assert.deepEqual(seen, [
    ['dropped', ASSEMBLE_TIMINGS_MS.dropped],
    ['streaming', ASSEMBLE_TIMINGS_MS.streaming],
    ['filling', ASSEMBLE_TIMINGS_MS.filling],
    ['settling', ASSEMBLE_TIMINGS_MS.settling],
  ])
  assert.equal(state.phase, 'live')
  assert.equal(getAssembleStepDurationMs(state), null)
  const total =
    ASSEMBLE_TIMINGS_MS.dropped + ASSEMBLE_TIMINGS_MS.streaming + ASSEMBLE_TIMINGS_MS.filling + ASSEMBLE_TIMINGS_MS.settling
  assert.ok(total >= 1800 && total <= 2400, `total ${total}ms should be ~2s`)
})

test('parseAssembleForcePhase accepts the preview phases and the old phase names as aliases', () => {
  for (const phase of ['idle', 'streaming', 'filling', 'settling', 'live', 'static'] as const) {
    assert.equal(parseAssembleForcePhase(phase), phase)
  }
  assert.equal(parseAssembleForcePhase(' Filling '), 'filling')
  assert.equal(parseAssembleForcePhase('exploding'), 'streaming')
  assert.equal(parseAssembleForcePhase('meshing'), 'filling')
  assert.equal(parseAssembleForcePhase('assembling'), 'settling')
  assert.equal(parseAssembleForcePhase('dropped'), null)
  assert.equal(parseAssembleForcePhase('toString'), null)
  assert.equal(parseAssembleForcePhase(''), null)
  assert.equal(parseAssembleForcePhase(null), null)
})

test('reduced motion uses the short crossfade, and the sequence waits in settling for Live2D', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'loading' })
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'keyboard', reducedMotion: true })
  assert.equal(getAssembleStepDurationMs(state), ASSEMBLE_TIMINGS_MS.reducedCrossfade)

  let waiting = createInitialAssembleState({ seen: false, live2dStatus: 'loading' })
  waiting = transitionAssembleState(waiting, { type: 'TRIGGER', method: 'drag', reducedMotion: false })
  for (let i = 0; i < 4; i++) {
    waiting = transitionAssembleState(waiting, { type: 'STEP_COMPLETE', live2dStatus: 'loading' })
  }
  assert.equal(waiting.phase, 'settling')
  assert.equal(waiting.waitingForLive2D, true)
  assert.equal(getAssembleStepDurationMs(waiting), null)
}
)

test('click activation: detail 0 (Enter / Space / assistive tech) starts via the keyboard path, pointer clicks only hint', () => {
  assert.equal(resolveClickActivation(0), 'keyboard')
  assert.equal(resolveClickActivation(1), 'hint')
  assert.equal(resolveClickActivation(2), 'hint')
})

test('losing the engine after the handoff falls back to the still image, and it returns when the engine is back', () => {
  const live = createInitialAssembleState({ seen: true, live2dStatus: 'ready' })
  assert.equal(live.phase, 'live')

  const lost = transitionAssembleState(live, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'error' })
  assert.equal(lost.phase, 'static')
  assert.equal(lost.waitingForLive2D, false)

  // loading / error again while static changes nothing
  assert.equal(transitionAssembleState(lost, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'loading' }), lost)
  assert.equal(transitionAssembleState(lost, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'error' }), lost)

  const back = transitionAssembleState(lost, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'ready' })
  assert.equal(back.phase, 'live')

  // already live + ready is a no-op; mid-sequence statuses never skip phases
  assert.equal(transitionAssembleState(live, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'ready' }), live)
  const dropped = transitionAssembleState(createInitialAssembleState({ seen: false, live2dStatus: 'loading' }), {
    type: 'TRIGGER',
    method: 'drag',
    reducedMotion: false,
  })
  assert.equal(transitionAssembleState(dropped, { type: 'LIVE2D_STATUS_CHANGE', live2dStatus: 'error' }), dropped)
})

test('assembleGreetDelayMs greets on both terminal phases, keeps the animated timing, and only once', () => {
  const animated = ASSEMBLE_TIMINGS_MS.liveFade + ASSEMBLE_GREET_DELAY_MS
  // Animated first visit: unchanged timing (crossfade + beat).
  assert.equal(assembleGreetDelayMs({ phase: 'live', alreadyGreeted: false, immediate: false }), animated)
  // Revisit / half screen / reduced motion: right away.
  assert.equal(assembleGreetDelayMs({ phase: 'live', alreadyGreeted: false, immediate: true }), 0)
  // Static (reduced motion never loads Live2D; engine failure falls back here) also greets.
  assert.equal(assembleGreetDelayMs({ phase: 'static', alreadyGreeted: false, immediate: true }), 0)
  assert.equal(assembleGreetDelayMs({ phase: 'static', alreadyGreeted: false, immediate: false }), animated)
  // Already greeted this wake-up (e.g. live <-> static switch afterwards): no second greeting.
  assert.equal(assembleGreetDelayMs({ phase: 'static', alreadyGreeted: true, immediate: true }), null)
  assert.equal(assembleGreetDelayMs({ phase: 'live', alreadyGreeted: true, immediate: false }), null)
  // Not terminal yet: nothing.
  for (const phase of ['idle', 'dragging', 'dropped', 'streaming', 'filling', 'settling'] as const) {
    assert.equal(assembleGreetDelayMs({ phase, alreadyGreeted: false, immediate: true }), null)
  }
})

test('reduced-motion first visit without Live2D ends in static (which greets)', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'error' })
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'keyboard', reducedMotion: true })
  assert.equal(state.phase, 'dropped')
  state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'error' })
  assert.equal(state.phase, 'static')
  assert.equal(assembleGreetDelayMs({ phase: state.phase, alreadyGreeted: false, immediate: state.reducedMotion }), 0)
  // Revisit with the same setup starts in static directly.
  assert.equal(createInitialAssembleState({ seen: true, live2dStatus: 'error' }).phase, 'static')
})

test('isMateAwake: only the terminal phases (live / static) count as awake', () => {
  assert.equal(isMateAwake('live'), true)
  assert.equal(isMateAwake('static'), true)
  for (const phase of ['idle', 'dragging', 'dropped', 'streaming', 'filling', 'settling'] as const) {
    assert.equal(isMateAwake(phase), false, phase)
  }
  assert.equal(isMateAwake(null), false)
  assert.equal(isMateAwake(undefined), false)
})

test('isMateAwake follows the wake-up sequence: asleep until the handoff, asleep again after replay', () => {
  let state = createInitialAssembleState({ seen: false, live2dStatus: 'ready' })
  assert.equal(isMateAwake(state.phase), false)
  state = transitionAssembleState(state, { type: 'DRAG_START' })
  assert.equal(isMateAwake(state.phase), false)
  state = transitionAssembleState(state, { type: 'TRIGGER', method: 'drag', reducedMotion: false })
  while (state.phase !== 'live') {
    assert.equal(isMateAwake(state.phase), false, state.phase)
    state = transitionAssembleState(state, { type: 'STEP_COMPLETE', live2dStatus: 'ready' })
  }
  assert.equal(isMateAwake(state.phase), true)
  state = transitionAssembleState(state, { type: 'REPLAY' })
  assert.equal(isMateAwake(state.phase), false)

  // Revisit jumps straight to an awake phase.
  assert.equal(isMateAwake(createInitialAssembleState({ seen: true, live2dStatus: 'ready' }).phase), true)
  assert.equal(isMateAwake(createInitialAssembleState({ seen: true, live2dStatus: 'error' }).phase), true)
})
