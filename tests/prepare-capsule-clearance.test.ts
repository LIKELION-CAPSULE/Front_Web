import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, Vector3 } from 'three'
import { createPrepareCapsuleHalves } from '../src/features/session/prepare-capsule-shape.ts'
import { capsuleLidPose, dotFlight, DOT_BURST_MS, DOT_CLEAR_MS, PREPARE_SHAPE, prepareFormLayout, seededRandom } from '../src/features/session/prepare-capsule-motion.ts'

test('short halves remain disjoint through every pull, lift, tilt and reverse docking pose', () => {
  const { body, cap } = createPrepareCapsuleHalves('#7c3aed', '#c4b5fd')
  const bodyBox = new Box3().setFromObject(body.group), capBox = new Box3()
  assert.ok(bodyBox.max.y < 0)
  for (let frame = 0; frame <= 1000; frame++) {
    const pose = capsuleLidPose(frame / 1000)
    cap.group.position.set(pose.x, pose.y, pose.z); cap.group.rotation.z = pose.angle
    capBox.setFromObject(cap.group)
    assert.ok(!bodyBox.intersectsBox(capBox), 'Cap crossed the body at openness ' + frame / 1000)
  }
  for (const shell of [body, cap]) {
    shell.group.children.forEach(child => { if ('geometry' in child) (child.geometry as { dispose: () => void }).dispose() })
    shell.materials.forEach(material => material.dispose())
  }
})

test('rotation starts after separation and reverses before docking', () => {
  for (let open = 0; open <= .83; open += .01) assert.equal(capsuleLidPose(open).angle, 0)
  for (let open = .28; open <= 1; open += .01) assert.equal(capsuleLidPose(open).y, .14)
})

test('the modal layout is stable, below the capsule floor and independent of wind seeds', () => {
  for (const [width, height, cardWidth, cardHeight] of [[1440, 1000, 720, 750], [390, 844, 342, 700], [844, 390, 720, 310]]) {
    const layout = prepareFormLayout(width!, height!, cardWidth!, cardHeight!)
    const top = height! / 2 - layout.y - cardHeight! * layout.scale / 2
    assert.ok(top >= height! * .62)
    assert.deepEqual(layout, prepareFormLayout(width!, height!, cardWidth!, cardHeight!))
  }
})

test('random circles stay outside the body wall and cap, then cross through the open aperture', () => {
  const random = seededRandom(37), { radius, bodyRim } = PREPARE_SHAPE
  for (let index = 0; index < 200; index++) {
    const target = { x: (random() - .5) * .18, y: -.16, z: (random() - .5) * .18 }
    const bend = { x: random() * .08, y: (random() - .5) * .16, z: (random() - .5) * .1 }
    const origin = { x: 1 + random() * 1.5, y: (random() - .5) * 2, z: .2 }
    const scatterMs = 360 + random() * 140, flightMs = 850 + random() * 200
    const tangent = flightMs * .65 / (3 * scatterMs)
    const scatter = { x: Math.max(.4 + random(), (.4 + tangent * origin.x) / (1 + tangent)), y: (random() - .5) * 3, z: .2 + random() * .4 }
    const route = { origin, scatter, delay: random() * 140, scatterMs, flightMs }
    for (let ms = DOT_BURST_MS; ms <= DOT_CLEAR_MS; ms += 9) {
      const point = dotFlight(route, ms, target, bend), radial = Math.hypot(point.x, point.z)
      assert.ok(point.x >= -.1, 'Circle entered the parked cap region')
      if (point.y <= bodyRim && point.y >= -PREPARE_SHAPE.center) {
        assert.ok(radial < radius * .9 || radial > radius + .02, 'Circle crossed the body wall')
      }
      assert.ok(new Vector3(point.x, point.y, point.z).toArray().every(Number.isFinite))
    }
  }
})
