import { CAPSULE_SHAPE } from '../reports/capsule-shape.ts'

export const PREPARE_SHAPE = CAPSULE_SHAPE
export const PREPARE_LID_PULL = PREPARE_SHAPE.bodyRim - PREPARE_SHAPE.capRim + .06
export const DOT_FORM_START_MS = 1850
export const DOT_FORM_END_MS = DOT_FORM_START_MS + 900
export const DOT_BURST_MS = DOT_FORM_END_MS + 500
export const DOT_CLEAR_MS = DOT_BURST_MS + 3180
export const LID_OPEN_START_MS = 1400
export const LID_OPEN_END_MS = 2120
export const LID_CLOSE_START_MS = DOT_CLEAR_MS + 80
export const PREPARE_STORE_MS = LID_CLOSE_START_MS + 600
// Engraving finishes at STORE + 300; leave another 800 ms to read it before departure.
export const PREPARE_DEPARTURE_MS = PREPARE_STORE_MS + 1100
export const PREPARE_TRAVEL_MS = 1100
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export const ease = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t) }
export type Point3 = { x: number; y: number; z: number }

/** These are layout coordinates, independent of the capsule's wind, gravity and floor simulation. */
export function prepareFormLayout(width: number, height: number, cardWidth: number, cardHeight: number, left = (width - cardWidth) / 2, top = (height - cardHeight) / 2) {
  const baselineScale = width < 768 ? .66 : .72
  return { scale: 1, baselineScale, x: left + cardWidth / 2 - width / 2, y: height / 2 - top - cardHeight / 2 }
}

/** Lift the original foot-level landing by half the horizontal capsule's closed height. */
export function prepareCapsuleFloor(height: number, cardBottom: number, scale: number) {
  const radius = scale * PREPARE_SHAPE.capRadius
  return height / 2 - Math.min(cardBottom + radius * .35 + 12, height - radius - 14) + radius
}

export function prepareCapsuleScale(width: number, height: number) {
  return Math.max(1, Math.min(520 / PREPARE_SHAPE.length, width * .82 / (PREPARE_SHAPE.length + PREPARE_LID_PULL), (height * .42 - 24) / (.82 + PREPARE_SHAPE.capRadius + .08)))
}

/** Fully disengage the sleeve, lift clear of the body, park, then tilt. Reverse to close. */
export function capsuleLidPose(openness: number) {
  const pull = ease(openness / .28), lift = ease((openness - .28) / .44)
  const park = ease((openness - .72) / .16), turn = ease((openness - .88) / .12)
  return { x: -.82 * lift, y: PREPARE_LID_PULL * pull - (PREPARE_LID_PULL - .14) * park, z: .04 * lift, angle: .1 * turn }
}

/** Randomize once per scene; frame samples never change a route or depend on the refresh rate. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ state >>> 15, 1 | state)
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

/** A sideways falling capsule meets a virtual floor, rebounds twice and loses angular momentum. */
export function capsuleLanding(ms: number, width: number, height: number, scale: number, seed: number, floor = height * .08, centerX = -width * .025) {
  ms = Math.max(0, (ms - 160) / 1.2)
  const random = seededRandom(seed)
  const wind = random() * 2 - 1, gust = random() * 2 - 1
  const fall = clamp01(ms / 540)
  const after = Math.max(0, ms - 540)
  const first = clamp01(after / 230), second = clamp01((after - 230) / 150)
  const rebound = scale * (.19 * 4 * first * (1 - first) + .055 * 4 * second * (1 - second))
  const settle = 1 - ease(after / 400)
  const tilt = .17 * (1 - fall) * wind + Math.sin(after / 45) * .11 * settle
  const contact = after < 60 && ms >= 540 ? Math.sin(after / 60 * Math.PI) : 0
  const altitude = (height / 2 - floor + scale * .8) * (1 - fall * fall) + rebound
  return {
    x: centerX + (wind * width * .12 * (1 - ease(ms / 940))) + Math.sin(fall * Math.PI) * gust * width * .045,
    y: floor + altitude + Math.abs(Math.sin(tilt)) * scale * PREPARE_SHAPE.center,
    z: 20 + Math.sin(fall * Math.PI) * gust * 20,
    pitch: .1 * gust * (1 - fall) + Math.sin(after / 58) * .045 * settle,
    yaw: .15 * wind * (1 - ease(ms / 940)),
    angle: -Math.PI / 2 + tilt,
    squash: 1 - contact * .045,
    altitude,
    contact,
  }
}

export type DotRoute = { origin: Point3; scatter: Point3; delay: number; scatterMs: number; flightMs: number }

/** Full-screen scatter, a curve in front of the shell, then an axial path deep into its open cavity. */
export function dotFlight(route: DotRoute, elapsed: number, target: Point3, approach: Point3): Point3 & { size: number } {
  const age = elapsed - DOT_BURST_MS - route.delay
  if (age <= 0) return { ...route.origin, size: 1 }
  const duration = route.scatterMs / 1000
  const velocity = {
    x: (route.scatter.x - route.origin.x) / duration,
    y: (route.scatter.y - route.origin.y) / duration,
    z: (route.scatter.z - route.origin.z) / duration,
  }
  if (age < route.scatterMs) {
    const seconds = age / 1000
    return {
      x: route.origin.x + velocity.x * seconds,
      y: route.origin.y + velocity.y * seconds,
      z: route.origin.z + velocity.z * seconds,
      size: 1,
    }
  }
  const progress = clamp01((age - route.scatterMs) / route.flightMs)
  const gate = { x: -.24 + approach.x, y: PREPARE_SHAPE.bodyRim + .72 + approach.y, z: .72 + approach.z }
  const turn = { x: gate.x + .04, y: gate.y - .12, z: gate.z - .2 }
  const mouth = { x: target.x, y: PREPARE_SHAPE.bodyRim + .16, z: target.z }
  const entryControl = { x: target.x, y: PREPARE_SHAPE.bodyRim + .4, z: target.z }
  function cubic(a: Point3, b: Point3, c: Point3, d: Point3, t: number) {
    const u = 1 - t
    const component = (axis: 'x' | 'y' | 'z') => u ** 3 * a[axis] + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]
    return { x: component('x'), y: component('y'), z: component('z') }
  }
  let point: Point3
  if (progress < .45) {
    const first = {
      x: route.scatter.x + velocity.x * route.flightMs * .45 / 3000,
      y: route.scatter.y + velocity.y * route.flightMs * .45 / 3000,
      z: route.scatter.z + velocity.z * route.flightMs * .45 / 3000,
    }
    const last = { x: gate.x + (gate.x - turn.x) * .45 / .3, y: gate.y + (gate.y - turn.y) * .45 / .3, z: gate.z + (gate.z - turn.z) * .45 / .3 }
    point = cubic(route.scatter, first, last, gate, progress / .45)
  } else if (progress < .75) {
    point = cubic(gate, turn, entryControl, mouth, (progress - .45) / .3)
  } else {
    const insideControl = { x: target.x, y: mouth.y - (entryControl.y - mouth.y) * .25 / .3, z: target.z }
    point = cubic(mouth, insideControl, { x: target.x, y: target.y + .12, z: target.z }, target, (progress - .75) / .25)
  }
  // Opaque shell depth hides the circles after entry; never shrink them at the mouth.
  return { ...point, size: progress < 1 ? 1 : 0 }
}
