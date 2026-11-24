import assert from 'node:assert/strict'
import test from 'node:test'
import { createCapsulePhysics, type BodyPose } from '../src/features/mates/capsule-jar/capsule-physics.ts'
import { layoutFloor } from '../src/features/mates/capsule-jar/capsule-floor-layout.ts'
import { generateDummyCapsules } from '../src/features/mates/capsule-jar/capsule-jar-dummy.ts'

const NOW = Date.parse('2026-11-24T15:00:00+09:00')
const identity = { x: 0, y: 0, z: 0, w: 1 }

/** Drops the last capsules like the entry (optionally shakes the floor), and returns where everything ended up. */
function run({ shake = false } = {}) {
  const layout = layoutFloor(generateDummyCapsules(5, { now: NOW }))
  const physics = createCapsulePhysics()
  physics.setCapsules(
    layout.placements.map((placement) => ({ length: placement.length, radius: placement.radius })),
    layout.placements.map((placement) => ({ position: { x: placement.x, y: placement.y, z: placement.z }, quaternion: identity })),
  )
  const falling = layout.placements.slice(-10).map((placement) => placement.index)
  for (const index of falling) physics.hold(index)
  const landed: number[] = []
  physics.onLand((index) => landed.push(index))
  for (let frame = 0; frame < 180; frame++) {
    const time = frame / 60
    for (const [order, index] of falling.entries()) {
      if (physics.isHeld(index) && time >= order * 0.06) {
        const placement = layout.placements[index]!
        physics.launch(index, { position: { x: placement.x, y: 3, z: placement.z }, quaternion: identity }, { x: 0, y: -6, z: 0 }, { x: 4, y: 0, z: -3 })
      }
    }
    if (shake && frame === 120) physics.kick(0.3, -0.2)
    physics.step(1 / 60)
  }
  physics.freeze()
  const poses = layout.placements.map((_, index) => {
    const pose: BodyPose = { position: { x: 0, y: 0, z: 0 }, quaternion: { ...identity } }
    physics.read(index, pose)
    return pose
  })
  physics.dispose()
  return { poses, landed, layout }
}

test('physics: dropped capsules land and rest on the floor', () => {
  const { poses, landed, layout } = run()
  assert.ok(!landed.includes(-1), 'only capsules land (no card any more)')
  assert.ok(landed.length >= 8, 'the falling capsules landed')
  for (const [index, pose] of poses.entries()) {
    assert.ok(pose.position.y >= layout.placements[index]!.radius * 0.6, `capsule ${index} sank through the floor`)
    assert.ok(pose.position.y < 1.5, `capsule ${index} is floating`)
  }
})

test('physics: a shake moves the pile and everything settles on the floor again', () => {
  const calm = run()
  const shaken = run({ shake: true })
  assert.notDeepEqual(shaken.poses, calm.poses)
  for (const [index, pose] of shaken.poses.entries()) {
    assert.ok(pose.position.y >= shaken.layout.placements[index]!.radius * 0.6, `capsule ${index} sank through the floor`)
  }
})

test('physics: the same drops give the same result', () => {
  const first = run()
  const second = run()
  assert.deepEqual(second.poses, first.poses)
})
