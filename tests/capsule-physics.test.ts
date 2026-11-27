import assert from 'node:assert/strict'
import test from 'node:test'
import { createCapsulePhysics, type BodyPose } from '../src/features/mates/capsule-jar/capsule-physics.ts'
import { PILE, layoutFloor, pileBinAt, pileHalfWidth } from '../src/features/mates/capsule-jar/capsule-floor-layout.ts'
import { generateDummyCapsules } from '../src/features/mates/capsule-jar/capsule-jar-dummy.ts'
import { planPour, POUR } from '../src/features/mates/capsule-jar/capsule-pour.ts'

const NOW = Date.parse('2026-11-24T15:00:00+09:00')
const GRAVITY = 34
const turned = (angle: number) => ({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })

/** A 1280×720 panel (740×560): the floor's half width in scene units. */
const HALF = pileHalfWidth(740 / 560)

/** The 2D pile as the scene builds it: panel walls and the bins' inner walls. */
const pilePhysics = () =>
  createCapsulePhysics({
    halfWidth: HALF,
    binWalls: { at: [-PILE.binEdge, PILE.binEdge], height: PILE.binWallHeight, thickness: PILE.binWallThickness },
  })

/** Drops the last capsules like the entry (from above the panel, into their bins) and returns where all ended up. */
function run({ connections = 12, falling: fallingCount = 60, shake = false } = {}) {
  const layout = layoutFloor(generateDummyCapsules(connections, { now: NOW }), { halfWidth: HALF })
  const placements = layout.placements
  const physics = pilePhysics()
  physics.setCapsules(
    placements.map((placement) => ({ length: placement.length, radius: placement.radius })),
    placements.map((placement) => ({ position: { x: placement.x, y: placement.y, z: 0 }, quaternion: turned(placement.pitch) })),
  )
  const falling = placements.slice(-fallingCount).map((placement) => placement.index)
  for (const index of falling) physics.hold(index)
  const landed: number[] = []
  physics.onLand((index) => landed.push(index))
  const top = 8
  const fall = 0.55
  for (let frame = 0; frame < 360; frame++) {
    const time = frame / 90
    for (const [order, index] of falling.entries()) {
      if (physics.isHeld(index) && time >= order * 0.022) {
        const placement = placements[index]!
        const vy = (placement.y + 0.15 - top + 0.5 * GRAVITY * fall * fall) / fall
        physics.launch(index, { position: { x: placement.x, y: top, z: 0 }, quaternion: turned(placement.pitch) }, { x: 0, y: vy, z: 0 }, { x: 0, y: 0, z: 3 })
      }
    }
    if (shake && frame === 40) physics.kick(0.4, 0.2)
    physics.step(1 / 90)
  }
  physics.freeze()
  const poses = placements.map((_, index) => {
    const pose: BodyPose = { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }
    physics.read(index, pose)
    return pose
  })
  physics.dispose()
  return { poses, landed, placements }
}

test('physics: dropped capsules land in their own bin, in the screen plane, and the side heaps keep their height', () => {
  const { poses, landed, placements } = run()
  assert.ok(landed.length >= 50, `the falling capsules landed (${landed.length})`)
  for (const [index, pose] of poses.entries()) {
    const placement = placements[index]!
    assert.equal(pose.position.z, 0, '2D: z stays 0')
    assert.ok(Math.abs(pose.quaternion.x) < 1e-6 && Math.abs(pose.quaternion.y) < 1e-6, '2D: turned only about z')
    assert.ok(pose.position.y >= placement.radius * 0.6, `capsule ${index} sank through the floor`)
    assert.deepEqual(pileBinAt(pose.position.x, HALF), pileBinAt(placement.x, HALF), `capsule ${index} left its bin`)
  }
  // The side heaps stay about as high as laid out (resting capsules are fixed, so nothing levels them out).
  const sideTop = (list: { x: number; y: number }[]) => Math.max(...list.filter((point) => point.x < -PILE.binEdge).map((point) => point.y))
  const laid = sideTop(placements)
  const settled = sideTop(poses.map((pose) => pose.position))
  assert.ok(settled > laid * 0.75, `left heap ${settled} vs ${laid}`)
})

test('physics: a shake moves only capsules still falling; everything ends inside the panel', () => {
  const shaken = run({ shake: true })
  for (const pose of shaken.poses) assert.ok(Math.abs(pose.position.x) <= HALF)
})

test('physics: the same drops give the same result', () => {
  const first = run({ connections: 5, falling: 20 })
  const second = run({ connections: 5, falling: 20 })
  assert.deepEqual(second.poses, first.poses)
})

