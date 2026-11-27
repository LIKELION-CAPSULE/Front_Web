import { Body, Box, ContactMaterial, GSSolver, Material, Plane, SAPBroadphase, Sphere, Vec3, World } from 'cannon-es'

/**
 * Rigid-body physics of the capsule pile (cannon-es, MIT): capsules fall, bounce, roll, come to rest and push each
 * other. Loaded only by the my-mates scene (its own lazy chunk).
 *
 * - 2D: the pile is seen flat from the side, so every body moves only in the screen plane. Each body's linear factor
 *   is (1, 1, 0) (z stays 0) and, while it falls, its angular factor (0, 0, 1) (it tumbles only about z); two walls
 *   close the panel's sides and two inner walls keep the side heaps (capsule-floor-layout.ts). Using cannon with these
 *   constraints keeps the tested contact, friction, restitution and sleeping as they were, instead of writing a
 *   separate 2D solver.
 * - Resting capsules are *static*: in 2D, round capsules roll over each other like discs, and a woken heap of
 *   hundreds levels out (it was tested). So a capsule at rest is fixed; a launched one is dynamic, bounces and
 *   tumbles, is damped hard after its first contact (it stops near where it landed, rotation locked) and turns static
 *   again once it falls asleep. A shake therefore moves only capsules still falling.
 * - A capsule is a row of three spheres along its axis (cannon has no capsule shape; spheres keep contacts cheap).
 * - Bodies sleep as soon as they are still, and the scene steps the world only while something is awake, so a
 *   settled pile costs nothing.
 * - Fixed time step (1/180 s): the same data and the same drops give (nearly) the same pile.
 */

export type Vec = { x: number; y: number; z: number }
export type Quat = { x: number; y: number; z: number; w: number }
export type CapsuleSpec = { length: number; radius: number }
export type BodyPose = { position: Vec; quaternion: Quat }

/** Scene units per second²: faster than real life at this scale, so drops read as quick and weighty. */
const GRAVITY = 34
// Small steps and a speed cap so a falling capsule moves less than its radius per step (the smallest, 0.2 long, has
// a radius of 0.044): nothing tunnels through the fixed pile or the inner walls.
const STEP = 1 / 180
// Covers the scene's max frame dt (0.05 s) without silently dropping physics time.
const MAX_STEPS = 10
const MAX_SPEED = 7
const SPHERES = 3

export type CapsulePhysics = {
  /** All capsules, resting (asleep) at the given poses. Rebuilds the bodies. */
  setCapsules(specs: readonly CapsuleSpec[], poses: readonly BodyPose[]): void
  /** Takes a capsule out of the world until it is launched (it is still waiting to fall). */
  hold(index: number): void
  /** Puts a capsule into the world, moving. */
  launch(index: number, pose: BodyPose, velocity: Vec, spin: Vec): void
  /** Puts a capsule at rest (asleep) at a pose. */
  place(index: number, pose: BodyPose): void
  read(index: number, out: BodyPose): void
  readVelocity(index: number, out: Vec): void
  readAngularVelocity(index: number, out: Vec): void
  isHeld(index: number): boolean
  /** True while the capsule is in the world and still falling / settling (not yet static). */
  isDynamic(index: number): boolean
  /** True when the capsule rests on the floor or a static capsule below it. */
  isSupported(index: number): boolean
  /** True when every in-world capsule has settled into the static pile. */
  isSettled(): boolean
  /** Advances by `dt` seconds of real time (fixed sub-steps). Returns whether anything is still moving. */
  step(dt: number): boolean
  /** Everything stops where it is and sleeps. */
  freeze(): void
  /** A shake of the scene: capsules get a small push in the given screen direction (scene units/s). */
  kick(x: number, y: number): void
  /** Moves the panel's side walls (the panel changed shape). */
  setHalfWidth(halfWidth: number): void
  /** Called once per launched body on its first contact: capsule index and impact speed. */
  onLand(listener: (index: number, speed: number, at: Vec) => void): void
  dispose(): void
}

