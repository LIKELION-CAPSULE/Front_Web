import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, Vector3 } from 'three'
import type { Mesh, LatheGeometry, TorusGeometry } from 'three'
import { createCapsuleHalves } from '../src/features/reports/capsule-shell.ts'
import { createPrepareCapsuleHalves } from '../src/features/session/prepare-capsule-shape.ts'
import { capsuleLanding, capsuleLidPose, dotFlight, DOT_BURST_MS, DOT_CLEAR_MS, PREPARE_SHAPE, PREPARE_LID_PULL, prepareFormLayout, prepareCapsuleFloor, prepareCapsuleScale, seededRandom } from '../src/features/session/prepare-capsule-motion.ts'

test('card-shaped sleeves disengage before lifting and remain clear while parking and tilting', () => {
  const { body, cap } = createPrepareCapsuleHalves('#7c3aed', '#c4b5fd')
  const bodyBox = new Box3().setFromObject(body.group), capBox = new Box3()
  const inner = cap.group.children[1] as Mesh<LatheGeometry>
  const cavityRadius = Math.max(...inner.geometry.parameters.points.map(point => point.x))
  const lip = body.group.children[2] as Mesh<TorusGeometry>
  const lipRadius = (lip.geometry.parameters.radius + lip.geometry.parameters.tube) * lip.scale.x
  assert.ok(cavityRadius > PREPARE_SHAPE.radius && cavityRadius > lipRadius)
  for (let frame = 0; frame <= 1000; frame++) {
    const pose = capsuleLidPose(frame / 1000)
    cap.group.position.set(pose.x, pose.y, pose.z); cap.group.rotation.z = pose.angle
    capBox.setFromObject(cap.group)
    if (bodyBox.intersectsBox(capBox)) {
      // Intentional axial nesting is safe because the body's entire profile fits inside the cap.
      assert.ok(Math.abs(pose.x) < 1e-10, 'Cap moved sideways before sleeve disengagement')
      assert.equal(pose.angle, 0, 'Cap tilted before sleeve disengagement')
      assert.ok(capBox.min.y < bodyBox.max.y)
    }
  }
  for (const shell of [body, cap]) {
    shell.group.children.forEach(child => { if ('geometry' in child) (child.geometry as { dispose: () => void }).dispose() })
    shell.materials.forEach(material => material.dispose())
  }
})

test('study-start and card-opening capsules use identical geometry and joint proportions', () => {
  const prepared = createPrepareCapsuleHalves('#7c3aed', '#c4b5fd'), card = createCapsuleHalves('#7c3aed', '#c4b5fd')
  for (const side of ['body', 'cap'] as const) {
    for (let i = 0; i < 3; i++) {
      const a = prepared[side].group.children[i] as Mesh, b = card[side].group.children[i] as Mesh
      assert.deepEqual(a.geometry.attributes.position!.array, b.geometry.attributes.position!.array)
      assert.deepEqual(a.scale.toArray(), b.scale.toArray())
    }
  }
  assert.ok(prepared.cap.radius > prepared.body.radius)
  assert.ok(PREPARE_SHAPE.bodyRim > PREPARE_SHAPE.capRim)
  for (const shell of [prepared.body, prepared.cap, card.body, card.cap]) {
    shell.group.children.forEach(child => { if ('geometry' in child) (child.geometry as { dispose: () => void }).dispose() })
    shell.materials.forEach(material => material.dispose())
  }
})

test('rotation starts after separation and reverses before docking', () => {
  for (let open = 0; open <= .88; open += .01) assert.equal(capsuleLidPose(open).angle, 0)
  for (let open = .28; open <= .72; open += .01) assert.equal(capsuleLidPose(open).y, PREPARE_LID_PULL)
  assert.equal(capsuleLidPose(1).y, .14)
})

test('the modal keeps its original size and measured position, independently of capsule wind', () => {
  for (const [width, height, cardWidth, cardHeight] of [[1440, 1000, 720, 750], [390, 844, 342, 700], [844, 390, 720, 310]]) {
    const left = (width! - cardWidth!) / 2 + 3, top = (height! - cardHeight!) / 2 - 7
    const layout = prepareFormLayout(width!, height!, cardWidth!, cardHeight!, left, top)
    assert.equal(layout.scale, 1)
    assert.equal(width! / 2 + layout.x - cardWidth! / 2, left)
    assert.equal(height! / 2 - layout.y - cardHeight! / 2, top)
  }
})

test('capsule lands at the modal feet without shrinking the form or dropping below the viewport', () => {
  for (const [width, height, bottom] of [[1440, 1000, 891.5], [390, 844, 812], [844, 390, 342]]) {
    const scale = prepareCapsuleScale(width!, height!), floor = prepareCapsuleFloor(height!, bottom!, scale)
    const settled = capsuleLanding(1800, width!, height!, scale, 23, floor, 0)
    assert.equal(settled.y, floor)
    assert.ok(height! / 2 - floor + scale * PREPARE_SHAPE.radius <= height! - 13)
    assert.ok(height! / 2 - floor > height! * .7)
  }
})

test('random circles stay outside the body wall and cap, then cross through the open aperture', () => {
  const random = seededRandom(37), { radius, bodyRim } = PREPARE_SHAPE
  for (let index = 0; index < 200; index++) {
    const target = { x: (random() - .5) * .18, y: -.42 - random() * .16, z: (random() - .5) * .18 }
    const bend = { x: random() * .08, y: (random() - .5) * .16, z: (random() - .5) * .1 }
    const depth = .95 + random() * .12
    const origin = { x: (random() - .5) * 5, y: (random() - .5) * 5, z: depth }
    const scatterMs = 700 + random() * 250, flightMs = 1600 + random() * 300
    const scatter = { x: (random() - .5) * 8, y: (random() - .5) * 8, z: depth }
    const route = { origin, scatter, delay: random() * 200, scatterMs, flightMs }
    for (let ms = DOT_BURST_MS; ms <= DOT_CLEAR_MS; ms += 9) {
      const point = dotFlight(route, ms, target, bend), radial = Math.hypot(point.x, point.z)
      assert.ok(point.z > .6 || point.x > -.32, 'Circle entered the parked cap region')
      if (point.y <= bodyRim && point.y >= -PREPARE_SHAPE.center - radius) {
        const dome = Math.min(0, point.y + PREPARE_SHAPE.center)
        const innerRadius = Math.sqrt(Math.max(0, (radius * .965) ** 2 - dome ** 2))
        const outerRadius = Math.sqrt(Math.max(0, radius ** 2 - dome ** 2))
        assert.ok(radial < innerRadius - .015 || radial > outerRadius + .02, 'Circle crossed the body wall or dome')
      }
      assert.ok(new Vector3(point.x, point.y, point.z).toArray().every(Number.isFinite))
    }
  }
})
