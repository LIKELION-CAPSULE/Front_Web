import { Body, ContactMaterial, GSSolver, Material, Plane, SAPBroadphase, Sphere, Vec3, World } from 'cannon-es'

/**
 * Rigid-body physics of the capsule floor (cannon-es, MIT): capsules bounce, roll, slide, come to rest and push
 * each other. Loaded only by the my-mates scene (its own lazy chunk).
 *
 * - A capsule is a row of four spheres along its axis (cannon has no capsule shape; spheres keep contacts cheap).
 * - Bodies sleep as soon as they are still, and the scene steps the world only while something is awake, so a
 *   settled pile costs nothing.
 * - Fixed time step (1/120 s): the same data and the same drops give (nearly) the same mountain.
 */

export type Vec = { x: number; y: number; z: number }
export type Quat = { x: number; y: number; z: number; w: number }
export type CapsuleSpec = { length: number; radius: number }
export type BodyPose = { position: Vec; quaternion: Quat }

/** Scene units per second²: faster than real life at this scale, so drops read as quick and weighty. */
const GRAVITY = 34
const STEP = 1 / 90
const MAX_STEPS = 4
const MAX_SPEED = 9
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
  /** A shake of the scene: capsules get a small push in the given direction (scene units/s). */
  kick(x: number, z: number): void
  /** Called once per launched body on its first contact: capsule index and impact speed. */
  onLand(listener: (index: number, speed: number, at: Vec) => void): void
  dispose(): void
}

export function createCapsulePhysics(): CapsulePhysics {
  const world = new World({ gravity: new Vec3(0, -GRAVITY, 0), allowSleep: true })
  world.broadphase = new SAPBroadphase(world)
  ;(world.solver as GSSolver).iterations = 6
  world.quatNormalizeFast = true
  world.quatNormalizeSkip = 2

  const capsuleMaterial = new Material('capsule')
  const floorMaterial = new Material('floor')
  world.addContactMaterial(new ContactMaterial(capsuleMaterial, capsuleMaterial, { friction: 0.42, restitution: 0.18 }))
  world.addContactMaterial(new ContactMaterial(capsuleMaterial, floorMaterial, { friction: 0.55, restitution: 0.3 }))

  const floor = new Body({ mass: 0, material: floorMaterial, shape: new Plane() })
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(floor)

  let bodies: Body[] = []
  const held = new Set<number>()
  const landed = new WeakSet<Body>()
  let accumulator = 0
  let landListener: ((index: number, speed: number, at: Vec) => void) | null = null
  const indexOf = new WeakMap<Body, number>()

  const listenLanding = (body: Body) => {
    body.addEventListener('collide', (event: { contact: { getImpactVelocityAlongNormal(): number } }) => {
      if (landed.has(body)) return
      landed.add(body)
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
      const body = new Body({
        mass: spec.length ** 3 * 5,
        material: capsuleMaterial,
        linearDamping: 0.12,
        angularDamping: 0.45,
        allowSleep: true,
        sleepSpeedLimit: 0.2,
        sleepTimeLimit: 0.2,
      })
      for (let s = 0; s < SPHERES; s++) {
        const x = -halfAxis + (2 * halfAxis * s) / (SPHERES - 1)
        body.addShape(new Sphere(spec.radius), new Vec3(x, 0, 0))
      }
      indexOf.set(body, index)
      setPose(body, poses[index]!)
      ensureIn(body)
      body.sleep()
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
    landed.delete(body)
    ensureIn(body)
    held.delete(index)
    body.wakeUp()
  }

  function place(index: number, pose: BodyPose) {
    const body = bodies[index]
    if (!body) return
    setPose(body, pose)
    still(body)
    landed.add(body)
    ensureIn(body)
    held.delete(index)
    body.sleep()
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
    for (const body of world.bodies) {
      if (body.mass === 0) continue
      still(body)
      body.sleep()
    }
    accumulator = 0
  }

  // Deterministic jitter for the shake (no Math.random: the same shake moves the same capsules).
  let shakeSeed = 1
  const jitter = () => {
    shakeSeed = (shakeSeed * 16807) % 2147483647
    return shakeSeed / 2147483647
  }
  function kick(x: number, z: number) {
    for (const body of bodies) {
      if (!inWorld.has(body)) continue
      const share = 0.55 + jitter() * 0.45
      body.wakeUp()
      body.velocity.x += x * share
      body.velocity.z += z * share
      body.velocity.y += Math.hypot(x, z) * 0.35 * jitter()
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
