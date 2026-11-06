export const PREPARE_SHAPE = { radius: .34, center: .45, bodyRim: -.01, capRim: .01, length: 1.58 } as const
export const PREPARE_STORE_MS = 4660
export const PREPARE_DEPARTURE_MS = 5150
export const PREPARE_TRAVEL_MS = 1100
export const DOT_BURST_MS = 2240
export const DOT_CLEAR_MS = 3980
export const LID_OPEN_START_MS = 1400
export const LID_OPEN_END_MS = 2120
export const LID_CLOSE_START_MS = 4060
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export const ease = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t) }
export type Point3 = { x: number; y: number; z: number }

/** These are layout coordinates, independent of the capsule's wind, gravity and floor simulation. */
export function prepareFormLayout(width: number, height: number, cardWidth: number, cardHeight: number) {
  const baselineScale = width < 768 ? .66 : .72
  return { scale: Math.min(baselineScale, height * .31 / cardHeight, width * .74 / cardWidth), baselineScale, x: 0, y: -height * .285 }
}

export function prepareCapsuleScale(width: number, height: number) {
  return Math.max(1, Math.min(520 / PREPARE_SHAPE.length, width * .82 / PREPARE_SHAPE.length, (height * .42 - 24) / 1.24))
}

/** Disengage first, lift second, rotate last. Reverse the same path to dock without a diagonal sweep. */
export function capsuleLidPose(openness: number) {
  const pull = ease(openness / .28), lift = ease((openness - .28) / .55), turn = ease((openness - .83) / .17)
  return { x: -.82 * lift, y: .14 * pull, z: .04 * lift, angle: .1 * turn }
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
export function capsuleLanding(ms: number, width: number, height: number, scale: number, seed: number) {
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
  const altitude = (height * .5 + scale * .8) * (1 - fall * fall) + rebound
  return {
    x: -width * .025 + (wind * width * .12 * (1 - ease(ms / 940))) + Math.sin(fall * Math.PI) * gust * width * .045,
    y: height * .08 + altitude + Math.abs(Math.sin(tilt)) * scale * PREPARE_SHAPE.center,
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

/** Choreographed scatter, an arc below the body, then entry through the aperture. No environmental forces. */
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
  const gate = { x: .48 + approach.x, y: .52 + approach.y, z: target.z + approach.z }
  const entryControl = { x: target.x, y: gate.y, z: gate.z }
  function cubic(a: Point3, b: Point3, c: Point3, d: Point3, t: number) {
    const u = 1 - t
    const component = (axis: 'x' | 'y' | 'z') => u ** 3 * a[axis] + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]
    return { x: component('x'), y: component('y'), z: component('z') }
  }
  let point: Point3
  if (progress < .65) {
    const first = {
      x: Math.max(.4, route.scatter.x + velocity.x * route.flightMs * .65 / 3000),
      y: route.scatter.y + velocity.y * route.flightMs * .65 / 3000,
      z: route.scatter.z + velocity.z * route.flightMs * .65 / 3000,
    }
    const last = { x: gate.x + (gate.x - entryControl.x) * .65 / .35, y: gate.y, z: gate.z }
    point = cubic(route.scatter, first, last, gate, progress / .65)
  } else {
    point = cubic(gate, entryControl, { x: target.x, y: .1, z: target.z }, target, (progress - .65) / .35)
  }
  return { ...point, size: 1 - ease((progress - .92) / .08) }
}