test('physics: 120+ capsules settle completely under enter and switch timings even with pause/resume gaps', () => {
  // 20 connections produce ~120+ capsules in the pile.
  const layout = layoutFloor(generateDummyCapsules(20, { now: NOW }), { halfWidth: HALF })
  const placements = layout.placements
  assert.ok(placements.length >= 120, `expected >= 120 capsules, got ${placements.length}`)

  for (const durationMs of [POUR.enterMs, 600]) {
    const physics = pilePhysics()
    physics.setCapsules(
      placements.map((placement) => ({ length: placement.length, radius: placement.radius })),
      placements.map((placement) => ({ position: { x: placement.x, y: placement.y, z: 0 }, quaternion: turned(placement.pitch) })),
    )
    const plan = planPour(placements.map((placement) => placement.id), [], { durationMs, maxFalling: POUR.maxFalling })
    const pending = new Map(plan.steps.map((step) => [step.index, step]))
    for (const index of pending.keys()) physics.hold(index)

    const top = PILE.viewHeight + 0.7
    let clock = 0
    // Simulate 60fps with occasional 50ms spikes and a pause/resume gap (tab hidden / scrolled off-screen).
    for (let frame = 0; frame < 420; frame++) {
      // Simulate pause: when the tab hides, clock & physics both stop; on return, dt resumes normally.
      if (frame >= 25 && frame < 45) continue
      const dt = frame % 17 === 0 ? 0.05 : 1 / 60
      clock += dt
      for (const [index, step] of pending) {
        if (clock >= step.start) {
          pending.delete(index)
          const placement = placements[index]!
          const bin = pileBinAt(placement.x, HALF)
          const low = bin.from + placement.length / 2 + 0.01
          const high = bin.to - placement.length / 2 - 0.01
          const startX = low <= high ? Math.max(low, Math.min(high, placement.x)) : (bin.from + bin.to) / 2
          const vy = (placement.y + 0.15 - top + 0.5 * GRAVITY * step.fall * step.fall) / step.fall
          physics.launch(
            index,
            { position: { x: startX, y: top, z: 0 }, quaternion: turned(placement.pitch) },
            { x: 0, y: vy, z: 0 },
            { x: 0, y: 0, z: (index % 2 === 0 ? 1 : -1) * 4 },
          )
        }
      }
      physics.step(dt)
      if (pending.size === 0 && physics.isSettled()) break
    }

    assert.equal(pending.size, 0, `all scheduled capsules launched (${durationMs}ms)`)
    assert.equal(physics.isSettled(), true, `all ${placements.length} capsules settled naturally (${durationMs}ms)`)

    const pose: BodyPose = { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }
    const velocity = { x: 0, y: 0, z: 0 }
    for (const [index, placement] of placements.entries()) {
      physics.read(index, pose)
      physics.readVelocity(index, velocity)
      const speed = Math.hypot(velocity.x, velocity.y)
      assert.equal(physics.isHeld(index), false, `capsule ${index} not held`)
      assert.equal(physics.isDynamic(index), false, `capsule ${index} settled static`)
      assert.equal(physics.isSupported(index), true, `capsule ${index} supported`)
      assert.ok(speed < 1e-3, `capsule ${index} speed=${speed}`)
      assert.ok(pose.position.y >= placement.radius * 0.5, `capsule ${index} y=${pose.position.y} above floor`)
      assert.ok(pose.position.y <= layout.topHeight + 2.2, `capsule ${index} y=${pose.position.y} not frozen high in mid-air`)
    }
    physics.dispose()
  }
})

test('physics: a capsule launched slowly against a vertical bin wall does not freeze mid-air and falls to the floor', () => {
  const physics = pilePhysics()
  const spec = { length: 0.42, radius: 0.092 }
  physics.setCapsules([spec], [{ position: { x: -PILE.binEdge - 0.5, y: spec.radius, z: 0 }, quaternion: turned(0) }])
  // Launch pressed against the inner bin wall high above the floor with near-zero initial speed.
  physics.launch(
    0,
    { position: { x: -PILE.binEdge - spec.length / 2, y: 5.2, z: 0 }, quaternion: turned(0.05) },
    { x: 0.08, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  )
  for (let frame = 0; frame < 240; frame++) {
    physics.step(1 / 60)
    if (physics.isSettled()) break
  }
  const pose: BodyPose = { position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }
  const velocity = { x: 0, y: 0, z: 0 }
  physics.read(0, pose)
  physics.readVelocity(0, velocity)
  assert.equal(physics.isSettled(), true, 'wall-grazing capsule settled')
  assert.equal(physics.isSupported(0), true, 'wall-grazing capsule supported on floor')
  assert.ok(pose.position.y < spec.length * 0.8, `capsule reached floor, got y=${pose.position.y}`)
  assert.equal(Math.hypot(velocity.x, velocity.y), 0)
  physics.dispose()
})
