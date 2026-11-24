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
const MAX_STEPS = 8
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
  isHeld(index: number): boolean
  /** Advances by `dt` seconds of real time (fixed sub-steps). Returns whether anything is still moving. */
  step(dt: number): boolean
  /** Everything stops where it is and sleeps. */
  freeze(): void
  /** A shake of the scene: capsules get a small push in the given screen direction (scene units/s). */
  kick(x: number, y: number): void
  /** Called once per launched body on its first contact: capsule index and impact speed. */
  onLand(listener: (index: number, speed: number, at: Vec) => void): void
  dispose(): void
}

/**
 * `halfWidth`: the floor between the side walls (scene units). `binWalls`: thin inner walls (x positions and height)
 * that keep the side heaps standing (capsule-floor-layout.ts `PILE_BINS`). Defaults: the pile's panel, no bins.
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
  for (const side of [-1, 1]) {
    const wall = new Body({ mass: 0, material: wallMaterial, shape: new Plane() })
    wall.quaternion.setFromEuler(0, (side * -Math.PI) / 2, 0)
    wall.position.set(side * halfWidth, 0, 0)
    walls.add(wall)
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
  /** Fixed in place (part of the pile): no gravity, nothing pushes it. */
  const makeStatic = (body: Body) => {
    if (body.type === Body.STATIC) return
    still(body)
    body.type = Body.STATIC
    body.mass = 0
    body.updateMassProperties()
  }
  const makeDynamic = (body: Body) => {
    if (body.type === Body.DYNAMIC) return
    body.type = Body.DYNAMIC
    body.mass = massOf.get(body) ?? 1
    body.updateMassProperties()
  }
  const listenLanding = (body: Body) => {
    body.addEventListener('sleep', () => makeStatic(body))
    body.addEventListener('collide', (event: { body: Body; contact: { getImpactVelocityAlongNormal(): number } }) => {
      // Landing is touching the floor, the fixed pile or a capsule that has landed — not a wall, not another capsule
      // still in the air (that would damp both mid-air and let them jam in a narrow bin).
      if (landed.has(body) || walls.has(event.body) || (event.body.type !== Body.STATIC && !landed.has(event.body))) return
      landed.add(body)
      body.linearDamping = LANDED.linear
      body.angularDamping = LANDED.angular
      body.angularFactor.set(0, 0, 0)
      body.angularVelocity.set(0, 0, 0)
      landListener?.(indexOf.get(body) ?? -1, Math.abs(event.contact.getImpactVelocityAlongNormal()), {
        x: body.position.x,
        y: body.position.y,
        z: body.position.z,
      })
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
    body.linearDamping = AIR.linear
    body.angularDamping = AIR.angular
    body.angularFactor.set(0, 0, 1)
    makeDynamic(body)
    landed.delete(body)
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

  function anyAwake() {
    for (const body of world.bodies) if (body.mass > 0 && body.sleepState !== Body.SLEEPING) return true
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
      // A body squeezed out of an overlap must not shoot away.
      for (const body of world.bodies) {
        if (body.mass === 0 || body.sleepState === Body.SLEEPING) continue
        const speed = body.velocity.length()
        if (speed > MAX_SPEED) body.velocity.scale(MAX_SPEED / speed, body.velocity)
        if (body.position.y < -0.5) {
          body.position.y = 0.3
          still(body)
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
    isHeld: (index) => held.has(index),
    step,
    freeze,
    kick,
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

export const PHYSICS = { gravity: GRAVITY } as const
