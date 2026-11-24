import assert from 'node:assert/strict'
import test from 'node:test'
import { createCapsulePhysics, type BodyPose } from '../src/features/mates/capsule-jar/capsule-physics.ts'
import { PILE, layoutFloor, pileBinAt } from '../src/features/mates/capsule-jar/capsule-floor-layout.ts'
import { generateDummyCapsules } from '../src/features/mates/capsule-jar/capsule-jar-dummy.ts'

const NOW = Date.parse('2026-11-24T15:00:00+09:00')
const GRAVITY = 34
const turned = (angle: number) => ({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) })

/** The 2D pile as the scene builds it: panel walls and the bins' inner walls. */
const pilePhysics = () =>
  createCapsulePhysics({
    halfWidth: PILE.width / 2,
    binWalls: { at: [-PILE.binEdge, PILE.binEdge], height: PILE.binWallHeight, thickness: PILE.binWallThickness },
  })

/** Drops the last capsules like the entry (from above the panel, into their bins) and returns where all ended up. */
function run({ connections = 12, falling: fallingCount = 60, shake = false } = {}) {
  const layout = layoutFloor(generateDummyCapsules(connections, { now: NOW }))
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
    assert.equal(pileBinAt(pose.position.x), pileBinAt(placement.x), `capsule ${index} left its bin`)
  }
  // The side heaps stay about as high as laid out (resting capsules are fixed, so nothing levels them out).
  const sideTop = (list: { x: number; y: number }[]) => Math.max(...list.filter((point) => point.x < -PILE.binEdge).map((point) => point.y))
  const laid = sideTop(placements)
  const settled = sideTop(poses.map((pose) => pose.position))
  assert.ok(settled > laid * 0.75, `left heap ${settled} vs ${laid}`)
})

test('physics: a shake moves only capsules still falling; everything ends inside the panel', () => {
  const shaken = run({ shake: true })
  for (const pose of shaken.poses) assert.ok(Math.abs(pose.position.x) <= PILE.width / 2)
})

test('physics: the same drops give the same result', () => {
  const first = run({ connections: 5, falling: 20 })
  const second = run({ connections: 5, falling: 20 })
  assert.deepEqual(second.poses, first.poses)
})