/**
 * `halfWidth`: the floor between the side walls (scene units). `binWalls`: thin inner walls (x positions and height)
 * that keep the side heaps standing (capsule-floor-layout.ts `pileBins`). Defaults: a 3-unit half width, no bins.
 */
export function createCapsulePhysics({
  halfWidth = 3,
  binWalls,
}: { halfWidth?: number; binWalls?: { at: readonly number[]; height: number; thickness: number } } = {}): CapsulePhysics {
  const world = new World({ gravity: new Vec3(0, -GRAVITY, 0), allowSleep: true })
  // Sweep along y: sorting along x missed the contacts with the thin inner walls (capsules passed through them).
  const broadphase = new SAPBroadphase(world)
  broadphase.axisIndex = 1
  world.broadphase = broadphase
  ;(world.solver as GSSolver).iterations = 6
  world.quatNormalizeFast = true
  world.quatNormalizeSkip = 2

  const capsuleMaterial = new Material('capsule')
  const floorMaterial = new Material('floor')
  // Grippy enough (μ 0.75 > tan 25°) that the side heaps keep their slope: a capsule landing on it stops instead of
  // sliding to the middle; it still bounces and tumbles a little first.
  world.addContactMaterial(new ContactMaterial(capsuleMaterial, capsuleMaterial, { friction: 0.75, restitution: 0.18 }))
  world.addContactMaterial(new ContactMaterial(capsuleMaterial, floorMaterial, { friction: 0.6, restitution: 0.28 }))

  // Walls are slippery: in a narrow bin, friction on both sides would let falling capsules jam like grain in a silo.
  const wallMaterial = new Material('wall')
  world.addContactMaterial(new ContactMaterial(capsuleMaterial, wallMaterial, { friction: 0, restitution: 0.2 }))
  const walls = new WeakSet<Body>()

  const floor = new Body({ mass: 0, material: floorMaterial, shape: new Plane() })
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(floor)
  // The panel's sides: walls facing inwards, so nothing rolls out of sight.
  const sideWalls: Body[] = []
  for (const side of [-1, 1]) {
    const wall = new Body({ mass: 0, material: wallMaterial, shape: new Plane() })
    wall.quaternion.setFromEuler(0, (side * -Math.PI) / 2, 0)
    wall.position.set(side * halfWidth, 0, 0)
    walls.add(wall)
    sideWalls.push(wall)
    world.addBody(wall)
  }
  // Inner walls: `at` is the face toward the side bin; the wall's thickness lies toward the middle.
  for (const x of binWalls?.at ?? []) {
    const { height, thickness } = binWalls!
    const wall = new Body({ mass: 0, material: wallMaterial, shape: new Box(new Vec3(thickness / 2, height / 2, 0.5)) })
    wall.position.set(x - (Math.sign(x) * thickness) / 2, height / 2, 0)
    walls.add(wall)
    world.addBody(wall)
  }

  let bodies: Body[] = []
  const held = new Set<number>()
  const landed = new WeakSet<Body>()
  let accumulator = 0
  let landListener: ((index: number, speed: number, at: Vec) => void) | null = null
  const indexOf = new WeakMap<Body, number>()

  // After its first contact a dropped capsule is damped hard: it bounces and tumbles once, then stops close to where
  // it landed, so the heaps keep their shape.
  const AIR = { linear: 0.12, angular: 0.6 }
  const LANDED = { linear: 0.6, angular: 0.99 }
  const massOf = new WeakMap<Body, number>()
  const radiusOf = new WeakMap<Body, number>()
  const stallTime = new WeakMap<Body, number>()
  const restTime = new WeakMap<Body, number>()
  const anchorOf = new WeakMap<Body, { x: number; y: number }>()

  /**
   * True when `body` actually rests on the floor or on a settled (static) capsule in the pile — never on a vertical
   * wall alone and never in empty mid-air. Prevents sleeping / turning static while hanging in mid-air or against a
   * wall with nothing underneath.
   */
  const bodySupported = (body: Body): boolean => {
    const radius = radiusOf.get(body) ?? 0.05
    if (body.position.y <= radius + 0.04) return true
    for (const contact of world.contacts) {
      if (contact.bi !== body && contact.bj !== body) continue
      const other = contact.bi === body ? contact.bj : contact.bi
      if (walls.has(other) || other.type !== Body.STATIC) continue
      if (other === floor) return true
      // In cannon-es `ni` points out of `bi` toward `bj`, so the upward normal into `body` is `-ni.y` when `bi === body`.
      const upward = contact.bi === body ? -contact.ni.y : contact.ni.y
      if (upward > 0.05 || other.position.y <= body.position.y + radius * 0.5) return true
    }
    return false
  }

  /** Restores free-fall damping and rotation to unstick a body that stalled without vertical support. */
  const releaseAir = (body: Body) => {
    landed.delete(body)
    body.linearDamping = AIR.linear
    body.angularDamping = AIR.angular
    body.angularFactor.set(0, 0, 1)
    stallTime.set(body, 0)
    restTime.set(body, 0)
    anchorOf.delete(body)
  }

  const applyLanded = (body: Body, impactSpeed?: number) => {
    if (landed.has(body)) return
    landed.add(body)
    body.linearDamping = LANDED.linear
    body.angularDamping = LANDED.angular
    body.angularFactor.set(0, 0, 0)
    body.angularVelocity.set(0, 0, 0)
    if (impactSpeed !== undefined) {
      landListener?.(indexOf.get(body) ?? -1, impactSpeed, {
        x: body.position.x,
        y: body.position.y,
        z: body.position.z,
      })
    }
  }

  /** Fixed in place (part of the pile): no gravity, nothing pushes it. */
  const makeStatic = (body: Body) => {
    if (body.type === Body.STATIC) return
    still(body)
    body.type = Body.STATIC
    body.mass = 0
    body.updateMassProperties()
    stallTime.set(body, 0)
    restTime.set(body, 0)
    anchorOf.delete(body)
  }
  const makeDynamic = (body: Body) => {
    if (body.type === Body.DYNAMIC) return
    body.type = Body.DYNAMIC
    body.mass = massOf.get(body) ?? 1
    body.updateMassProperties()
  }
  const listenLanding = (body: Body) => {
    body.addEventListener('sleep', () => {
      if (body.type !== Body.DYNAMIC) return
      if (bodySupported(body) || (restTime.get(body) ?? 0) >= 0.08) {
        makeStatic(body)
        return
      }
      // Never lock an unsupported capsule static in mid-air: wake it up and let step() finish the drop.
      body.wakeUp()
    })
    body.addEventListener('collide', (event: { body: Body; contact: { bi: Body; bj: Body; ni: Vec3; getImpactVelocityAlongNormal(): number } }) => {
      // Walls never count as landing; hitting the floor or another capsule already on/near the pile does.
      if (landed.has(body) || walls.has(event.body)) return
      if (event.body.type !== Body.STATIC && !landed.has(event.body)) return
      const upward = event.contact.bi === body ? -event.contact.ni.y : event.contact.ni.y
      if (event.body !== floor && upward <= 0.1) return
      applyLanded(body, Math.abs(event.contact.getImpactVelocityAlongNormal()))
    })
  }

  const setPose = (body: Body, pose: BodyPose) => {
    body.position.set(pose.position.x, pose.position.y, pose.position.z)
    body.quaternion.set(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w)
    body.previousPosition.copy(body.position)
    body.interpolatedPosition.copy(body.position)
    body.interpolatedQuaternion.copy(body.quaternion)
  }
  const still = (body: Body) => {
    body.velocity.set(0, 0, 0)
    body.angularVelocity.set(0, 0, 0)
    body.force.set(0, 0, 0)
    body.torque.set(0, 0, 0)
  }
  const inWorld = new Set<Body>()
  const ensureIn = (body: Body) => {
    if (inWorld.has(body)) return
    world.addBody(body)
    inWorld.add(body)
  }
  const takeOut = (body: Body) => {
    if (!inWorld.has(body)) return
    world.removeBody(body)
    inWorld.delete(body)
  }

  function setCapsules(specs: readonly CapsuleSpec[], poses: readonly BodyPose[]) {
    for (const body of bodies) takeOut(body)
    held.clear()
    bodies = specs.map((spec, index) => {
      const halfAxis = Math.max(0, spec.length / 2 - spec.radius)
      const mass = spec.length ** 3 * 5
      const body = new Body({
        mass,
        material: capsuleMaterial,
        linearDamping: LANDED.linear,
        angularDamping: LANDED.angular,
        allowSleep: true,
        sleepSpeedLimit: 0.2,
        sleepTimeLimit: 0.2,
        // 2D: moves in the screen plane only and turns only about the view axis.
        linearFactor: new Vec3(1, 1, 0),
        // Resting capsules do not turn (spheres would roll over each other like discs and level any heap);
        // a launched one tumbles in the plane until it first touches something.
        angularFactor: new Vec3(0, 0, 0),
      })
      for (let s = 0; s < SPHERES; s++) {
        const x = -halfAxis + (2 * halfAxis * s) / (SPHERES - 1)
        body.addShape(new Sphere(spec.radius), new Vec3(x, 0, 0))
      }
      indexOf.set(body, index)
      massOf.set(body, mass)
      radiusOf.set(body, spec.radius)
      setPose(body, poses[index]!)
      makeStatic(body)
      ensureIn(body)
      landed.add(body)
      listenLanding(body)
      return body
    })
  }

  function hold(index: number) {
    const body = bodies[index]
    if (!body) return
    takeOut(body)
    held.add(index)
  }

  function launch(index: number, pose: BodyPose, velocity: Vec, spin: Vec) {
    const body = bodies[index]
    if (!body) return
    setPose(body, pose)
    body.velocity.set(velocity.x, velocity.y, velocity.z)
    body.angularVelocity.set(spin.x, spin.y, spin.z)
    releaseAir(body)
    makeDynamic(body)
    ensureIn(body)
    held.delete(index)
    body.wakeUp()
  }

  function place(index: number, pose: BodyPose) {
    const body = bodies[index]
    if (!body) return
    setPose(body, pose)
    makeStatic(body)
    landed.add(body)
    ensureIn(body)
    held.delete(index)
  }

  function read(index: number, out: BodyPose) {
    const body = bodies[index]
    if (!body) return
    out.position.x = body.position.x
    out.position.y = body.position.y
    out.position.z = body.position.z
    out.quaternion.x = body.quaternion.x
    out.quaternion.y = body.quaternion.y
    out.quaternion.z = body.quaternion.z
    out.quaternion.w = body.quaternion.w
  }

  function readVelocity(index: number, out: Vec) {
    const body = bodies[index]
    if (!body) {
      out.x = out.y = out.z = 0
      return
    }
    out.x = body.velocity.x
    out.y = body.velocity.y
    out.z = body.velocity.z
  }

  function readAngularVelocity(index: number, out: Vec) {
    const body = bodies[index]
    if (!body) {
      out.x = out.y = out.z = 0
      return
    }
    out.x = body.angularVelocity.x
    out.y = body.angularVelocity.y
    out.z = body.angularVelocity.z
  }

  function anyAwake() {
    for (const body of world.bodies) if (body.mass > 0 && (body.sleepState !== Body.SLEEPING || body.type === Body.DYNAMIC)) return true
    return false
  }

  function step(dt: number) {
    if (!anyAwake()) {
      accumulator = 0
      return false
    }
    accumulator = Math.min(accumulator + dt, STEP * MAX_STEPS)
    while (accumulator >= STEP) {
      world.step(STEP)
      accumulator -= STEP
      // A body squeezed out of an overlap must not shoot away, and nothing may stall in mid-air or against a wall.
      for (const body of world.bodies) {
        if (body.mass === 0 || body.type !== Body.DYNAMIC) continue
        const speed = body.velocity.length()
        if (speed > MAX_SPEED) body.velocity.scale(MAX_SPEED / speed, body.velocity)
        if (body.position.y < -0.5) {
          body.position.y = 0.3
          still(body)
        }
        const supported = bodySupported(body)
        if (supported) {
          if (!landed.has(body)) applyLanded(body)
          stallTime.set(body, 0)
          const anchor = anchorOf.get(body)
          const moved = anchor ? Math.hypot(body.position.x - anchor.x, body.position.y - anchor.y) : Infinity
          if (moved < 0.05) {
            const nextRest = (restTime.get(body) ?? 0) + STEP
            if (nextRest >= 0.25) makeStatic(body)
            else restTime.set(body, nextRest)
          } else {
            anchorOf.set(body, { x: body.position.x, y: body.position.y })
            restTime.set(body, 0)
          }
        } else {
          if (body.sleepState === Body.SLEEPING) body.wakeUp()
          const nextStall = (stallTime.get(body) ?? 0) + STEP
          if (nextStall >= 0.05) {
            restTime.set(body, 0)
            anchorOf.delete(body)
          }
          if (speed < 0.25) {
            if (nextStall >= 0.3) {
              releaseAir(body)
              body.wakeUp()
              body.velocity.y = Math.min(body.velocity.y, -1.5)
              body.angularVelocity.z += (body.position.x >= 0 ? 1 : -1) * 2.5
            } else {
              stallTime.set(body, nextStall)
            }
          } else {
            stallTime.set(body, 0)
          }
        }
      }
    }
    return anyAwake()
  }

  function freeze() {
    for (const body of bodies) if (inWorld.has(body)) makeStatic(body)
    accumulator = 0
  }

  // Deterministic jitter for the shake (no Math.random: the same shake moves the same capsules).
  let shakeSeed = 1
  const jitter = () => {
    shakeSeed = (shakeSeed * 16807) % 2147483647
    return shakeSeed / 2147483647
  }
  function kick(x: number, y: number) {
    for (const body of bodies) {
      // Only capsules still on the move: the settled pile is fixed.
      if (!inWorld.has(body) || body.type !== Body.DYNAMIC) continue
      const share = 0.55 + jitter() * 0.45
      body.wakeUp()
      body.velocity.x += x * share
      // Always a little upwards, so a sideways sweep lifts and rolls the top capsules.
      body.velocity.y += Math.max(0, y) * share + Math.hypot(x, y) * 0.35 * jitter()
    }
  }

  return {
    setCapsules,
    hold,
    launch,
    place,
    read,
    readVelocity,
    readAngularVelocity,
    isHeld: (index) => held.has(index),
    isDynamic: (index) => {
      const body = bodies[index]
      return Boolean(body && inWorld.has(body) && body.type === Body.DYNAMIC)
    },
    isSupported: (index) => {
      const body = bodies[index]
      return Boolean(body && inWorld.has(body) && (body.type === Body.STATIC || bodySupported(body)))
    },
    isSettled: () => !anyAwake(),
    step,
    freeze,
    kick,
    setHalfWidth(next) {
      sideWalls[0]!.position.x = -next
      sideWalls[1]!.position.x = next
      for (const wall of sideWalls) wall.aabbNeedsUpdate = true
    },
    onLand: (listener) => {
      landListener = listener
    },
    dispose() {
      for (const body of [...world.bodies]) world.removeBody(body)
      inWorld.clear()
      bodies = []
      landListener = null
    },
  }
}
